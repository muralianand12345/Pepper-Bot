import discord from 'discord.js';
import magmastream from 'magmastream';

import { LocaleDetector } from '../../locales';
import { MusicResponseHandler } from './response';

export class VoiceChannelValidator {
	private readonly client: discord.Client;
	private readonly interaction: discord.ChatInputCommandInteraction | discord.ButtonInteraction;
	private readonly requiredPermissions = [discord.PermissionsBitField.Flags.Connect, discord.PermissionsBitField.Flags.Speak];
	private localeDetector: LocaleDetector;

	constructor(client: discord.Client, interaction: discord.ChatInputCommandInteraction | discord.ButtonInteraction) {
		this.client = client;
		this.interaction = interaction;
		this.localeDetector = new LocaleDetector();
	}

	private getGuild = (): discord.Guild | null => {
		return this.interaction.guild || null;
	};

	private getUserId = (): string => {
		return this.interaction.user.id;
	};

	private createErrorEmbed = async (messageKey: string, data?: Record<string, string | number>): Promise<discord.EmbedBuilder> => {
		const locale = await this.localeDetector.detectLocale(this.interaction);
		const t = await this.localeDetector.getTranslator(this.interaction);
		return new MusicResponseHandler(this.client).createErrorEmbed(t(messageKey, data), locale);
	};

	private getGuildMember = async (): Promise<discord.GuildMember | undefined> => {
		const guild = this.getGuild();
		const userId = this.getUserId();

		if (!guild) return undefined;

		try {
			return guild.members.cache.get(userId) || (await guild.members.fetch(userId));
		} catch (error) {
			this.client.logger.error(`[VALIDATOR] Failed to fetch guild member: ${error}`);
			return undefined;
		}
	};

	private validateGuildMember = async (): Promise<[boolean, discord.EmbedBuilder]> => {
		const member = await this.getGuildMember();
		if (!member) return [false, await this.createErrorEmbed('responses.errors.not_in_server')];
		return [true, await this.createErrorEmbed('')];
	};

	public validateGuildContext = async (): Promise<[boolean, discord.EmbedBuilder]> => {
		return !this.getGuild() ? [false, await this.createErrorEmbed('responses.errors.server_only')] : [true, await this.createErrorEmbed('')];
	};

	public validateVoiceConnection = async (): Promise<[boolean, discord.EmbedBuilder]> => {
		const [isValid, errorEmbed] = await this.validateGuildMember();
		if (!isValid) return [false, errorEmbed];

		const member = await this.getGuildMember();
		if (!member) return [false, await this.createErrorEmbed('responses.errors.not_in_server')];

		const voiceChannel = member.voice.channel;
		if (!voiceChannel) return [false, await this.createErrorEmbed('responses.errors.no_voice_channel')];

		const guild = this.getGuild()!;
		const botMember = guild.members.me;

		if (!botMember?.permissions.has(this.requiredPermissions)) return [false, await this.createErrorEmbed('responses.errors.need_permissions', { channelName: voiceChannel.name })];
		return !voiceChannel.joinable ? [false, await this.createErrorEmbed('responses.errors.no_permission_join', { channelName: voiceChannel.name })] : [true, await this.createErrorEmbed('')];
	};

	public validateVoiceSameChannel = async (player: magmastream.Player): Promise<[boolean, discord.EmbedBuilder]> => {
		const member = await this.getGuildMember();
		if (!member) return [false, await this.createErrorEmbed('responses.errors.not_in_server')];
		return member.voice.channelId !== player.voiceChannelId ? [false, await this.createErrorEmbed('responses.errors.not_same_voice')] : [true, await this.createErrorEmbed('')];
	};

	public validatePlayerConnection = async (player: magmastream.Player): Promise<[boolean, discord.EmbedBuilder]> => {
		const [isValid, errorEmbed] = await this.validateGuildMember();
		if (!isValid) return [false, errorEmbed];

		const member = await this.getGuildMember();
		if (!member) return [false, await this.createErrorEmbed('responses.errors.not_in_server')];

		const guild = this.getGuild()!;
		const botMember = guild.members.me;
		const isPlayerActuallyConnected = botMember?.voice.channelId === player.voiceChannelId && player.state === 'CONNECTED';

		if (!isPlayerActuallyConnected && player.voiceChannelId) {
			this.client.logger.warn(`[VALIDATOR] Found stale player for guild ${guild.id}, destroying...`);
			player.destroy();
			return [true, await this.createErrorEmbed('')];
		}

		if (isPlayerActuallyConnected) return member.voice.channelId !== player.voiceChannelId ? [false, await this.createErrorEmbed('responses.errors.not_same_voice')] : [true, await this.createErrorEmbed('')];
		return [true, await this.createErrorEmbed('')];
	};

	public validateMusicPlaying = async (player: magmastream.Player): Promise<[boolean, discord.EmbedBuilder]> => {
		return !(await player.queue.getCurrent()) ? [false, await this.createErrorEmbed('responses.errors.no_player')] : [true, await this.createErrorEmbed('')];
	};
}

export class MusicPlayerValidator {
	private readonly client: discord.Client;
	private readonly player: magmastream.Player;
	private readonly ytRegex: RegExp = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
	private localeDetector: LocaleDetector;

	constructor(client: discord.Client, player: magmastream.Player) {
		this.client = client;
		this.player = player;
		this.localeDetector = new LocaleDetector();
	}

	private createErrorEmbed = async (messageKey: string, data?: Record<string, string | number>, interaction?: discord.ChatInputCommandInteraction | discord.ButtonInteraction): Promise<discord.EmbedBuilder> => {
		const locale = interaction ? await this.localeDetector.detectLocale(interaction) : 'en';
		const t = interaction ? await this.localeDetector.getTranslator(interaction) : (key: string) => key;
		return new MusicResponseHandler(this.client).createErrorEmbed(t(messageKey, data), locale);
	};

	public validatePlayerState = async (interaction?: discord.ChatInputCommandInteraction | discord.ButtonInteraction): Promise<[boolean, discord.EmbedBuilder | null]> => {
		if (!(await this.player?.queue?.getCurrent())) return [false, await this.createErrorEmbed('responses.errors.no_player', {}, interaction)];
		return [true, null];
	};

	public validateQueueSize = async (count: number = 1, interaction?: discord.ChatInputCommandInteraction | discord.ButtonInteraction): Promise<[boolean, discord.EmbedBuilder | null]> => {
		const queueSize = await this.player?.queue?.size();
		if (!queueSize) return [false, await this.createErrorEmbed('responses.errors.no_queue', {}, interaction)];
		if (queueSize < count) return [false, await this.createErrorEmbed('responses.errors.queue_too_small', { count: queueSize }, interaction)];
		return [true, null];
	};

	public validatePauseState = async (interaction?: discord.ChatInputCommandInteraction | discord.ButtonInteraction): Promise<[boolean, discord.EmbedBuilder | null]> => {
		if (this.player?.paused) return [false, await this.createErrorEmbed('responses.errors.already_paused', {}, interaction)];
		return [true, null];
	};

	public validateResumeState = async (interaction?: discord.ChatInputCommandInteraction | discord.ButtonInteraction): Promise<[boolean, discord.EmbedBuilder | null]> => {
		if (!this.player?.paused) return [false, await this.createErrorEmbed('responses.errors.already_playing', {}, interaction)];
		return [true, null];
	};

	public validateMusicSource = async (query: string, interaction?: discord.ChatInputCommandInteraction | discord.ButtonInteraction): Promise<[boolean, discord.EmbedBuilder]> => {
		if (this.ytRegex.test(query)) return [false, await this.createErrorEmbed('responses.errors.youtube_not_supported', {}, interaction)];
		return [true, await this.createErrorEmbed('', {}, interaction)];
	};
}
