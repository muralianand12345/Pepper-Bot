import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { SlashCommand } from "../../types";

import playlistModel from "../../events/database/schema/customPlaylist";
import { getAutoComplete } from "../../utils/autoComplete";
import { Track } from "magmastream";

const playlist: SlashCommand = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription("Create a playlist")
        .setDMPermission(false)
        .addStringOption(option => option
            .setName('name')
            .setDescription('Playlist Name')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(option => option
            .setName('song')
            .setDescription('Song Name/URL')
            .setRequired(true)
            .setAutocomplete(true)
        ),
    autocomplete: async (interaction, client) => {
        if (interaction.options.getString("song")) {
            const focusedValue = interaction.options.getFocused();
            let choices = [];
            try {
                if (!focusedValue) {
                    choices = ["Please enter a search term or URL"];
                } else {
                    choices = await getAutoComplete(focusedValue);
                }
                await interaction.respond(choices.map((choice: any) => ({ name: choice, value: choice })));
            } catch (e: Error | any) {
                client.logger.error(`An error occurred while fetching autocomplete suggestions.\nError: ${e.message}`);
            }
        } else if (interaction.options.getString("name")) {
            let choices = [];
            try {
                const focusedValue = interaction.options.getFocused();
                if (!focusedValue) {
                    choices = ["Please enter a playlist name"];
                } else {
                    const playlistData = await playlistModel.findOne({ userId: interaction.user.id });
                    if (playlistData) {
                        choices = playlistData.playlist.map((playlist: any) => playlist.name);
                    } else {
                        choices = ["Create a new playlist"];
                    }
                }
                await interaction.respond(choices.map((choice: any) => ({ name: choice, value: choice })));

            } catch (e: Error | any) {
                client.logger.error(`An error occurred while fetching autocomplete suggestions.\nError: ${e.message}`);
            }
        }
    },
    execute: async (interaction, client) => {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        const name = interaction.options.getString('name');

        await interaction.deferReply({ ephemeral: true });

        if (!name) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Please enter a playlist name")] });
        if (name.length > 50) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Playlist name is too long")] });

        var playlistData = await playlistModel.findOne({ userId: interaction.user.id });

        if (!playlistData) {
            playlistData = new playlistModel({
                userId: interaction.user.id,
                playlist: [{
                    name: name,
                    songs: []
                }]
            });
        }

        const song = interaction.options.getString('song');
        if (!song) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Please enter a song name or URL")] });

        client.manager.search(song, interaction.user).then(async (res: any) => {

            if (!res) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Error occured try again! | 1")] });
            if (!playlistData) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Error occured try again! | 2")] });

            switch (res.loadType) {
                case "empty": {
                    return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("No results found")] });
                }

                case "track":
                case "search": {
                    let track: Track = res.tracks[0];
                    let playlist = playlistData.playlist.find(p => p.name == name);

                    if (!playlist) {
                        playlistData.playlist.push({
                            name: name,
                            songs: [{ title: track.title, url: track.uri }]
                        });
                    } else {
                        playlist.songs.push({ title: track.title, url: track.uri });
                    }

                    await playlistData.save().then(async () => {
                        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`Song ${track.title} added to playlist ${name}`)] });
                    }).catch(async (e: Error) => {
                        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("An error occured while adding song to playlist")] });
                    });
                    break;
                }

                case "playlist": {
                    res.playlist?.tracks.forEach(async (track: Track) => {
                        let playlist = playlistData?.playlist.find(p => p.name == name);

                        if (!playlist) {
                            playlistData?.playlist.push({
                                name: name,
                                songs: [{ title: track.title, url: track.uri }]
                            });
                        } else {
                            playlist.songs.push({ title: track.title, url: track.uri });
                        }
                    });

                    await playlistData.save().then(async () => {
                        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`Playlist ${name} added to playlist`)] });
                    }).catch(async (e: Error) => {
                        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("An error occured while adding playlist to playlist")] });
                    });
                    break;
                }
            }
        });
    }
}

export default playlist;