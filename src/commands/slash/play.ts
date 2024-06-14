import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from "discord.js";
import { SlashCommand } from "../../types";

import { msToTime, textLengthOverCut, hyperlink } from "../../utils/format";
import { musicrow } from "../../utils/musicEmbed";
import { getAutoComplete } from "../../utils/autoComplete";
import { Track } from "../../module/magmastream";

const playcommand: SlashCommand = {
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
    autocomplete: async (interaction, client) => {
        const focusedValue = interaction.options.getFocused();
        let choices = [];
        try {
            if (!focusedValue) {
                choices = ["Please enter a search term or URL"];
            } else {
                choices = await getAutoComplete(focusedValue);
            }
            await interaction.respond(choices.map((choice: any) => ({ name: choice, value: choice })));
        } catch (e: any) {
            client.logger.error(`An error occurred while fetching autocomplete suggestions.\nError: ${e.message}`);
        }
    },
    execute: async (interaction, client) => {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        const query = interaction.options.getString('song') || "Please enter a search term or URL";

        if (query == "Please enter a search term or URL") {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please enter a search term or URL")],
                ephemeral: true,
            });
        }

        client.logger.debug(`User ${interaction.user.tag} (${interaction.user.id}) requested to play [${query}] in ${interaction.guild?.name} (${interaction.guild?.id})`);

        if (query.includes("youtu.be") || query.includes("youtube") || query.includes("youtu")) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("We do not support YouTube links or music at this time")],
                ephemeral: true,
            });
        }

        if (!interaction.guild) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("This command can only be used in server")],
                ephemeral: true,
            });
        }

        const guildMember = interaction.guild.members.cache.get(interaction.user.id);
        if (!guildMember) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Member not found")],
                ephemeral: true,
            });
        }

        if (!interaction.guild.members.me?.permissions.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`Permission to connect or speak in <#${guildMember.voice.channel?.id}> channel is required`)],
            });
        }

        if (!guildMember.voice.channel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first before using this command")],
                ephemeral: true,
            });
        }

        if (!guildMember.voice.channel.joinable) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`I don't have permission to join <#${guildMember.voice.channel.id}> channel`)],
                ephemeral: true,
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
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`It seems you are not connected to the same voice channel as me`).setFooter({text: 'If you think there is an issue, kindly contact the server admin to use \`/dcbot\` command.'})],
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        if (!["CONNECTED", "CONNECTING"].includes(player.state)) {
            player.connect();
            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`Connected to the <#${guildMember.voice.channel.id}> channel`)],
            });
        }

        let res;
        try {
            res = await client.manager.search(query, interaction.user);
            if (res.loadType === "error") throw new Error("An error occurred while searching for music");
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
                if (!player.queue.current) player.destroy();
                return interaction.followUp({
                    embeds: [new EmbedBuilder().setColor('Red').setTitle("🤔 Hm...").setDescription("I've looked thoroughly, but it seems like there's no such music")],
                    ephemeral: true,
                });
            }

            case "track":
            case "search": {
                let track: Track = res.tracks[0];
                player.queue.add(track);

                if (!player.playing && !player.paused && !player.queue.size) {
                    player.play();
                }

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
                res.playlist?.tracks.forEach((track) => {
                    player.queue.add(track);
                });
                if (!player.playing && !player.paused && player.queue.totalSize === res.playlist?.tracks.length) player.play();

                await interaction.followUp({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`📜 Added the playlist to the queue`)
                            .setDescription(hyperlink(textLengthOverCut(res.playlist?.name || "", 50), query))
                            .setThumbnail(res.playlist?.tracks[0].artworkUrl || "")
                            .setColor(client.config.music.embedcolor)
                            .addFields(
                                {
                                    name: "Playlist Duration",
                                    value: `┕** \`${msToTime(res.playlist?.duration || 0)}\`**`,
                                    inline: true,
                                },
                                {
                                    name: "Requester",
                                    value: `┕** ${res.playlist?.tracks[0].requester}**`,
                                    inline: true,
                                }
                            ),
                    ],
                    //components: [musicrow],
                });
                break;
            }

            default: {
                client.logger.info("default" + res.loadType);
                break;
            }
        }
    }
}

export default playcommand;