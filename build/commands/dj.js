"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
exports.default = {
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('dj')
        .setDescription('Manage DJ role for music commands')
        .addRoleOption((option) => option.setName('role').setDescription('The role to set/remove as DJ role (leave empty to create/disable)').setRequired(false))
        .setDefaultMemberPermissions(discord_js_1.default.PermissionFlagsBits.ManageRoles)
        .setContexts(discord_js_1.default.InteractionContextType.Guild),
    execute: async (interaction, client) => {
        const music = new music_1.Music(client, interaction);
        await music.dj();
    },
};
