import discord from "discord.js";
import Formatter from "../../utils/format";
import { SlashCommand, Command, CommandInfo } from "../../types";

/**
 * Creates a formatted section for commands
 * @param commands - Array of command information
 * @returns Formatted string of commands
 */
const formatCommandSection = (
    commands: CommandInfo[],
    prefix: string
): string => {
    return commands
        .map((cmd) => `> **${prefix}${cmd.name}** - ${cmd.description}`)
        .join("\n");
};

const helpCommand: SlashCommand = {
    cooldown: 10,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("help")
        .setDescription("Display a comprehensive list of available commands"),

    /**
     * Executes the help command and displays a detailed command listing
     * @param {discord.ChatInputCommandInteraction} interaction - The command interaction
     * @param {discord.Client} client - The Discord client instance
     */
    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
        await interaction.deferReply();

        const botUser = client.user;
        if (!botUser) return;

        // Create main embed
        const embed = new discord.EmbedBuilder()
            .setColor("#5865F2") // Discord blurple color
            .setAuthor({
                name: `${botUser.username} Command Guide`,
                iconURL: botUser.displayAvatarURL(),
            })
            .setDescription(
                [
                    `🎵 **${botUser.username}** is your premium music companion, bringing high-quality music playback to your server.`,
                    "",
                    "🎧 **Features:**",
                    "• High-quality music from multiple sources",
                    "• Easy-to-use command system",
                    "• Advanced queue management",
                    "• Server-specific settings",
                    "",
                    "🔗 **Quick Links:**",
                    `[Add to Server](https://discord.com/oauth2/authorize?client_id=${botUser.id}&permissions=8&scope=bot%20applications.commands) • [Support Server](https://discord.gg/XzE9hSbsNb) • [Website](https://pepperbot.muralianand.in/)`,
                    "",
                    `⚡ **Prefix:** \`${
                        client.config.bot.command.disable_message
                            ? "/"
                            : client.config.bot.command.prefix
                    }\``,
                    `⏰ **Uptime:** \`${Formatter.msToTime(
                        client.uptime || 0
                    )}\``,
                    "",
                    "📜 **Available Commands:**",
                ].join("\n")
            )
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp();

        // Process slash commands
        const slashCommands: CommandInfo[] = client.slashCommands.map(
            (command: SlashCommand) => ({
                name: command.data.name,
                description: command.data.description,
            })
        );

        embed.addFields({
            name: "Slash Commands",
            value: formatCommandSection(slashCommands, "/"),
        });

        // Process message commands if enabled
        if (!client.config.bot.command.disable_message) {
            const msgCommands: CommandInfo[] = client.commands.map(
                (command: Command) => ({
                    name: command.name,
                    description: command.description,
                })
            );

            embed.addFields({
                name: "Legacy Commands",
                value: formatCommandSection(
                    msgCommands,
                    client.config.bot.command.prefix
                ),
            });
        }

        // Add tips field
        embed.addFields({
            name: "Pro Tips",
            value: [
                "• Use `/` to see all available slash commands",
                "• Join a voice channel before using music commands",
                "• Check command cooldowns to avoid spam",
                "• Need help? Join our support server!",
            ].join("\n"),
        });

        await interaction.editReply({ embeds: [embed] });
    },
};

export default helpCommand;
