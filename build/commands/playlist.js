"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const commands_1 = require("../core/commands");
const types_1 = require("../types");
const locales_1 = require("../core/locales");
const music_1 = require("../core/music");
const localizationManager = locales_1.LocalizationManager.getInstance();
const describe = (builder, key) => builder
    .setName(localizationManager.translate(`commands.playlist.${key}.name`, 'en'))
    .setDescription(localizationManager.translate(`commands.playlist.${key}.description`, 'en'))
    .setNameLocalizations(localizationManager.getCommandLocalizations(`commands.playlist.${key}.name`))
    .setDescriptionLocalizations(localizationManager.getCommandLocalizations(`commands.playlist.${key}.description`));
const visibilityChoices = ['public', 'private'].map((value) => ({ name: localizationManager.translate(`commands.playlist.choices.${value}`, 'en'), name_localizations: localizationManager.getCommandLocalizations(`commands.playlist.choices.${value}`), value }));
const playlistOption = (option, key = 'options.playlist') => describe(option, key).setRequired(true).setAutocomplete(true);
const positionOption = (option, key) => describe(option, `options.${key}`).setRequired(true).setMinValue(1).setAutocomplete(true);
const playlistCommand = {
    cooldown: 3,
    category: types_1.CommandCategory.MUSIC,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('playlist')
        .setDescription(localizationManager.translate('commands.playlist.description', 'en'))
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.playlist.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.playlist.description'))
        .setContexts(discord_js_1.default.InteractionContextType.Guild)
        .addSubcommand((sub) => describe(sub, 'subcommands.create')
        .addStringOption((option) => describe(option, 'options.name').setRequired(true).setMaxLength(music_1.PLAYLIST_CONFIG.NAME_MAX_LENGTH))
        .addStringOption((option) => describe(option, 'options.visibility').setRequired(false).addChoices(...visibilityChoices)))
        .addSubcommand((sub) => describe(sub, 'subcommands.delete').addStringOption((option) => playlistOption(option)))
        .addSubcommand((sub) => describe(sub, 'subcommands.rename')
        .addStringOption((option) => playlistOption(option))
        .addStringOption((option) => describe(option, 'options.new_name').setRequired(true).setMaxLength(music_1.PLAYLIST_CONFIG.NAME_MAX_LENGTH)))
        .addSubcommand((sub) => describe(sub, 'subcommands.list'))
        .addSubcommand((sub) => describe(sub, 'subcommands.view').addStringOption((option) => playlistOption(option, 'options.playlist_or_code')))
        .addSubcommand((sub) => describe(sub, 'subcommands.share').addStringOption((option) => playlistOption(option)))
        .addSubcommand((sub) => describe(sub, 'subcommands.visibility')
        .addStringOption((option) => playlistOption(option))
        .addStringOption((option) => describe(option, 'options.state').setRequired(true).addChoices(...visibilityChoices)))
        .addSubcommand((sub) => describe(sub, 'subcommands.transfer')
        .addStringOption((option) => playlistOption(option))
        .addUserOption((option) => describe(option, 'options.user').setRequired(true)))
        .addSubcommandGroup((group) => describe(group, 'groups.song')
        .addSubcommand((sub) => describe(sub, 'groups.song.subcommands.add')
        .addStringOption((option) => playlistOption(option))
        .addStringOption((option) => describe(option, 'options.song').setRequired(true).setAutocomplete(true)))
        .addSubcommand((sub) => describe(sub, 'groups.song.subcommands.current').addStringOption((option) => playlistOption(option)))
        .addSubcommand((sub) => describe(sub, 'groups.song.subcommands.remove')
        .addStringOption((option) => playlistOption(option))
        .addIntegerOption((option) => positionOption(option, 'position')))
        .addSubcommand((sub) => describe(sub, 'groups.song.subcommands.move')
        .addStringOption((option) => playlistOption(option))
        .addIntegerOption((option) => positionOption(option, 'from'))
        .addIntegerOption((option) => positionOption(option, 'to')))),
    autocomplete: async (interaction, client) => {
        const autoComplete = new commands_1.AutoComplete(client, interaction);
        await autoComplete.playlistAutocomplete();
    },
    execute: async (interaction, client) => {
        const playlist = new music_1.Playlist(client, interaction);
        await playlist.execute();
    },
};
exports.default = playlistCommand;
