import discord from "discord.js";

import { Command } from "../types";
import { MusicResponseHandler } from "../core/music";
import { LocalizationManager, LocaleDetector } from "../core/locales";

const localizationManager = LocalizationManager.getInstance();
const localeDetector = new LocaleDetector();

const helpCommand: Command = {
    cooldown: 5,
    data: new discord.SlashCommandBuilder()
        .setName("help")
        .setDescription("Display all available commands and their descriptions")
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.help.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.help.description'))
        .addStringOption((option) =>
            option
                .setName("command")
                .setDescription("Get detailed information about a specific command")
                .setNameLocalizations(localizationManager.getCommandLocalizations('commands.help.options.command.name'))
                .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.help.options.command.description'))
                .setRequired(false)
                .setAutocomplete(true)
        ),

    autocomplete: async (interaction: discord.AutocompleteInteraction, client: discord.Client): Promise<void> => {
        const focused = interaction.options.getFocused(true);

        if (focused.name === "command") {
            const commands = Array.from(client.commands.values());
            const query = focused.value.toLowerCase();
            const filtered = commands
                .filter(cmd => cmd.data.name.toLowerCase().includes(query))
                .slice(0, 25)
                .map(cmd => ({ name: `/${cmd.data.name} - ${cmd.data.description}`, value: cmd.data.name }));
            await interaction.respond(filtered);
        }
    },

    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
        const t = await localeDetector.getTranslator(interaction);
        const locale = await localeDetector.detectLocale(interaction);
        const responseHandler = new MusicResponseHandler(client);

        const specificCommand = interaction.options.getString("command");

        if (specificCommand) {
            const command = client.commands.get(specificCommand);

            if (!command) {
                const embed = responseHandler.createErrorEmbed(t('responses.help.command_not_found', { command: specificCommand }), locale);
                await interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
                return;
            }

            const commandEmbed = new discord.EmbedBuilder()
                .setColor("#5865f2")
                .setTitle(`📖 /${command.data.name}`)
                .setDescription(command.data.description)
                .addFields([
                    { name: t('responses.help.cooldown'), value: command.cooldown ? `${command.cooldown}s` : t('responses.help.no_cooldown'), inline: true },
                    { name: t('responses.help.permissions'), value: command.owner ? t('responses.help.owner_only') : command.userPerms ? command.userPerms.join(", ") : t('responses.help.none'), inline: true }
                ])
                .setFooter({ text: t('responses.help.command_footer'), iconURL: client.user?.displayAvatarURL() })
                .setTimestamp();

            const apiData = command.data.toJSON();
            if (apiData.options && apiData.options.length > 0) {
                const optionsText = apiData.options.map((option) => `\`${option.name}\` - ${option.description}`).join('\n');
                commandEmbed.addFields([{ name: t('responses.help.options'), value: optionsText.length > 1024 ? optionsText.substring(0, 1021) + "..." : optionsText, inline: false }]);
            }

            await interaction.reply({ embeds: [commandEmbed] });
            return;
        }

        const commands = Array.from(client.commands.values());

        const categorizeCommands = (commands: Command[]) => {
            const categories = {
                music: [] as Command[],
                utility: [] as Command[],
                other: [] as Command[]
            };

            commands.forEach(cmd => {
                const name = cmd.data.name.toLowerCase();
                if (['play', 'stop', 'pause', 'resume', 'skip', 'loop', 'autoplay', 'filter', 'suggest_songs'].includes(name)) {
                    categories.music.push(cmd);
                } else if (['ping', 'help', 'language', 'feedback', 'chart'].includes(name)) {
                    categories.utility.push(cmd);
                } else {
                    categories.other.push(cmd);
                }
            });

            return categories;
        };

        const categories = categorizeCommands(commands);
        const formatCommands = (cmds: Command[]): string => {
            if (cmds.length === 0) return t('responses.help.no_commands');
            return cmds.map(cmd => `\`/${cmd.data.name}\` - ${cmd.data.description}`).join('\n');
        };

        const embed = new discord.EmbedBuilder()
            .setColor("#5865f2")
            .setTitle(t('responses.help.title'))
            .setDescription(t('responses.help.description', { total: commands.length, prefix: "/" }))
            .setThumbnail(client.user?.displayAvatarURL() || "")
            .setFooter({ text: t('responses.help.footer'), iconURL: client.user?.displayAvatarURL() })
            .setTimestamp();

        if (categories.music.length > 0) embed.addFields([{ name: `🎵 ${t('responses.help.categories.music')} (${categories.music.length})`, value: formatCommands(categories.music), inline: false }]);
        if (categories.utility.length > 0) embed.addFields([{ name: `🔧 ${t('responses.help.categories.utility')} (${categories.utility.length})`, value: formatCommands(categories.utility), inline: false }]);
        if (categories.other.length > 0) embed.addFields([{ name: `📦 ${t('responses.help.categories.other')} (${categories.other.length})`, value: formatCommands(categories.other), inline: false }]);

        const supportButton = responseHandler.getSupportButton(locale);

        await interaction.reply({ embeds: [embed], components: [supportButton] });
    }
};

export default helpCommand;