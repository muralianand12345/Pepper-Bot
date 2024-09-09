import { EmbedBuilder, Message, PermissionsBitField } from "discord.js";
import { Track } from "../../../magmastream";

import { Command } from "../../types";
import { msToTime, textLengthOverCut, hyperlink } from "../../utils/format";
import { musicrow } from "../../utils/musicEmbed";

const playcommand: Command = {
    name: "play",
    description: "Play Song | play <song name or url>",
    cooldown: 5000,
    owner: false,
    premium: false,
    userPerms: [],
    botPerms: [],
    execute: async (client, message, args) => {

        const chan = message.channel as any;
        if (!chan) return;

        if (!client.config.music.enabled) return chan.send({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")] });

        const query = args.join(" ");

        if (!query) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please enter a search term or URL")],
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        if (query.includes("youtu.be") || query.includes("youtube") || query.includes("youtu")) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("We do not support YouTube links or music at this time")],
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        if (!message.guild) {
            return message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("This command can only be used in server")]
            });
        }

        const guildMember = message.guild.members.cache.get(message.author.id);
        if (!guildMember) {
            return message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Member not found")]
            });
        }

        if (!message.guild.members.me?.permissions.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`Permission to connect or speak in <#${guildMember.voice.channel?.id}> channel is required`)],
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }



        if (!guildMember.voice.channel) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first before using this command")],
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        if (!guildMember.voice.channel.joinable) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`I don't have permission to join <#${guildMember.voice.channel.id}> channel`)],
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        const player = client.manager.create({
            guild: message.guild.id,
            voiceChannel: guildMember.voice.channel?.id,
            textChannel: message.channel.id,
            volume: 50,
            selfDeafen: true
        });

        if (guildMember.voice.channel?.id !== player.voiceChannel) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`You must be in the same channel as ${client.user}`)],
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        if (!["CONNECTED", "CONNECTING"].includes(player.state)) {
            player.connect();
            await message.reply({
                embeds: [new EmbedBuilder().setColor('Green').setDescription(`Connected to \`${guildMember.voice.channel.name}\` channel`)],
            }).then(async (msg) => {
                setTimeout(async () => { await msg.delete(); }, 5000);
            });
        }

        let res;
        try {
            res = await client.manager.search(query, message.author);
            if (res.loadType === "error") throw new Error("An error occurred while searching for music");
        } catch (e) {
            client.logger.error(`An unknown error occurred while searching for music\nError: ${e}`);
            return await chan.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Red')
                        .setTitle("🐛 Uh-oh... Error")
                        .setDescription(`Oops! An unknown error occurred while searching for music.\nCould it be a private video or an incorrect link?`),
                ]
            }).then(async (msg: Message) => {
                setTimeout(async () => { await msg.delete(); }, 5000);
            });
        }

        switch (res.loadType) {
            case "empty": {
                if (!player.queue.current) await player.destroy();
                return chan.send({
                    embeds: [new EmbedBuilder().setColor('Red').setTitle("🤔 Hm...").setDescription("I've looked thoroughly, but it seems like there's no such music")],
                }).then(async (msg: Message) => {
                    setTimeout(async () => { await msg.delete(); }, 5000);
                });
            }

            case "track":
            case "search": {
                let track: Track = res.tracks[0];
                player.queue.add(track);
                if (!player.playing && !player.paused && !player.queue.size) await player.play();

                await chan.send({
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
                    components: [musicrow]
                });
                break;
            }

            case "playlist": {
                res.playlist?.tracks.forEach((track) => {
                    player.queue.add(track);
                });
                if (!player.playing && !player.paused && player.queue.totalSize === res.playlist?.tracks.length) await player.play();

                await chan.send({
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
                    ]
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