import discord from "discord.js";
import Formatter from "../../utils/format";
import music_guild from "../../events/database/schema/music_guild";
import { SlashCommand, Command, ICommandInfo } from "../../types";

const formatCommandSection = (
    commands: ICommandInfo[],
    prefix: string
): string => {
    return commands
        .map((cmd) => `> **${prefix}${cmd.name}** - ${cmd.description}`)
        .join("\n");
};

const helpCommand: SlashCommand = {
    cooldown: 60,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("help")
        .setDescription("Display a comprehensive list of available commands"),
    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
        await interaction.deferReply();

        const botUser = client.user;
        if (!botUser) return;

        let prefix = client.config.bot.command.prefix;
        if (interaction.guild) {
            const guildData = await music_guild.findOne({ guildId: interaction.guild.id });
            if (guildData?.prefix) {
                prefix = guildData.prefix;
            }
        }

        const embed = new discord.EmbedBuilder()
            .setColor("#5865F2")
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
                    `⚡ **Prefix:** \`${prefix}\``,
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

        const slashCommands: ICommandInfo[] = client.slashCommands.map(
            (command: SlashCommand) => ({
                name: command.data.name,
                description: command.data.description,
            })
        );

        embed.addFields({
            name: "Slash Commands",
            value: formatCommandSection(slashCommands, "/"),
        });

        if (!client.config.bot.command.disable_message) {
            const msgCommands: ICommandInfo[] = client.commands.map(
                (command: Command) => ({
                    name: command.name,
                    description: command.description,
                })
            );

            embed.addFields({
                name: "Legacy Commands",
                value: formatCommandSection(
                    msgCommands,
                    prefix
                ),
            });
        }

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
