import discord from "discord.js";
import magmastream from "magmastream";
import { MusicResponseHandler } from "./embed_template";

/**
 * Command context that can be either an interaction or a message
 */
type CommandContext =
    | { type: 'interaction'; interaction: discord.ChatInputCommandInteraction }
    | { type: 'message'; message: discord.Message };

/**
 * Validates voice channel states and permissions for Discord music commands.
 * This class provides methods to validate various aspects of voice channel interactions,
 * including permissions, connections, and music playback states.
 *
 * @class VoiceChannelValidator
 */
class VoiceChannelValidator {
    private readonly client: discord.Client;
    private readonly context: CommandContext;
    private readonly requiredPermissions = [
        discord.PermissionsBitField.Flags.Connect,
        discord.PermissionsBitField.Flags.Speak,
    ];

    /**
     * Creates an instance of VoiceChannelValidator with interaction support
     * @param {discord.Client} client - Discord client instance used for bot interactions
     * @param {discord.ChatInputCommandInteraction} interaction - Command interaction instance containing the command context
     */
    constructor(client: discord.Client, interaction: discord.ChatInputCommandInteraction);

    /**
     * Creates an instance of VoiceChannelValidator with message support
     * @param {discord.Client} client - Discord client instance used for bot interactions
     * @param {discord.Message} message - Message instance containing the command context
     */
    constructor(client: discord.Client, message: discord.Message);

    /**
     * Implementation of the constructor
     * @param {discord.Client} client - Discord client instance used for bot interactions
     * @param {discord.ChatInputCommandInteraction | discord.Message} contextValue - Command context
     */
    constructor(
        client: discord.Client,
        contextValue: discord.ChatInputCommandInteraction | discord.Message
    ) {
        this.client = client;

        if (contextValue instanceof discord.ChatInputCommandInteraction) {
            this.context = { type: 'interaction', interaction: contextValue };
        } else {
            this.context = { type: 'message', message: contextValue };
        }
    }

    /**
     * Gets the guild from the context
     * @returns {discord.Guild | null} The guild or null if not found
     * @private
     */
    private getGuild = (): discord.Guild | null => {
        if (this.context.type === 'interaction') {
            return this.context.interaction.guild;
        } else {
            return this.context.message.guild;
        }
    };

    /**
     * Gets the user ID from the context
     * @returns {string} The user ID
     * @private
     */
    private getUserId = (): string => {
        if (this.context.type === 'interaction') {
            return this.context.interaction.user.id;
        } else {
            return this.context.message.author.id;
        }
    };

    /**
     * Creates an error embed with the specified message
     * @param {string} message - The error message to display
     * @returns {discord.EmbedBuilder} A configured Discord embed with the error message
     * @private
     */
    private createErrorEmbed = (message: string): discord.EmbedBuilder =>
        new MusicResponseHandler(this.client).createErrorEmbed(message || " ");

    /**
     * Retrieves the guild member associated with the context
     * @returns {Promise<discord.GuildMember | undefined>} The guild member or undefined if not found
     * @private
     */
    private getGuildMember = async (): Promise<discord.GuildMember | undefined> => {
        const guild = this.getGuild();
        const userId = this.getUserId();

        if (!guild) return undefined;

        try {
            const member = guild.members.cache.get(userId) || await guild.members.fetch(userId);
            return member;
        } catch (error) {
            this.client.logger.error(`[VALIDATOR] Failed to fetch guild member: ${error}`);
            return undefined;
        }
    };

    /**
     * Validates if the user is a member of the guild
     * @returns {Promise<[boolean, discord.EmbedBuilder]>} Tuple containing validation result and error embed if applicable
     * @private
     */
    private validateGuildMember = async (): Promise<
        [boolean, discord.EmbedBuilder]
    > => {
        const member = await this.getGuildMember();
        if (!member)
            return [false, this.createErrorEmbed("You are not in the server")];
        return [true, this.createErrorEmbed("")];
    };

    /**
     * Validates if the command is being used in a guild context
     * @returns {Promise<[boolean, discord.EmbedBuilder]>} Tuple containing validation result and error embed if applicable
     * @public
     */
    public async validateGuildContext(): Promise<
        [boolean, discord.EmbedBuilder]
    > {
        return !this.getGuild()
            ? [
                false,
                this.createErrorEmbed(
                    "This command can only be used in a server"
                ),
            ]
            : [true, this.createErrorEmbed("")];
    }

    /**
     * Validates voice channel connection state and permissions
     * @returns {Promise<[boolean, discord.EmbedBuilder]>} Tuple containing validation result and error embed if applicable
     * @public
     */
    public async validateVoiceConnection(): Promise<
        [boolean, discord.EmbedBuilder]
    > {
        const [isValid, errorEmbed] = await this.validateGuildMember();
        if (!isValid) return [false, errorEmbed];

        const member = await this.getGuildMember();
        if (!member) {
            return [
                false,
                this.createErrorEmbed("Failed to find your guild member information"),
            ];
        }

        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return [
                false,
                this.createErrorEmbed("You need to be in a voice channel"),
            ];
        }

        const guild = this.getGuild()!;
        const botMember = guild.members.me;

        if (!botMember?.permissions.has(this.requiredPermissions)) {
            return [
                false,
                this.createErrorEmbed(
                    `I need the permissions to \`Join\` and \`Speak\` in <#${voiceChannel.id}>`
                ),
            ];
        }

        return !voiceChannel.joinable
            ? [
                false,
                this.createErrorEmbed(
                    `I don't have permission to join <#${voiceChannel.id}>`
                ),
            ]
            : [true, this.createErrorEmbed("")];
    }

    /**
     * Validates if the user is in the same voice channel as the bot
     * @param {magmastream.Player} player - The music player instance
     * @returns {Promise<[boolean, discord.EmbedBuilder]>} Tuple containing validation result and error embed if applicable
     * @public
     */
    public async validateVoiceSameChannel(
        player: magmastream.Player
    ): Promise<[boolean, discord.EmbedBuilder]> {
        const member = await this.getGuildMember();
        if (!member) {
            return [
                false,
                this.createErrorEmbed("Failed to find your guild member information"),
            ];
        }

        return member.voice.channelId !== player.voiceChannelId
            ? [
                false,
                this.createErrorEmbed(
                    "You are not in the same voice channel as the bot"
                ),
            ]
            : [true, this.createErrorEmbed("")];
    }

    /**
     * Validates if the player is properly connected and user is in the same channel
     * @param {magmastream.Player} player - The music player instance
     * @returns {Promise<[boolean, discord.EmbedBuilder]>} Tuple containing validation result and error embed if applicable
     * @public
     */
    public async validatePlayerConnection(
        player: magmastream.Player
    ): Promise<[boolean, discord.EmbedBuilder]> {
        const [isValid, errorEmbed] = await this.validateGuildMember();
        if (!isValid) return [false, errorEmbed];

        const member = await this.getGuildMember();
        if (!member) {
            return [
                false,
                this.createErrorEmbed("Failed to find your guild member information"),
            ];
        }

        return member.voice.channelId !== player.voiceChannelId
            ? [
                false,
                this.createErrorEmbed(
                    "You are not in the same voice channel as the bot"
                ),
            ]
            : [true, this.createErrorEmbed("")];
    }

    /**
     * Validates if music is currently playing in the voice channel
     * @param {magmastream.Player} player - The music player instance
     * @returns {Promise<[boolean, discord.EmbedBuilder]>} Tuple containing validation result and error embed if applicable
     * @public
     */
    public async validateMusicPlaying(
        player: magmastream.Player
    ): Promise<[boolean, discord.EmbedBuilder]> {
        return !player.queue.current
            ? [
                false,
                this.createErrorEmbed("There is no music currently playing"),
            ]
            : [true, this.createErrorEmbed("")];
    }
}

/**
 * Validates music player state and queue operations
 * @class MusicPlayerValidator
 */
class MusicPlayerValidator {
    private readonly client: discord.Client;
    private readonly player: any;
    private readonly ytRegex: RegExp = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;

    constructor(
        client: discord.Client,
        player: any
    ) {
        this.client = client;
        this.player = player;
    }

    /**
     * Creates an error embed with the specified message
     * @param {string} message - Error message to display
     * @returns {discord.EmbedBuilder} Configured error embed
     */
    private createErrorEmbed(message: string): discord.EmbedBuilder {
        return new MusicResponseHandler(this.client).createErrorEmbed(message);
    }

    /**
     * Validates if the player exists and is playing
     * @returns {Promise<boolean>} Whether the player is valid
     */
    public async validatePlayerState(): Promise<
        [boolean, discord.EmbedBuilder | null]
    > {
        if (!this.player?.queue?.current) {
            return [false, this.createErrorEmbed("There is no music playing")];
        }
        return [true, null];
    }

    /**
     * Validates the queue size against a count
     * @param {number} count - Number of tracks to validate against
     * @returns {Promise<[boolean, discord.EmbedBuilder | null]>} Validation result and error if any
     */
    public async validateQueueSize(
        count: number = 1
    ): Promise<[boolean, discord.EmbedBuilder | null]> {
        const queueSize = this.player?.queue?.size;

        if (!queueSize) {
            return [
                false,
                this.createErrorEmbed("There are no songs in the queue"),
            ];
        }

        if (queueSize < count) {
            return [
                false,
                this.createErrorEmbed(
                    `There are only ${queueSize} songs in the queue`
                ),
            ];
        }

        return [true, null];
    }

    /**
     * Validates player pause state
     * @returns {Promise<[boolean, discord.EmbedBuilder | null]>} Validation result and error if any
     */
    public async validatePauseState(): Promise<
        [boolean, discord.EmbedBuilder | null]
    > {
        if (this.player?.paused) {
            return [
                false,
                this.createErrorEmbed("The music is already paused"),
            ];
        }
        return [true, null];
    }

    /**
     * Validates player resume state
     * @returns {Promise<[boolean, discord.EmbedBuilder | null]>} Validation result and error if any
     */
    public async validateResumeState(): Promise<
        [boolean, discord.EmbedBuilder | null]
    > {
        if (!this.player?.paused) {
            return [
                false,
                this.createErrorEmbed("The music is already playing"),
            ];
        }
        return [true, null];
    }

    /**
     * Validates if the music source is supported (currently excludes YouTube)
     * @param {string} query - The music source URL or query
     * @returns {Promise<[boolean, discord.EmbedBuilder]>} Validation result and error if any
     */
    public async validateMusicSource(
        query: string
    ): Promise<[boolean, discord.EmbedBuilder]> {
        if (this.ytRegex.test(query)) {
            return [
                false,
                this.createErrorEmbed(
                    "We do not support YouTube links or music at this time :("
                ),
            ];
        }
        return [true, this.createErrorEmbed("")];
    }
}

export { VoiceChannelValidator, MusicPlayerValidator };