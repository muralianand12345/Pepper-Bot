"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
const types_1 = require("../types");
const locales_1 = require("../core/locales");
const localizationManager = locales_1.LocalizationManager.getInstance();
const djCommand = {
    cooldown: 120,
    category: types_1.CommandCategory.UTILITY,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('dj')
        .setDescription('Manage DJ role for music commands')
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.dj.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.dj.description'))
        .addRoleOption((option) => option.setName('role').setDescription('The role to set/remove as DJ role (leave empty to create/disable)').setNameLocalizations(localizationManager.getCommandLocalizations('commands.dj.options.role.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.dj.options.role.description')).setRequired(false))
        .setDefaultMemberPermissions(discord_js_1.default.PermissionFlagsBits.ManageRoles)
        .setContexts(discord_js_1.default.InteractionContextType.Guild),
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.dj();
    },
};
exports.default = djCommand;
