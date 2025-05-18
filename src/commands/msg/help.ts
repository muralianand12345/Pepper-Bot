import discord from "discord.js";
import Formatter from "../../utils/format";
import music_guild from "../../events/database/schema/music_guild";
import { SlashCommand, Command, CommandInfo } from "../../types";

const formatCommandSection = (
    commands: CommandInfo[],
    prefix: string
): string => {
    return commands
        .map((cmd) => `> **${prefix}${cmd.name}** - ${cmd.description}`)
        .join("\n");
};

const command: Command = {
    name: "help",
    description: "Display a comprehensive list of available commands",
    cooldown: 60,
    owner: false,

    execute: async (
        client: discord.Client,
        message: discord.Message,
        args: Array<string>
    ) => {
        try {
            const botUser = client.user;
            if (!botUser) return;

            let prefix = client.config.bot.command.prefix;
            if (message.guild) {
                const guildData = await music_guild.findOne({ guildId: message.guild.id });
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
                    text: `Requested by ${message.author.tag}`,
                    iconURL: message.author.displayAvatarURL(),
                })
                .setTimestamp();

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

            await message.reply({ embeds: [embed] });
        } catch (error) {
            client.logger.error(`[HELP] Error executing help command: ${error}`);
            await message.reply("An error occurred while processing your request.");
        }
    },
};

export default command;