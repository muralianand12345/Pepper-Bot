import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from "discord.js";
import { SlashCommand } from "../../types";

import playlistModel from "../../events/database/schema/customPlaylist";
import { musicrow } from "../../utils/musicEmbed";
import { msToTime, textLengthOverCut, hyperlink } from "../../utils/format";
import { getAutoComplete } from "../../utils/autoComplete";
import { Track } from "../../module/magmastream";

const playlist: SlashCommand = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription("Create a playlist")
        .setDMPermission(false)
        .addSubcommand(subcommand => subcommand
            .setName('play')
            .setDescription('Plays a song from playlist')
            .addStringOption(option => option
                .setName('name')
                .setDescription('Playlist Name')
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('add')
            .setDescription('Create or adds song playlist')
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
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('action')
            .setDescription('Add a song to playlist')
            .addStringOption(option => option
                .setName('type')
                .setDescription('Action Type')
                .setChoices(
                    { name: 'Delete', value: 'delete_playlist' },
                    { name: 'Rename', value: 'rename_playlist' },
                    { name: 'Transfer Owner', value: 'transfer_playlist' }
                )
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName('name')
                .setDescription('Playlist Name')
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption(option => option
                .setName('new_name')
                .setDescription('New Playlist Name')
                .setRequired(false)
            )
            .addUserOption(option => option
                .setName('user')
                .setDescription('User')
                .setRequired(false)
            )
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
            const focusedValue = interaction.options.getFocused();
            let choices = [];
            try {
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
        if (!client.config.music.playlist.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Playlist is currently disabled")], ephemeral: true });

        if (!interaction.guild) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("This command can only be used in server")],
                ephemeral: true,
            });
        }

        if (interaction.options.getSubcommand() == 'add') {

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

            if (playlistData.playlist.find(p => p.name == name)?.songs.length == client.config.music.playlist.maxplaylist) {
                return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription(`Playlist can only have ${client.config.music.playlist.maxplaylist} songs`)] });
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

                        if (track.uri.includes("youtu.be") || track.uri.includes("youtube") || track.uri.includes("youtu")) {
                            return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("We do not support YouTube links or music at this time")] });
                        }

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

                            if (track.uri.includes("youtu.be") || track.uri.includes("youtube") || track.uri.includes("youtu")) {
                                return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("We do not support YouTube links or music at this time")] });
                            }

                            let playlist = playlistData?.playlist.find(p => p.name == name);

                            if (playlist?.songs.length == client.config.music.playlist.maxplaylist) {
                                return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription(`Playlist can only have ${client.config.music.playlist.maxplaylist} songs`)] });
                            }

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

        if (interaction.options.getSubcommand() === 'action') {

            await interaction.deferReply({ ephemeral: true });

            const actionType = interaction.options.getString('type') || null;
            const playlistName = interaction.options.getString('name');

            if (!actionType) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Please enter a action type")] });
            if (!playlistName) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Please enter a playlist name")] });

            var playlistData = await playlistModel.findOne({ userId: interaction.user.id });

            if (!playlistData) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("No playlist found")] });

            const playlist = playlistData.playlist.find(p => p.name == playlistName);
            if (!playlist) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Playlist not found")] });

            switch (actionType) {
                case 'delete_playlist': {
                    playlistData.playlist = playlistData.playlist.filter(p => p.name !== playlistName);
                    await playlistData.save().then(async () => {
                        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`Playlist ${playlistName} deleted`)] });
                    }).catch(async (e: Error) => {
                        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("An error occured while deleting playlist")] });
                    });
                    break;
                }
                case 'rename_playlist': {
                    const newName = interaction.options.getString('new_name');
                    if (!newName) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Please enter a new playlist name")] });
                    playlist.name = newName;
                    await playlistData.save().then(async () => {
                        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`Playlist ${playlistName} renamed to ${newName}`)] });
                    }).catch(async (e: Error) => {
                        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("An error occured while renaming playlist")] });
                    });
                    break;
                }
                case 'transfer_playlist': {
                    const user = interaction.options.getUser('user');
                    if (!user) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Please enter a user")] });
                    if (user.bot) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Bot cannot be a owner of playlist")] });

                    const newOwner = await playlistModel.findOne({ userId: user.id });
                    if (newOwner) {
                        playlistData.playlist = playlistData.playlist.filter(p => p.name !== playlistName);
                        newOwner.playlist.push(playlist);
                        await newOwner.save().then(async () => {
                            return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`Playlist ${playlistName} transferred to ${user.tag}`)] });
                        }).catch(async (e: Error) => {
                            return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("An error occured while transferring playlist")] });
                        });
                    } else {
                        return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("The mentioned should atleast have 1 playlist")] });
                    }
                }
                default: {
                    return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Invalid action type")] });
                }
            }
        }

        if (interaction.options.getSubcommand() === 'play') {

            const playlistName = interaction.options.getString('name');
            if (!playlistName) return await interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Please enter a playlist name")], ephemeral: true });

            const playlistData = await playlistModel.findOne({ userId: interaction.user.id });
            if (!playlistData) return await interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("No playlist found")], ephemeral: true });

            await interaction.deferReply();

            const playlist = playlistData.playlist.find(p => p.name == playlistName);
            if (!playlist) return await interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Playlist not found")] });

            if (!interaction.guild) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("This command can only be used in server")]
                });
            }

            client.logger.debug(`User ${interaction.user.tag} (${interaction.user.id}) requested to play playlist [${playlistName}] in ${interaction.guild?.name} (${interaction.guild?.id})`);

            const guildMember = interaction.guild.members.cache.get(interaction.user.id);
            if (!guildMember) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("Member not found")]
                });
            }

            if (!interaction.guild.members.me?.permissions.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription(`Permission to connect or speak in <#${guildMember.voice.channel?.id}> channel is required`)],
                });
            }

            if (!guildMember.voice.channel) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first before using this command")]
                });
            }

            if (!guildMember.voice.channel.joinable) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription(`I don't have permission to join <#${guildMember.voice.channel.id}> channel`)]
                });
            }

            const player = client.manager.create({
                guild: interaction.guild.id,
                voiceChannel: guildMember.voice.channel.id,
                textChannel: interaction.channel?.id || "",
                volume: 50,
                selfDeafen: true
            });

            if (guildMember.voice.channel?.id !== player.voiceChannel) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription(`It seems you are not connected to the same voice channel as me`).setFooter({text: 'If you think there is an issue, kindly contact the server admin to use \`/dcbot\` command.'})]
                });
            }

            if (!["CONNECTED", "CONNECTING"].includes(player.state)) {
                player.connect();
                await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription(`Connected to the <#${guildMember.voice.channel.id}> channel and loading playlist. This may take a few seconds`)],
                });
            }

            try {

                var totalDuration = 0;
                for (let i = 0; i < playlist.songs.length; i++) {
                    let res;
                    let song = playlist.songs[i];
                    res = await client.manager.search(song.url, interaction.user);
                    if (res.loadType === "error") throw new Error("An error occurred while searching for music");

                    switch (res.loadType) {
                        case "empty": {
                            return await interaction.editReply({
                                embeds: [new EmbedBuilder().setColor('Red').setDescription(`No results found for ${hyperlink(textLengthOverCut(song.title || "", 50), song.url)}`)]
                            });
                        }
                        case "track":
                        case "search": {
                            let track: Track = res.tracks[0];
                            player.queue.add(track);
                            totalDuration += track.duration;
                            break;
                        }
                        case "playlist": {
                            res.playlist?.tracks.forEach(async (track: Track) => {
                                player.queue.add(track);
                                totalDuration += track.duration;
                            });
                            break;
                        }
                        default: {
                            client.logger.info("default: " + res.loadType);
                            break;
                        }
                    }
                }

                await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Green').setDescription(`Playlist ${playlistName} with ${playlist.songs.length} songs has been added to queue. Total duration: ${msToTime(totalDuration)}`)]
                });

                if (!player.playing && !player.paused && player.queue.size) {
                    player.play();
                }

                const track = player.queue.current;

                if (!track) {
                    player.destroy();
                    return await interaction.editReply({
                        embeds: [new EmbedBuilder().setColor('Red').setDescription("An error occurred while playing playlist")]
                    });
                }

                await interaction.followUp({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`Control Panel`)
                            .setDescription(`\`\`\`Control the music playback using the buttons below\`\`\``)
                            .setThumbnail(client.user?.displayAvatarURL() || "")
                    ],
                    components: [musicrow]
                });

            } catch (err: Error | any) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription(`An error occurred while playing playlist\nError: ${err.message}`)]
                });
            }
        }
    }
};
export default playlist;