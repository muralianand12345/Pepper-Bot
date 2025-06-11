"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const locales_1 = require("../core/locales");
const localizationManager = locales_1.LocalizationManager.getInstance();
const localeDetector = new locales_1.LocaleDetector();
const helpCommand = {
    cooldown: 5,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName("help")
        .setDescription("Display all available commands and their descriptions")
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.help.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.help.description'))
        .addStringOption((option) => option
        .setName("command")
        .setDescription("Get detailed information about a specific command")
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.help.options.command.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.help.options.command.description'))
        .setRequired(false)
        .setAutocomplete(true)),
    autocomplete: async (interaction, client) => {
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
    execute: async (interaction, client) => {
        const t = await localeDetector.getTranslator(interaction);
        const locale = await localeDetector.detectLocale(interaction);
        const responseHandler = new music_1.MusicResponseHandler(client);
        const specificCommand = interaction.options.getString("command");
        if (specificCommand) {
            const command = client.commands.get(specificCommand);
            if (!command) {
                const embed = responseHandler.createErrorEmbed(t('responses.help.command_not_found', { command: specificCommand }), locale);
                await interaction.reply({ embeds: [embed], flags: discord_js_1.default.MessageFlags.Ephemeral });
                return;
            }
            const commandEmbed = new discord_js_1.default.EmbedBuilder()
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
        const categorizeCommands = (commands) => {
            const categories = {
                music: [],
                utility: [],
                other: []
            };
            commands.forEach(cmd => {
                const name = cmd.data.name.toLowerCase();
                if (['play', 'stop', 'pause', 'resume', 'skip', 'loop', 'autoplay', 'filter', 'suggest_songs'].includes(name)) {
                    categories.music.push(cmd);
                }
                else if (['ping', 'help', 'language', 'feedback', 'chart'].includes(name)) {
                    categories.utility.push(cmd);
                }
                else {
                    categories.other.push(cmd);
                }
            });
            return categories;
        };
        const categories = categorizeCommands(commands);
        const formatCommands = (cmds) => {
            if (cmds.length === 0)
                return t('responses.help.no_commands');
            return cmds.map(cmd => `\`/${cmd.data.name}\` - ${cmd.data.description}`).join('\n');
        };
        const embed = new discord_js_1.default.EmbedBuilder()
            .setColor("#5865f2")
            .setTitle(t('responses.help.title'))
            .setDescription(t('responses.help.description', { total: commands.length, prefix: "/" }))
            .setThumbnail(client.user?.displayAvatarURL() || "")
            .setFooter({ text: t('responses.help.footer'), iconURL: client.user?.displayAvatarURL() })
            .setTimestamp();
        if (categories.music.length > 0)
            embed.addFields([{ name: `🎵 ${t('responses.help.categories.music')} (${categories.music.length})`, value: formatCommands(categories.music), inline: false }]);
        if (categories.utility.length > 0)
            embed.addFields([{ name: `🔧 ${t('responses.help.categories.utility')} (${categories.utility.length})`, value: formatCommands(categories.utility), inline: false }]);
        if (categories.other.length > 0)
            embed.addFields([{ name: `📦 ${t('responses.help.categories.other')} (${categories.other.length})`, value: formatCommands(categories.other), inline: false }]);
        const supportButton = responseHandler.getSupportButton(locale);
        await interaction.reply({ embeds: [embed], components: [supportButton] });
    }
};
exports.default = helpCommand;
