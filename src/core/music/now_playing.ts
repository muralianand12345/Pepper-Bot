import discord from 'discord.js';
import magmastream from 'magmastream';

import { LocaleDetector } from '../locales';
import { MusicResponseHandler } from './handlers';

export class NowPlayingManager {
	private static instances: Map<string, NowPlayingManager> = new Map();
	private message: discord.Message | null = null;
	private updateInterval: NodeJS.Timeout | null = null;
	private player: magmastream.Player;
	private client: discord.Client;
	private lastUpdateTime: number = 0;
	private readonly UPDATE_INTERVAL = 15000;
	private readonly MIN_UPDATE_INTERVAL = 5000;
	private paused: boolean = false;
	private destroyed: boolean = false;
	private stopped: boolean = false;
	private localeDetector: LocaleDetector;
	private isUpdating: boolean = false;

	private constructor(player: magmastream.Player, client: discord.Client) {
		this.player = player;
		this.client = client;
		this.localeDetector = new LocaleDetector();
		this.startUpdateInterval();
	}

	public static getInstance = (guildId: string, player: magmastream.Player, client: discord.Client): NowPlayingManager => {
		if (!this.instances.has(guildId)) this.instances.set(guildId, new NowPlayingManager(player, client));
		return this.instances.get(guildId)!;
	};

	public static removeInstance = (guildId: string): void => {
		const instance = this.instances.get(guildId);
		if (instance) {
			instance.destroy();
			this.instances.delete(guildId);
		}
	};

	public setMessage = (message: discord.Message, forceUpdate: boolean = false): void => {
		if (message.author.id !== this.client.user?.id) return this.client.logger?.warn(`[NowPlayingManager] Attempted to set message not authored by bot`);
		this.message = message;
		if (forceUpdate) this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Failed to update now playing message: ${err}`));
	};

	public onPause = (): void => {
		this.paused = true;
		this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Failed to update after pause: ${err}`));
	};

	public onResume = (): void => {
		this.paused = false;
		this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Failed to update after resume: ${err}`));
	};

	public onStop = (): void => {
		this.stopped = true;
		this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Failed to update after stop: ${err}`));
	};

	private startUpdateInterval = (): void => {
		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(() => {
			if (this.destroyed || this.stopped || this.isUpdating) return;
			if (!this.player || !this.player.playing || this.paused) return;

			const position = this.player.position;
			const duration = this.player.queue.current?.duration || 0;
			const remainingTime = duration - position;

			if (remainingTime > 0 && remainingTime < 15000) {
				this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] End-of-track update error: ${err}`));
			} else {
				this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Regular update error: ${err}`));
			}
		}, this.UPDATE_INTERVAL);
	};

	private getAdjustedPlayer = (): magmastream.Player => {
		const playerProxy = Object.create(Object.getPrototypeOf(this.player));
		for (const prop of Object.getOwnPropertyNames(this.player)) {
			if (prop !== 'position') Object.defineProperty(playerProxy, prop, Object.getOwnPropertyDescriptor(this.player, prop)!);
		}

		Object.defineProperty(playerProxy, 'position', {
			get: () => {
				const position = this.player.position;
				const duration = this.player.queue.current?.duration || 0;
				const remainingTime = duration - position;

				if (remainingTime <= 10000) {
					if (remainingTime < 2000) return duration - 100;
					const scalingFactor = 1 + (10000 - remainingTime) / 10000;
					return Math.min(position * scalingFactor, duration - 100);
				}

				return Math.min(position + 300, duration);
			},
		});

		return playerProxy;
	};

	private getGuildLocale = async (): Promise<string> => {
		try {
			return (await this.localeDetector.getGuildLanguage(this.player.guildId)) || 'en';
		} catch (error) {
			this.client.logger?.warn(`[NowPlayingManager] Failed to get guild locale: ${error}`);
			return 'en';
		}
	};

	private updateNowPlaying = async (): Promise<void> => {
		if (this.isUpdating) return;

		const now = Date.now();
		if (now - this.lastUpdateTime < this.MIN_UPDATE_INTERVAL) return;

		const currentMessage = this.message;
		if (!currentMessage || !this.player || !this.player.queue?.current) return;

		this.isUpdating = true;

		try {
			if (!currentMessage.editable) {
				this.client.logger?.warn(`[NowPlayingManager] Message is no longer editable, clearing reference`);
				this.message = null;
				return;
			}

			const locale = await this.getGuildLocale();
			const adjustedPlayer = this.getAdjustedPlayer();
			const embed = new MusicResponseHandler(this.client).createMusicEmbed(this.player.queue.current, adjustedPlayer, locale);

			const shouldDisableButtons = this.stopped || !this.player.playing || this.player.state === 'DISCONNECTED';
			const musicButton = new MusicResponseHandler(this.client).getMusicButton(shouldDisableButtons, locale);

			if (this.message === currentMessage && currentMessage.editable) {
				await currentMessage.edit({ embeds: [embed], components: [musicButton] });
				this.lastUpdateTime = Date.now();
			}
		} catch (error) {
			if (error instanceof Error) {
				const errorMessage = error.message.toLowerCase();

				if (errorMessage.includes('unknown message') || errorMessage.includes('missing access') || errorMessage.includes('cannot edit a deleted message') || errorMessage.includes('cannot edit a message authored by another user')) {
					this.client.logger?.warn(`[NowPlayingManager] Message error: ${errorMessage}, clearing reference`);
					this.message = null;
				} else if (errorMessage.includes('rate limited')) {
					this.lastUpdateTime = Date.now() + 30000;
					this.client.logger?.warn(`[NowPlayingManager] Rate limited, backing off for 30 seconds`);
				} else {
					this.client.logger?.error(`[NowPlayingManager] Update error: ${error}`);
				}
			} else {
				this.client.logger?.error(`[NowPlayingManager] Unknown update error`);
			}
		} finally {
			this.isUpdating = false;
		}
	};

	public updateOrCreateMessage = async (channel: discord.TextChannel, track: magmastream.Track): Promise<void> => {
		if (this.isUpdating) return;

		try {
			const locale = await this.getGuildLocale();
			const embed = new MusicResponseHandler(this.client).createMusicEmbed(track, this.player, locale);
			const shouldDisableButtons = this.stopped || !this.player.playing || this.player.state === 'DISCONNECTED';
			const musicButton = new MusicResponseHandler(this.client).getMusicButton(shouldDisableButtons, locale);
			const currentMessage = this.message;

			if (currentMessage && currentMessage.editable) {
				await currentMessage
					.edit({ embeds: [embed], components: [musicButton] })
					.then(() => this.client.logger?.debug(`[NowPlayingManager] Updated existing message in ${channel.name}`))
					.catch(async (error) => {
						this.client.logger?.warn(`[NowPlayingManager] Failed to edit message: ${error}, creating new one`);
						this.message = null;
						const newMessage = await channel.send({ embeds: [embed], components: [musicButton] });
						this.setMessage(newMessage, false);
					});
			} else {
				try {
					const messages = await channel.messages.fetch({ limit: 10 });
					const nowPlayingTranslation = this.client.localizationManager?.translate('responses.music.now_playing', locale) || 'Now Playing';
					const botMessages = messages.filter((m) => {
						return m.author.id === this.client.user?.id && m.embeds.length > 0 && (m.embeds[0].title === 'Now Playing' || m.embeds[0].title === nowPlayingTranslation);
					});
					const deletePromises = [];
					for (const [_, msg] of botMessages) {
						deletePromises.push(msg.delete().catch(() => {}));
					}
					await Promise.all(deletePromises);
				} catch (error) {
					this.client.logger?.warn(`[NowPlayingManager] Error cleaning up old messages: ${error}`);
				}

				try {
					const newMessage = await channel.send({ embeds: [embed], components: [musicButton] });
					this.setMessage(newMessage, false);
					this.client.logger?.debug(`[NowPlayingManager] Created new message in ${channel.name}`);
				} catch (error) {
					this.client.logger?.error(`[NowPlayingManager] Failed to create new message: ${error}`);
				}
			}
		} catch (error) {
			this.client.logger?.error(`[NowPlayingManager] Error in updateOrCreateMessage: ${error}`);
		}
	};

	public destroy = (): void => {
		this.destroyed = true;
		this.isUpdating = false;
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
		this.message = null;
	};

	public hasMessage = (): boolean => {
		return this.message !== null && this.message.editable;
	};

	public forceUpdate = (): void => {
		if (!this.isUpdating) this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Force update failed: ${err}`));
	};

	public getPlaybackStatus = (): { position: number; duration: number; isPlaying: boolean; isPaused: boolean; track: magmastream.Track | null } => {
		return {
			position: this.player?.position || 0,
			duration: this.player?.queue?.current?.duration || 0,
			isPlaying: !!this.player?.playing,
			isPaused: !!this.player?.paused,
			track: this.player?.queue?.current || null,
		};
	};
}
