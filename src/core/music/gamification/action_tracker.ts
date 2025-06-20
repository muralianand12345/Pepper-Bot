import discord from 'discord.js';
import magmastream from 'magmastream';

import { XPManager } from './xp_manager';
import { IXPAction } from '../../../types';
import { LocaleDetector } from '../../locales';

export class ActionTracker {
	private static instance: ActionTracker;
	private client: discord.Client;
	private xpManager: XPManager;
	private localeDetector: LocaleDetector;
	private activeListeners: Map<string, Date> = new Map();

	private constructor(client: discord.Client) {
		this.client = client;
		this.xpManager = XPManager.getInstance(client);
		this.localeDetector = new LocaleDetector();
		this.setupEventListeners();
	}

	public static getInstance = (client: discord.Client): ActionTracker => {
		if (!ActionTracker.instance) ActionTracker.instance = new ActionTracker(client);
		return ActionTracker.instance;
	};

	private setupEventListeners = (): void => {
		this.client.manager.on(magmastream.ManagerEventTypes.TrackStart, this.handleTrackStart);
		this.client.manager.on(magmastream.ManagerEventTypes.TrackEnd, this.handleTrackEnd);
	};

	private handleTrackStart = async (player: magmastream.Player, track: magmastream.Track): Promise<void> => {
		try {
			if (!track.requester || !player.guildId) return;
			const userId = typeof track.requester === 'string' ? track.requester : (track.requester as discord.User).id;
			await this.xpManager.startListeningSession(userId);
			this.activeListeners.set(userId, new Date());
			this.client.logger.debug(`[ACTION_TRACKER] Started listening session for user ${userId}`);
		} catch (error) {
			this.client.logger.error(`[ACTION_TRACKER] Error handling track start: ${error}`);
		}
	};

	private handleTrackEnd = async (player: magmastream.Player, track: magmastream.Track): Promise<void> => {
		try {
			if (!track.requester || !player.guildId) return;

			const userId = typeof track.requester === 'string' ? track.requester : (track.requester as discord.User).id;
			const startTime = this.activeListeners.get(userId);

			if (startTime) {
				const result = await this.xpManager.endListeningSession(userId, player.guildId);
				if (result.xpGained > 0) this.client.logger.debug(`[ACTION_TRACKER] User ${userId} gained ${result.xpGained} XP for ${result.minutesListened} minutes`);
				this.activeListeners.delete(userId);
			}
		} catch (error) {
			this.client.logger.error(`[ACTION_TRACKER] Error handling track end: ${error}`);
		}
	};

	private handleTrackAdd = async (player: magmastream.Player, track: magmastream.Track | magmastream.Track[]): Promise<void> => {
		try {
			if (!player.guildId) return;
			const tracks = Array.isArray(track) ? track : [track];
			const firstTrack = tracks[0];
			if (!firstTrack?.requester) return;
			const userId = typeof firstTrack.requester === 'string' ? firstTrack.requester : (firstTrack.requester as discord.User).id;
			const isPlaylist = tracks.length > 1;
			const action: IXPAction = { type: isPlaylist ? 'playlist_add' : 'queue_add', xpGained: 0, timestamp: new Date(), details: isPlaylist ? `${tracks.length} tracks` : firstTrack.title };
			const result = await this.xpManager.awardXP(userId, player.guildId, action);
			if (result.levelUp && result.newLevel) await this.sendLevelUpNotification(userId, player.guildId, result.newLevel, result.xpGained);
		} catch (error) {
			this.client.logger.error(`[ACTION_TRACKER] Error handling track add: ${error}`);
		}
	};

	public trackCommandUsage = async (interaction: discord.ChatInputCommandInteraction, commandName: string): Promise<void> => {
		try {
			if (!interaction.guildId) return;
			const musicCommands = ['play', 'skip', 'pause', 'resume', 'stop', 'loop', 'filter', 'autoplay'];
			const actionType = musicCommands.includes(commandName) ? 'command_music' : 'command';
			const action: IXPAction = { type: actionType as any, xpGained: 0, timestamp: new Date(), details: commandName };
			const result = await this.xpManager.awardXP(interaction.user.id, interaction.guildId, action);
			if (result.levelUp && result.newLevel) await this.sendLevelUpNotification(interaction.user.id, interaction.guildId, result.newLevel, result.xpGained);
		} catch (error) {
			this.client.logger.error(`[ACTION_TRACKER] Error tracking command usage: ${error}`);
		}
	};

	public trackShareAction = async (userId: string, guildId: string, songTitle: string): Promise<void> => {
		try {
			const action: IXPAction = { type: 'share', xpGained: 0, timestamp: new Date(), details: songTitle };
			const result = await this.xpManager.awardXP(userId, guildId, action);
			if (result.levelUp && result.newLevel) await this.sendLevelUpNotification(userId, guildId, result.newLevel, result.xpGained);
		} catch (error) {
			this.client.logger.error(`[ACTION_TRACKER] Error tracking share action: ${error}`);
		}
	};

	private sendLevelUpNotification = async (userId: string, guildId: string, newLevel: number, xpGained: number): Promise<void> => {
		try {
			const guild = this.client.guilds.cache.get(guildId);
			if (!guild) return;

			const user = await this.client.users.fetch(userId).catch(() => null);
			if (!user) return;

			let channel: discord.TextChannel | null = null;
			const musicChannels = guild.channels.cache.filter((c) => c.type === discord.ChannelType.GuildText && (c.name.includes('music') || c.name.includes('bot') || c.name.includes('general'))) as discord.Collection<string, discord.TextChannel>;

			if (musicChannels.size > 0) {
				channel = musicChannels.first()!;
			} else {
				const textChannels = guild.channels.cache.filter((c) => c.type === discord.ChannelType.GuildText) as discord.Collection<string, discord.TextChannel>;
				if (textChannels.size > 0) channel = textChannels.first()!;
			}

			if (!channel) return;

			let locale = 'en';
			try {
				locale = (await this.localeDetector.getGuildLanguage(guildId)) || 'en';
			} catch (error) {}

			const embed = new discord.EmbedBuilder()
				.setColor('#ffd700')
				.setTitle('🎉 Level Up!')
				.setDescription(`Congratulations ${user.displayName}! You've reached **Level ${newLevel}**!`)
				.addFields([
					{ name: '📈 XP Gained', value: `+${xpGained} XP`, inline: true },
					{ name: '🏆 New Level', value: `Level ${newLevel}`, inline: true },
					{ name: '⭐ Keep Going!', value: 'Keep listening to music to gain more XP!', inline: false },
				])
				.setThumbnail(user.displayAvatarURL())
				.setFooter({ text: 'Pepper Music XP System', iconURL: this.client.user?.displayAvatarURL() })
				.setTimestamp();

			await channel.send({ embeds: [embed] }).catch(() => {});
		} catch (error) {
			this.client.logger.error(`[ACTION_TRACKER] Error sending level up notification: ${error}`);
		}
	};

	public getActiveListeners = (): Map<string, Date> => {
		return this.activeListeners;
	};

	public clearActiveListener = (userId: string): void => {
		this.activeListeners.delete(userId);
	};
}
