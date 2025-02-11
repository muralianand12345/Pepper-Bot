import discord from "discord.js";
import magmastream from "magmastream";
import { MusicResponseHandler } from "./embed_template";

/**
 * Validates voice channel states and permissions for Discord music commands.
 * This class provides methods to validate various aspects of voice channel interactions,
 * including permissions, connections, and music playback states.
 *
 * @class VoiceChannelValidator
 */
class VoiceChannelValidator {
    private readonly client: discord.Client;
    private readonly interaction: discord.ChatInputCommandInteraction;
    private readonly requiredPermissions = [
        discord.PermissionsBitField.Flags.Connect,
        discord.PermissionsBitField.Flags.Speak,
    ];
    private readonly ytLinks = ["youtube", "youtu.be", "youtu"];

    /**
     * Creates an instance of VoiceChannelValidator
     * @param {discord.Client} client - Discord client instance used for bot interactions
     * @param {discord.ChatInputCommandInteraction} interaction - Command interaction instance containing the command context
     */
    constructor(
        client: discord.Client,
        interaction: discord.ChatInputCommandInteraction
    ) {
        this.client = client;
        this.interaction = interaction;
    }

    /**
     * Creates an error embed with the specified message
     * @param {string} message - The error message to display
     * @returns {discord.EmbedBuilder} A configured Discord embed with the error message
     * @private
     */
    private createErrorEmbed = (message: string): discord.EmbedBuilder =>
        new MusicResponseHandler(this.client).createErrorEmbed(message || " ");

    /**
     * Retrieves the guild member associated with the interaction
     * @returns {discord.GuildMember | undefined} The guild member or undefined if not found
     * @private
     */
    private getGuildMember = (): discord.GuildMember | undefined =>
        this.interaction.guild?.members.cache.get(this.interaction.user.id);

    /**
     * Validates if the user is a member of the guild
     * @returns {Promise<[boolean, discord.EmbedBuilder]>} Tuple containing validation result and error embed if applicable
     * @private
     */
    private validateGuildMember = async (): Promise<
        [boolean, discord.EmbedBuilder]
    > => {
        const member = this.getGuildMember();
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
        return !this.interaction.guild
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

        const member = this.getGuildMember()!;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return [
                false,
                this.createErrorEmbed("You need to be in a voice channel"),
            ];
        }

        const botMember = this.interaction.guild?.members.me;
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
        const member = this.getGuildMember()!;
        return member.voice.channelId !== player.voiceChannel
            ? [
                  false,
                  this.createErrorEmbed(
                      "You are not in the same voice channel as the bot"
                  ),
              ]
            : [true, this.createErrorEmbed("")];
    }

    /**
     * Validates if the music source is supported (currently excludes YouTube)
     * @param {string} query - The music source URL or query
     * @returns {Promise<[boolean, discord.EmbedBuilder]>} Tuple containing validation result and error embed if applicable
     * @public
     */
    public async validateMusicSource(
        query: string
    ): Promise<[boolean, discord.EmbedBuilder]> {
        return this.ytLinks.some((link) => query.includes(link))
            ? [
                  false,
                  this.createErrorEmbed(
                      "We do not support YouTube links or music at this time :("
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

        const member = this.getGuildMember()!;
        return member.voice.channelId !== player.voiceChannel
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
    private readonly interaction: discord.ButtonInteraction;
    private readonly player: any;

    constructor(
        client: discord.Client,
        interaction: discord.ButtonInteraction,
        player: any
    ) {
        this.client = client;
        this.interaction = interaction;
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
}

export { VoiceChannelValidator, MusicPlayerValidator };
