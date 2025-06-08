import discord from "discord.js";
import magmastream from "magmastream";

import { MusicResponseHandler } from "./response";


export class VoiceChannelValidator {
    private readonly client: discord.Client;
    private readonly interaction: discord.ChatInputCommandInteraction | discord.ButtonInteraction;
    private readonly requiredPermissions = [
        discord.PermissionsBitField.Flags.Connect,
        discord.PermissionsBitField.Flags.Speak,
    ];

    constructor(client: discord.Client, interaction: discord.ChatInputCommandInteraction | discord.ButtonInteraction) {
        this.client = client;
        this.interaction = interaction;
    };

    private getGuild = (): discord.Guild | null => {
        return this.interaction.guild || null;
    };

    private getUserId = (): string => {
        return this.interaction.user.id;
    };

    private createErrorEmbed = (message: string): discord.EmbedBuilder => new MusicResponseHandler(this.client).createErrorEmbed(message || " ");

    private getGuildMember = async (): Promise<discord.GuildMember | undefined> => {
        const guild = this.getGuild();
        const userId = this.getUserId();

        if (!guild) return undefined;

        try {
            return guild.members.cache.get(userId) || await guild.members.fetch(userId);
        } catch (error) {
            this.client.logger.error(`[VALIDATOR] Failed to fetch guild member: ${error}`);
            return undefined;
        }
    };

    private validateGuildMember = async (): Promise<[boolean, discord.EmbedBuilder]> => {
        const member = await this.getGuildMember();
        if (!member) return [false, this.createErrorEmbed("You are not in the server")];
        return [true, this.createErrorEmbed("")];
    };

    public async validateGuildContext(): Promise<[boolean, discord.EmbedBuilder]> {
        return !this.getGuild()
            ? [false, this.createErrorEmbed("This command can only be used in a server")]
            : [true, this.createErrorEmbed("")];
    };

    public async validateVoiceConnection(): Promise<[boolean, discord.EmbedBuilder]> {
        const [isValid, errorEmbed] = await this.validateGuildMember();
        if (!isValid) return [false, errorEmbed];

        const member = await this.getGuildMember();
        if (!member) return [false, this.createErrorEmbed("Failed to find your guild member information")];

        const voiceChannel = member.voice.channel;
        if (!voiceChannel) return [false, this.createErrorEmbed("You need to be in a voice channel")];

        const guild = this.getGuild()!;
        const botMember = guild.members.me;

        if (!botMember?.permissions.has(this.requiredPermissions)) return [false, this.createErrorEmbed(`I need the permissions to \`Join\` and \`Speak\` in <#${voiceChannel.id}>`)];

        return !voiceChannel.joinable
            ? [false, this.createErrorEmbed(`I don't have permission to join <#${voiceChannel.id}>`)]
            : [true, this.createErrorEmbed("")];
    };

    public async validateVoiceSameChannel(player: magmastream.Player): Promise<[boolean, discord.EmbedBuilder]> {
        const member = await this.getGuildMember();
        if (!member) return [false, this.createErrorEmbed("Failed to find your guild member information")];

        return member.voice.channelId !== player.voiceChannelId
            ? [false, this.createErrorEmbed("You are not in the same voice channel as the bot")]
            : [true, this.createErrorEmbed("")];
    };

    public async validatePlayerConnection(player: magmastream.Player): Promise<[boolean, discord.EmbedBuilder]> {
        const [isValid, errorEmbed] = await this.validateGuildMember();
        if (!isValid) return [false, errorEmbed];

        const member = await this.getGuildMember();
        if (!member) return [false, this.createErrorEmbed("Failed to find your guild member information")];

        return member.voice.channelId !== player.voiceChannelId
            ? [false, this.createErrorEmbed("You are not in the same voice channel as the bot")]
            : [true, this.createErrorEmbed("")];
    };

    public async validateMusicPlaying(player: magmastream.Player): Promise<[boolean, discord.EmbedBuilder]> {
        return !player.queue.current
            ? [false, this.createErrorEmbed("There is no music currently playing")]
            : [true, this.createErrorEmbed("")];
    };
};

export class MusicPlayerValidator {
    private readonly client: discord.Client;
    private readonly player: magmastream.Player;
    private readonly ytRegex: RegExp = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;

    constructor(client: discord.Client, player: magmastream.Player) {
        this.client = client;
        this.player = player;
    };

    private createErrorEmbed = (message: string): discord.EmbedBuilder => new MusicResponseHandler(this.client).createErrorEmbed(message);

    public validatePlayerState = async (): Promise<[boolean, discord.EmbedBuilder | null]> => {
        if (!this.player?.queue?.current) return [false, this.createErrorEmbed("There is no music playing")]
        return [true, null];
    };

    public validateQueueSize = async (count: number = 1): Promise<[boolean, discord.EmbedBuilder | null]> => {
        const queueSize = this.player?.queue?.size;
        if (!queueSize) return [false, this.createErrorEmbed("There are no songs in the queue"),];
        if (queueSize < count) return [false, this.createErrorEmbed(`There are only ${queueSize} songs in the queue`)];
        return [true, null];
    };

    public validatePauseState = async (): Promise<[boolean, discord.EmbedBuilder | null]> => {
        if (this.player?.paused) return [false, this.createErrorEmbed("The music is already paused")];
        return [true, null];
    };

    public validateResumeState = async (): Promise<[boolean, discord.EmbedBuilder | null]> => {
        if (!this.player?.paused) return [false, this.createErrorEmbed("The music is already playing")]
        return [true, null];
    };

    public validateMusicSource = async (query: string): Promise<[boolean, discord.EmbedBuilder]> => {
        if (this.ytRegex.test(query)) return [false, this.createErrorEmbed("We do not support YouTube links or music at this time :(")];
        return [true, this.createErrorEmbed("")];
    };
};