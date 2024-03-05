const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');

const musicUserModal = require("../../events/database/modals/musicUser.js");
const musicServerModal = require("../../events/database/modals/musicServerStats.js");

const { hyperlink } = require("../../events/client/commands/functions/format.js");

module.exports = {
    cooldown: 10000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('chart')
        .setDescription("Guild or User music chart")
        .setDMPermission(true)
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Select the category of chart')
                .setRequired(true)
                .addChoices(
                    { name: 'User', value: 'chart_user' },
                    { name: 'Guild', value: 'chart_guild' },
                    { name: 'Global', value: 'chart_global' }
                )
        ),
    async execute(interaction, client) {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        if (interaction.options.getString("category") === "chart_user") {

            var musicData = await musicUserModal.findOne({
                userID: interaction.user.id
            });

            if (!musicData) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("You have no music stats")],
                    ephemeral: true,
                });
            }

            const songs = musicData.songs;
            const songsNo = musicData.songsNo;

            songs.sort((a, b) => {
                return b.times - a.times;
            });

            songs.splice(5);

            const songsList = songs.map((song) => {
                return `**${hyperlink(song.name, song.url)}** - ${song.times} times`;
            });

            const songsListString = songsList.join("\n");

            const embed = new EmbedBuilder()
                .setColor(client.config.music.embedcolor)
                .setAuthor({ name: 'User Music Profile', iconURL: client.user.displayAvatarURL() })
                .setThumbnail(interaction.user.displayAvatarURL())
                .setDescription(`\`${interaction.user.tag}\`'s **Music Profile**\n**Total Songs Played:** ${songsNo}\n\n${songsListString}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });

        }

        if (interaction.options.getString("category") === "chart_guild") {

            var musicData = await musicServerModal.findOne({
                guildID: interaction.guild.id
            });

            if (!musicData) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("This server has no music stats")],
                    ephemeral: true,
                });
            }

            const songs = musicData.songs;
            const songsNo = musicData.songsNo;

            //get top 5 songs

            songs.sort((a, b) => {
                return b.times - a.times;
            });

            songs.splice(5);

            const songsList = songs.map((song) => {
                return `**${hyperlink(song.name, song.url)}** - ${song.times} times`;
            });

            const songsListString = songsList.join("\n");

            const embed = new EmbedBuilder()
                .setColor(client.config.music.embedcolor)
                .setAuthor({ name: 'Guild Music Profile', iconURL: client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL())
                .setDescription(`\`${interaction.guild.name}\`'s **Music Profile**\n**Total Songs Played:** ${songsNo}\n\n${songsListString}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        if (interaction.options.getString("category") === "chart_global") {

            var musicData = await musicServerModal.find();

            if (!musicData) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("No music stats found")],
                    ephemeral: true,
                });
            }

            const songs = [];
            musicData.map((server) => {
                server.songs.forEach((song) => {
                    songs.push(song);
                });
            });

            const songsNo = musicData.map((server) => {
                return server.songsNo;
            });

            songs.sort((a, b) => {
                return b.times - a.times;
            });

            songs.splice(5);

            const songsList = songs.map((song) => {
                return `**${hyperlink(song.name, song.url)}** - ${song.times} times`;
            });

            const songsListString = songsList.join("\n");

            const embed = new EmbedBuilder()
                .setColor(client.config.music.embedcolor)
                .setAuthor({ name: 'Global Music Profile', iconURL: client.user.displayAvatarURL() })
                .setDescription(`**Global Music Profile**\n**Total Songs Played:** ${songsNo}\n\n${songsListString}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });
        }
    }
}