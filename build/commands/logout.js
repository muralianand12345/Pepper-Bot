"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const music_1 = require("../core/music");
exports.default = {
    cooldown: 15,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('logout')
        .setDescription('Disconnect your music account from Pepper')
        .addStringOption((option) => option.setName('account').setDescription('The music service to disconnect').setRequired(true).addChoices({ name: 'Spotify', value: 'spotify' })),
    execute: async (interaction) => {
        await interaction.deferReply({ flags: discord_js_1.default.MessageFlags.Ephemeral });
        const account = interaction.options.getString('account', true);
        if (account === 'spotify') {
            const existingAccount = await new music_1.SpotifyManager(interaction.client).getAccount(interaction.user.id);
            if (!existingAccount) {
                const embed = new discord_js_1.default.EmbedBuilder().setColor('#FF4444').setTitle('❌ Not Logged In').setDescription("You don't have a Spotify account connected.\n\nUse `/login spotify` to connect your account.").setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            const removed = await new music_1.SpotifyManager(interaction.client).removeAccount(interaction.user.id);
            if (!removed) {
                const embed = new discord_js_1.default.EmbedBuilder().setColor('#FF4444').setTitle('❌ Error').setDescription('Failed to disconnect your Spotify account. Please try again later.').setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            const embed = new discord_js_1.default.EmbedBuilder().setColor('#1DB954').setTitle('✅ Account Disconnected').setDescription('Your Spotify account has been successfully disconnected from Pepper.\n\nYou can reconnect anytime using `/login spotify`.').setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    },
};
