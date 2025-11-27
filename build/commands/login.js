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
        .setName('login')
        .setDescription('Connect your music account to Pepper')
        .addStringOption((option) => option.setName('account').setDescription('The music service to connect').setRequired(true).addChoices({ name: 'Spotify', value: 'spotify' })),
    execute: async (interaction) => {
        await interaction.deferReply({ flags: discord_js_1.default.MessageFlags.Ephemeral });
        const account = interaction.options.getString('account', true);
        if (account === 'spotify') {
            const existingAccount = await new music_1.SpotifyManager(interaction.client).getAccount(interaction.user.id);
            if (existingAccount) {
                const embed = new discord_js_1.default.EmbedBuilder().setColor('#FF4444').setTitle('❌ Already Logged In').setDescription('You already have a Spotify account connected.\n\nPlease use `/logout spotify` if you want to connect a different account.').setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            const authUrl = music_1.SpotifyManager.generateAuthUrl(interaction.user.id);
            const embed = new discord_js_1.default.EmbedBuilder().setColor('#1DB954').setTitle('🎵 Connect Spotify Account').setDescription('Click the button below to authorize Pepper to access your Spotify account.\n\n**Permissions requested:**\n• Read your playlists').setFooter({ text: 'The authorization link expires in 10 minutes' }).setTimestamp();
            const row = new discord_js_1.default.ActionRowBuilder().addComponents(new discord_js_1.default.ButtonBuilder().setLabel('Connect Spotify').setStyle(discord_js_1.default.ButtonStyle.Link).setURL(authUrl).setEmoji('🎵'));
            await interaction.editReply({ embeds: [embed], components: [row] });
        }
    },
};
