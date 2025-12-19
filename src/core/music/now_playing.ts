import discord from 'discord.js';
import magmastream from 'magmastream';

import { send } from '../../utils/msg';
import { LocaleDetector } from '../locales';
import { MusicResponseHandler } from './handlers';

export class NowPlayingManager {
	private static instances: Map<string, NowPlayingManager> = new Map();
	private message: discord.Message | null = null;
	private updateInterval: NodeJS.Timeout | null = null;
	private player: magmastream.Player;
	private client: discord.Client;
	private lastUpdateTime: number = 0;
	private readonly UPDATE_INTERVAL = 10000; // refresh every 10s to avoid rate limits
	private readonly MIN_UPDATE_INTERVAL = 8000; // throttle edits to at least 8s apart
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
		if (!this.client.config.music.feature.progress_bar.enabled) return;

		this.updateInterval = setInterval(async () => {
			if (this.destroyed || this.stopped || this.isUpdating) return;
			if (!this.player || !this.player.playing || this.paused) return;
			const current = await this.player.queue?.getCurrent();
			if (!current) return;

			const position = this.player.position;
			const duration = current?.duration || 0;
			const remainingTime = duration - position;

			if (remainingTime > 0 && remainingTime < 15000) {
				this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] End-of-track update error: ${err}`));
			} else {
				this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Regular update error: ${err}`));
			}
		}, this.UPDATE_INTERVAL);
	};

	private getAdjustedPlayer = async (): Promise<magmastream.Player> => {
		const playerProxy = Object.create(Object.getPrototypeOf(this.player));
		for (const prop of Object.getOwnPropertyNames(this.player)) {
			if (prop !== 'position') Object.defineProperty(playerProxy, prop, Object.getOwnPropertyDescriptor(this.player, prop)!);
		}

		const current = await this.player.queue?.getCurrent();
		const duration = Number(current?.duration || 0);

		Object.defineProperty(playerProxy, 'position', {
			get: () => {
				const rawPosition = Number(this.player.position || 0);
				if (!Number.isFinite(rawPosition)) return 0;
				if (duration <= 0) return Math.max(0, rawPosition);
				const headroom = 100; // ms
				const upperBound = Math.max(0, duration - headroom);
				const clamped = Math.min(Math.max(0, rawPosition), upperBound);
				return clamped;
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

	private validateMessageAccess = async (message: discord.Message): Promise<boolean> => {
		try {
			if (!message.channel) {
				this.client.logger?.warn(`[NowPlayingManager] Message channel is null, clearing reference`);
				return false;
			}

			const channel = await this.client.channels.fetch(message.channel.id).catch(() => null);
			if (!channel) {
				this.client.logger?.warn(`[NowPlayingManager] Channel ${message.channel.id} not accessible, clearing reference`);
				return false;
			}

			if (!channel.isTextBased()) {
				this.client.logger?.warn(`[NowPlayingManager] Channel ${message.channel.id} is not text-based, clearing reference`);
				return false;
			}

			try {
				await message.fetch();
				return true;
			} catch (error) {
				if (error instanceof discord.DiscordAPIError) {
					if (error.code === 10008 || error.code === 10003) {
						this.client.logger?.warn(`[NowPlayingManager] Message or channel deleted, clearing reference`);
						return false;
					}
				}
				throw error;
			}
		} catch (error) {
			this.client.logger?.warn(`[NowPlayingManager] Error validating message access: ${error}`);
			return false;
		}
	};

	private updateNowPlaying = async (): Promise<void> => {
		if (this.isUpdating) return;

		const now = Date.now();
		if (now - this.lastUpdateTime < this.MIN_UPDATE_INTERVAL) return;

		const currentMessage = this.message;
		if (!currentMessage || !this.player) return;

		const currentTrack = await this.player.queue?.getCurrent();
		if (!currentTrack) return this.client.logger?.debug(`[NowPlayingManager] No current track, skipping update`);

		this.isUpdating = true;

		try {
			const isMessageValid = await this.validateMessageAccess(currentMessage);
			if (!isMessageValid) {
				this.message = null;
				return;
			}

			if (!currentMessage.editable) {
				this.client.logger?.warn(`[NowPlayingManager] Message is no longer editable, clearing reference`);
				this.message = null;
				return;
			}

			const locale = await this.getGuildLocale();
			const adjustedPlayer = await this.getAdjustedPlayer();
			const embed = await new MusicResponseHandler(this.client).createMusicEmbed(currentTrack, adjustedPlayer, locale);

			const shouldDisableButtons = this.stopped || this.player.state === 'DISCONNECTED' || (!this.player.playing && !this.player.paused);
			const musicButton = new MusicResponseHandler(this.client).getMusicButton(shouldDisableButtons, locale);

			if (this.message === currentMessage && currentMessage.editable) {
				await currentMessage.edit({ embeds: [embed], components: [musicButton] });
				this.lastUpdateTime = Date.now();
			}
		} catch (error) {
			if (error instanceof Error) {
				const errorMessage = error.message.toLowerCase();

				if (errorMessage.includes('channelnotcached') || errorMessage.includes('could not find the channel')) {
					this.client.logger?.warn(`[NowPlayingManager] Channel not cached, clearing message reference`);
					this.message = null;
				} else if (errorMessage.includes('unknown message') || errorMessage.includes('missing access') || errorMessage.includes('cannot edit a deleted message') || errorMessage.includes('cannot edit a message authored by another user')) {
					this.client.logger?.warn(`[NowPlayingManager] Message error: ${errorMessage}, clearing reference`);
					this.message = null;
				} else if (errorMessage.includes('rate limited')) {
					this.lastUpdateTime = Date.now() + 30000;
					this.client.logger?.warn(`[NowPlayingManager] Rate limited, backing off for 30 seconds`);
				} else {
					this.client.logger?.error(`[NowPlayingManager] Update error: ${error}`);
				}
			} else if (error instanceof discord.DiscordAPIError) {
				switch (error.code) {
					case 10008:
					case 10003:
						this.client.logger?.warn(`[NowPlayingManager] Message or channel deleted (${error.code}), clearing reference`);
						this.message = null;
						break;
					case 50001:
					case 50013:
						this.client.logger?.warn(`[NowPlayingManager] Missing permissions (${error.code}), clearing reference`);
						this.message = null;
						break;
					case 50035:
						this.client.logger?.warn(`[NowPlayingManager] Invalid form body (${error.code})`);
						break;
					default:
						this.client.logger?.error(`[NowPlayingManager] Discord API error ${error.code}: ${error.message}`);
				}
			} else {
				this.client.logger?.error(`[NowPlayingManager] Unknown update error: ${error}`);
			}
		} finally {
			this.isUpdating = false;
		}
	};

	public updateOrCreateMessage = async (channel: discord.TextChannel, track: magmastream.Track): Promise<void> => {
		if (this.isUpdating) return;
		if (!track) return this.client.logger?.warn(`[NowPlayingManager] Cannot update/create message: track is null`);

		try {
			const channelAccessible = await this.client.channels.fetch(channel.id).catch(() => null);
			if (!channelAccessible) return this.client.logger?.warn(`[NowPlayingManager] Channel ${channel.id} not accessible, skipping update`);

			const locale = await this.getGuildLocale();
			const embed = await new MusicResponseHandler(this.client).createMusicEmbed(track, this.player, locale);
			const shouldDisableButtons = this.stopped || this.player.state === 'DISCONNECTED' || (!this.player.playing && !this.player.paused);
			const musicButton = new MusicResponseHandler(this.client).getMusicButton(shouldDisableButtons, locale);
			const currentMessage = this.message;

			if (currentMessage) {
				const isValid = await this.validateMessageAccess(currentMessage);
				if (isValid && currentMessage.editable) {
					await currentMessage
						.edit({ embeds: [embed], components: [musicButton] })
						.then(() => this.client.logger?.debug(`[NowPlayingManager] Updated existing message in ${channel.name}`))
						.catch(async (error) => {
							this.client.logger?.warn(`[NowPlayingManager] Failed to edit message: ${error}, creating new one`);
							this.message = null;
							const newMessage = await send(channel.client, channel.id, { embeds: [embed], components: [musicButton] });
							if (newMessage) this.setMessage(newMessage, false);
						});
				} else {
					this.message = null;
				}
			}

			if (!this.message) {
				try {
					const messages = await channel.messages.fetch({ limit: 10 }).catch(() => new discord.Collection<string, discord.Message>());
					const nowPlayingTranslation = this.client.localizationManager?.translate('responses.music.now_playing', locale) || 'Now Playing';
					const botMessages = messages.filter((m: discord.Message) => {
						return m.author.id === this.client.user?.id && m.embeds.length > 0 && (m.embeds[0].title === 'Now Playing' || m.embeds[0].title === nowPlayingTranslation);
					});
					const deletePromises: Promise<void>[] = [];
					for (const [_, msg] of botMessages) {
						deletePromises.push(
							(msg as discord.Message)
								.delete()
								.then(() => {})
								.catch(() => {})
						);
					}
					await Promise.all(deletePromises);
				} catch (error) {
					this.client.logger?.warn(`[NowPlayingManager] Error cleaning up old messages: ${error}`);
				}

				try {
					const newMessage = await send(channel.client, channel.id, { embeds: [embed], components: [musicButton] });
					if (newMessage) this.setMessage(newMessage, false);
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
		return this.message !== null;
	};

	public forceUpdate = async (): Promise<void> => {
		if (!this.isUpdating && (await this.player?.queue?.getCurrent())) this.updateNowPlaying().catch((err) => this.client.logger?.error(`[NowPlayingManager] Force update failed: ${err}`));
	};

	public getPlaybackStatus = async (): Promise<{ position: number; duration: number; isPlaying: boolean; isPaused: boolean; track: magmastream.Track | null }> => {
		const current = await this.player?.queue?.getCurrent();
		return {
			position: this.player?.position || 0,
			duration: current?.duration || 0,
			isPlaying: !!this.player?.playing,
			isPaused: !!this.player?.paused,
			track: current || null,
		};
	};
}
