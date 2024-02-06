const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField
} = require('discord.js');

const { getAutocompleteSearch } = require('../../events/client/commands/functions/autoComplete.js');
const { musicrow } = require('../../events/client/music/musicUtls/musicEmbed.js');
const { msToTime, textLengthOverCut, hyperlink } = require('../../events/client/commands/functions/format.js');

const userPlayListModal = require("../../events/database/modals/userPlayList.js");

module.exports = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription("Create your own playlist")
        .setDMPermission(false)
        .addSubcommand((subcommand) => subcommand
            .setName("add")
            .setDescription("Create and add a song to your playlist")
            .addStringOption((option) => option
                .setName("name")
                .setDescription("Playlist Name")
                .setRequired(true)
            )
            .addStringOption((option) => option
                .setName("song")
                .setDescription("Song Name/URL")
                .setRequired(true)
                .setAutocomplete(true)
            )
        ),

    async autocomplete(interaction, client) {
        const focusedValue = interaction.options.getFocused();
        let choices = [];
        try {
            if (!focusedValue) {
                choices = ["Please enter a search term or URL"];
            } else {
                choices = await getAutocompleteSearch(focusedValue);
            }
            await interaction.respond(choices.map((choice) => ({ name: choice, value: choice })));
        } catch (e) {
            client.logger.error(`An error occurred while fetching autocomplete suggestions.\nError: ${e.message}`);
        }
    },

    async execute(interaction, client) {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        if (interaction.options.getSubcommand() === "add") {

            const query = interaction.options.getString('song');
            const name = interaction.options.getString('name');

            if (query == "Please enter a search term or URL") {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("Please enter a search term or URL")],
                    ephemeral: true,
                });
            }

            if (query.includes("youtu.be") || query.includes("youtube") || query.includes("youtu")) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("We do not support YouTube links or music at this time")],
                    ephemeral: true,
                });
            }

            var playlist = await userPlayListModal.findOne({
                userId: interaction.user.id
            });

            if (!playlist) {
                playlist = new userPlayListModal({
                    userId: interaction.user.id
                });
                await playlist.save();
            }

            const res = client.manager.search(query, interaction.user);

            if (res.loadType != "NO_MATCHES") {
                if (res.loadType == "TRACK_LOADED") {

                    var song = res.tracks[0];

                    var songData = {
                        name: song.title,
                        url: song.uri
                    }

                    var playlistData = {
                        name: name,
                        active: true,
                        songs: [songData]
                    }

                    playlist.playlist.push(playlistData);
                    await playlist.save();

                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('Green').setDescription(`Added ${song.title} to your playlist`)],
                        ephemeral: true,
                    });

                } else if (res.loadType == "PLAYLIST_LOADED") {

                    for (let i = 0; i < res.tracks.length; i++) {
                        var songData = {
                            name: res.tracks[i].title,
                            url: res.tracks[i].uri
                        }
                        playlist.playlist.push(songData);
                    }
                    await playlist.save();

                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('Green').setDescription(`Added ${res.tracks.length} songs to your playlist`)],
                        ephemeral: true,
                    });

                } else if (res.loadType == "SEARCH_RESULT") {

                    var song = res.tracks[0];

                    var songData = {
                        name: song.title,
                        url: song.uri
                    }

                    var playlistData = {
                        name: name,
                        active: true,
                        songs: [songData]
                    }

                    playlist.playlist.push(playlistData);
                    await playlist.save();

                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('Green').setDescription(`Added ${song.title} to your playlist`)],
                        ephemeral: true,
                    });

                } else if (res.loadType == "LOAD_FAILED") {

                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('Red').setDescription(`Failed to load ${song.title}`)],
                        ephemeral: true,
                    });

                } else {

                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('Red').setDescription(`No results found for ${query}`)],
                        ephemeral: true,
                    });

                }

            } else {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription(`No results found for ${query}`)],
                    ephemeral: true,
                });
            }
        }
    }
}