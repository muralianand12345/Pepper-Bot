const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField
} = require('discord.js');

const { getAutocompleteSearch } = require('../../events/client/commands/functions/autoComplete.js');
const { musicrow } = require('../../events/client/music/musicUtls/musicEmbed.js');
const { msToTime, textLengthOverCut, hyperlink } = require('../../events/client/commands/functions/format.js');

module.exports = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription("Play Song")
        .setDMPermission(false)
        .addStringOption(option => option
            .setName('song')
            .setDescription('Song Name/URL')
            .setRequired(true)
            .setAutocomplete(true)
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

        const query = interaction.options.getString('song');

        if (query == "Please enter a search term or URL") {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please enter a search term or URL")],
                ephemeral: true,
            });
        }

        if (query.includes("youtube.com")) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("We do not support YouTube links or music at this time")],
                ephemeral: true,
            });
        }

        if (!interaction.guild.members.me.permissions.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`Permission to connect or speak in <#${interaction.member.voice.channel.id}> channel is required`)],
            });
        }

        if (!interaction.member.voice.channel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first before using this command")],
                ephemeral: true,
            });
        }

        if (!interaction.member.voice.channel.joinable) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`I don't have permission to join <#${interaction.member.voice.channel.id}> channel`)],
                ephemeral: true,
            });
        }

        if (!interaction.member.voice.channel.speakable) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`I don't have permission to speak in <#${interaction.member.voice.channel.id}> channel`)],
                ephemeral: true,
            });
        }

        const player = client.manager.create({
            guild: interaction.guild.id,
            voiceChannel: interaction.member.voice.channel.id,
            textChannel: interaction.channel.id,
            volume: 50,
            selfDeafen: true,
            repeat: "none",
        });

        if (interaction.member.voice.channel?.id !== player.voiceChannel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`It seems you are not connected to the same voice channel as me`)],
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        if (!["CONNECTED", "CONNECTING"].includes(player.state)) {
            await player.connect();
            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`Connected to the <#${interaction.member.voice.channel.id}> channel`)],
            });
        }

        let res;
        try {
            res = await client.manager.search(query, interaction.user);
            if (res.loadType === "error") throw res.exception;
        } catch (e) {
            client.logger.error(`An unknown error occurred while searching for music\nError: ${e}`);
            return interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setTitle("🐛 Uh-oh... Error")
                        .setDescription(`Oops! An unknown error occurred while searching for music.\nCould it be a private video or an incorrect link?`),
                ],
                ephemeral: true,
            });
        }

        switch (res.loadType) {
            case "empty": {
                if (!player.queue.current) await player.destroy();
                return interaction.followUp({
                    embeds: [new EmbedBuilder().setColor('Red').setTitle("🤔 Hm...").setDescription("I've looked thoroughly, but it seems like there's no such music")],
                    ephemeral: true,
                });
            }

            case "track":
            case "search": {
                let track = res.tracks[0];
                track.requester = interaction.member.user;
                player.queue.add(track);
                if (!player.playing && !player.paused && !player.queue.size) player.play();

                await interaction.followUp({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`💿 Added the music to the queue`)
                            .setDescription(hyperlink(textLengthOverCut(track.title, 50), track.uri))
                            .setThumbnail(track.artworkUrl)
                            .setColor(client.config.music.embedcolor)
                            .addFields(
                                {
                                    name: "Duration",
                                    value: `┕** \`${track.isStream ? "LIVE" : msToTime(track.duration)}\`**`,
                                    inline: true,
                                },
                                {
                                    name: "Requester",
                                    value: `┕** ${track.requester}**`,
                                    inline: true,
                                },
                                {
                                    name: "Author",
                                    value: `┕** \`${track.author}\`**`,
                                    inline: true,
                                }
                            ),
                    ],
                    components: [musicrow],
                    ephemeral: false,
                });
                break;
            }

            case "playlist": {
                res.playlist.tracks.forEach((track) => {
                    track.requester = interaction.member.user;
                    player.queue.add(track);
                });
                if (!player.playing && !player.paused && player.queue.totalSize === res.playlist.tracks.length) player.play();

                await interaction.followUp({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`📜 Added the playlist to the queue`)
                            .setDescription(hyperlink(textLengthOverCut(res.playlist.name, 50), query))
                            .setThumbnail(res.playlist.tracks[0].artworkUrl)
                            .setColor(client.config.music.embedcolor)
                            .addFields(
                                {
                                    name: "Playlist Duration",
                                    value: `┕** \`${msToTime(res.playlist.duration)}\`**`,
                                    inline: true,
                                },
                                {
                                    name: "Requester",
                                    value: `┕** ${res.playlist.tracks[0].requester}**`,
                                    inline: true,
                                }
                            ),
                    ],
                    //components: [musicrow],
                });
                break;
            }

            default: {
                client.logger.info("default", res.loadType);
                break;
            }
        }
    }
}