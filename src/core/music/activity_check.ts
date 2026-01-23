import discord from 'discord.js';
import magmastream from 'magmastream';

import { send } from '../../utils/msg';
import { LocaleDetector } from '../locales';
import { MusicResponseHandler } from './handlers';

const ACTIVITY_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const RESPONSE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export class ActivityCheckManager {
	private static instances: Map<string, ActivityCheckManager> = new Map();
	private player: magmastream.Player;
	private client: discord.Client;
	private checkTimer: NodeJS.Timeout | null = null;
	private responseTimer: NodeJS.Timeout | null = null;
	private sessionStartTime: number;
	private destroyed: boolean = false;
	private localeDetector: LocaleDetector;
	private activeMessage: discord.Message | null = null;
	private isPendingResponse: boolean = false;

	private constructor(player: magmastream.Player, client: discord.Client) {
		this.player = player;
		this.client = client;
		this.localeDetector = new LocaleDetector();
		this.sessionStartTime = Date.now();
		this.startCheckTimer();
	}

	public static getInstance = (guildId: string, player: magmastream.Player, client: discord.Client): ActivityCheckManager => {
		if (!this.instances.has(guildId)) this.instances.set(guildId, new ActivityCheckManager(player, client));
		return this.instances.get(guildId)!;
	};

	public static removeInstance = (guildId: string): void => {
		const instance = this.instances.get(guildId);
		if (instance) {
			instance.destroy();
			this.instances.delete(guildId);
		}
	};

	public static hasInstance = (guildId: string): boolean => {
		return this.instances.has(guildId);
	};

	public resetSession = (): void => {
		this.sessionStartTime = Date.now();
		this.isPendingResponse = false;
		this.clearResponseTimer();
		this.startCheckTimer();
		this.client.logger?.debug(`[ActivityCheckManager] Session reset for guild ${this.player.guildId}`);
	};

	public onContinueConfirmed = async (): Promise<void> => {
		this.isPendingResponse = false;
		this.clearResponseTimer();
		this.resetSession();

		if (this.activeMessage) {
			try {
				const locale = await this.getGuildLocale();
				const responseHandler = new MusicResponseHandler(this.client);
				const embed = responseHandler.createActivityCheckConfirmedEmbed(locale);
				const disabledButton = responseHandler.getActivityCheckButton(true, locale);
				await this.activeMessage.edit({ embeds: [embed], components: [disabledButton] });
			} catch (error) {
				this.client.logger?.warn(`[ActivityCheckManager] Failed to update confirmed message: ${error}`);
			}
			this.activeMessage = null;
		}

		this.client.logger?.info(`[ActivityCheckManager] User confirmed activity for guild ${this.player.guildId}`);
	};

	public isPending = (): boolean => {
		return this.isPendingResponse;
	};

	public destroy = (): void => {
		this.destroyed = true;
		this.clearCheckTimer();
		this.clearResponseTimer();
		this.activeMessage = null;
		this.client.logger?.debug(`[ActivityCheckManager] Destroyed for guild ${this.player.guildId}`);
	};

	private startCheckTimer = (): void => {
		this.clearCheckTimer();
		if (this.destroyed) return;

		this.checkTimer = setTimeout(async () => {
			if (this.destroyed) return;
			await this.sendActivityCheck();
		}, ACTIVITY_CHECK_INTERVAL);

		this.client.logger?.debug(`[ActivityCheckManager] Check timer started for guild ${this.player.guildId}, will trigger in 6 hours`);
	};

	private clearCheckTimer = (): void => {
		if (this.checkTimer) {
			clearTimeout(this.checkTimer);
			this.checkTimer = null;
		}
	};

	private clearResponseTimer = (): void => {
		if (this.responseTimer) {
			clearTimeout(this.responseTimer);
			this.responseTimer = null;
		}
	};

	private getGuildLocale = async (): Promise<string> => {
		try {
			return (await this.localeDetector.getGuildLanguage(this.player.guildId)) || 'en';
		} catch (error) {
			this.client.logger?.warn(`[ActivityCheckManager] Failed to get guild locale: ${error}`);
			return 'en';
		}
	};

	private sendActivityCheck = async (): Promise<void> => {
		if (this.destroyed || !this.player || this.isPendingResponse) return;

		const currentTrack = await this.player.queue?.getCurrent();
		if (!currentTrack) {
			this.client.logger?.debug(`[ActivityCheckManager] No current track, skipping activity check`);
			return;
		}

		if (!this.player.playing && !this.player.paused) {
			this.client.logger?.debug(`[ActivityCheckManager] Player not active, skipping activity check`);
			return;
		}

		const textChannelId = this.player.textChannelId;
		if (!textChannelId) {
			this.client.logger?.warn(`[ActivityCheckManager] No text channel for guild ${this.player.guildId}`);
			return;
		}

		try {
			const channel = await this.client.channels.fetch(textChannelId);
			if (!channel?.isTextBased()) {
				this.client.logger?.warn(`[ActivityCheckManager] Invalid text channel for guild ${this.player.guildId}`);
				return;
			}

			const locale = await this.getGuildLocale();
			const responseHandler = new MusicResponseHandler(this.client);
			const embed = responseHandler.createActivityCheckEmbed(locale);
			const button = responseHandler.getActivityCheckButton(false, locale);

			const message = await send(this.client, channel.id, { embeds: [embed], components: [button] });
			if (message) {
				this.activeMessage = message;
				this.isPendingResponse = true;
				this.startResponseTimer();
				this.client.logger?.info(`[ActivityCheckManager] Activity check sent for guild ${this.player.guildId}`);
			}
		} catch (error) {
			this.client.logger?.error(`[ActivityCheckManager] Failed to send activity check: ${error}`);
			this.startCheckTimer();
		}
	};

	private startResponseTimer = (): void => {
		this.clearResponseTimer();

		this.responseTimer = setTimeout(async () => {
			if (this.destroyed || !this.isPendingResponse) return;
			await this.handleNoResponse();
		}, RESPONSE_TIMEOUT);

		this.client.logger?.debug(`[ActivityCheckManager] Response timer started, will timeout in 5 minutes`);
	};

	private handleNoResponse = async (): Promise<void> => {
		if (this.destroyed) return;

		this.client.logger?.info(`[ActivityCheckManager] No response received for guild ${this.player.guildId}, destroying player`);

		const textChannelId = this.player.textChannelId;
		const locale = await this.getGuildLocale();

		if (this.activeMessage) {
			try {
				const responseHandler = new MusicResponseHandler(this.client);
				const embed = responseHandler.createActivityCheckTimeoutEmbed(locale);
				const disabledButton = responseHandler.getActivityCheckButton(true, locale);
				await this.activeMessage.edit({ embeds: [embed], components: [disabledButton] });
			} catch (error) {
				this.client.logger?.warn(`[ActivityCheckManager] Failed to update timeout message: ${error}`);
			}
		}

		if (textChannelId) {
			try {
				const channel = await this.client.channels.fetch(textChannelId);
				if (channel?.isTextBased()) {
					const responseHandler = new MusicResponseHandler(this.client);
					const embed = responseHandler.createInfoEmbed(this.client.localizationManager?.translate('responses.activity_check.disconnected', locale) || '🔌 Disconnected due to inactivity (no response to activity check)');
					await send(this.client, channel.id, { embeds: [embed] });
				}
			} catch (error) {
				this.client.logger?.warn(`[ActivityCheckManager] Failed to send disconnect message: ${error}`);
			}
		}

		ActivityCheckManager.removeInstance(this.player.guildId);
		this.player.destroy();
	};
}
