import discord from "discord.js";
import magmastream from "magmastream";

/**
 * Validates voice channel states and permissions for Discord music commands
 * @class VoiceChannelValidator
 */
class VoiceChannelValidator {
    private readonly client: discord.Client;
    private readonly interaction: discord.ChatInputCommandInteraction;
    private readonly errorColor = "Red";
    private readonly requiredPermissions = [
        discord.PermissionsBitField.Flags.Connect,
        discord.PermissionsBitField.Flags.Speak,
    ];
    private readonly ytLinks = ["youtube", "youtu.be", "youtu"];

    /**
     * Creates an instance of VoiceChannelValidator
     * @param {discord.Client} client - Discord client instance
     * @param {discord.ChatInputCommandInteraction} interaction - Command interaction instance
     */
    constructor(
        client: discord.Client,
        interaction: discord.ChatInputCommandInteraction
    ) {
        this.client = client;
        this.interaction = interaction;
    }

    private createErrorEmbed = (message: string): discord.EmbedBuilder =>
        new discord.EmbedBuilder()
            .setColor(this.errorColor)
            .setDescription(message || " ");

    private getGuildMember = (): discord.GuildMember | undefined =>
        this.interaction.guild?.members.cache.get(this.interaction.user.id);

    private validateGuildMember = async (): Promise<
        [boolean, discord.EmbedBuilder]
    > => {
        const member = this.getGuildMember();
        if (!member)
            return [false, this.createErrorEmbed("You are not in the server")];
        return [true, this.createErrorEmbed("")];
    };

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
}

export { VoiceChannelValidator };
