const {
    Events,
    EmbedBuilder,
    ChannelType
} = require('discord.js');

const musicModel = require('../../database/modals/musicGuild.js');
const { hyperlink, textLengthOverCut } = require('../commands/functions/format.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {

        if (!client.config.music.enabled) return;
        if (message.author.bot) return;
        if (message.channel.type !== ChannelType.GuildText) return;

        var musicData = await musicModel.findOne({
            guildID: message.guild.id
        });

        if (!musicData) return;
        if (!musicData.musicChannel && !musicData.musicPannelId) return;
        if (musicData.musicChannel !== message.channel.id) return;

        if (!message.member.voice.channel) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first before using this command")],
            }).then(async (m) => {
                setTimeout(() => m.delete(), 5000);
                await message.delete();
            });
        }

        if (!message.member.voice.channel.joinable) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("I don't have permission to join your voice channel")],
            }).then(async (m) => {
                setTimeout(() => m.delete(), 5000);
                await message.delete();
            });
        }

        if (!message.member.voice.channel.speakable) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("I don't have permission to speak in your voice channel")],
            }).then(async (m) => {
                setTimeout(() => m.delete(), 5000);
                await message.delete();
            });
        }

        var query = message.content;
        if (!query) return;

        if (query.includes("youtube.com")) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("We do not support YouTube links or music at this time")],
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        const player = client.manager.create({
            guild: message.guild.id,
            voiceChannel: message.member.voice.channel.id,
            textChannel: message.channel.id,
            volume: 50,
            selfDeafen: true,
            repeat: "none",
        });

        if (message.member.voice.channel?.id !== player.voiceChannel) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`It seems you are not connected to the same voice channel as me`)],
            }).then(async (m) => {
                setTimeout(() => m.delete(), 5000);
                await message.delete();
            });
        }

        if (!["CONNECTED", "CONNECTING"].includes(player.state)) {
            await player.connect();
        }

        let res;
        try {
            res = await client.manager.search(query, message.author);
            if (res.loadType === "error") throw res.exception;
        } catch (e) {
            client.logger.error(`An unknown error occurred while searching for music\nError: ${e}`);
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setTitle("🐛 Uh-oh... Error").setDescription(`Oops! An unknown error occurred while searching for music.\nCould it be a private video or an incorrect link?`)]
            }).then(async (m) => {
                setTimeout(() => m.delete(), 5000);
                await message.delete();
            });
        }

        switch (res.loadType) {
            case "empty": {
                if (!player.queue.current) await player.destroy();
                return await message.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setTitle("🤔 Hm...").setDescription("I've looked thoroughly, but it seems like there's no such music")],
                }).then(async (m) => {
                    setTimeout(() => m.delete(), 5000);
                    await message.delete();
                });
            }

            case "track":
            case "search": {
                let track = res.tracks[0];
                track.requester = message.member.user;
                player.queue.add(track);
                if (!player.playing && !player.paused && !player.queue.size) player.play();

                await message.reply({
                    embeds: [new EmbedBuilder().setColor('Green').setTitle("🎶 Added the music to the queue").setDescription(hyperlink(textLengthOverCut(track.title, 50), track.uri))],
                }).then(async (m) => {
                    setTimeout(() => m.delete(), 5000);
                    await message.delete();
                });
                break;
            }

            case 'playlist': {
                res.playlist.tracks.forEach((track) => {
                    track.requester = message.member.user;
                    player.queue.add(track);
                });
                if (!player.playing && !player.paused && player.queue.totalSize === res.playlist.tracks.length) player.play();

                await message.reply({
                    embeds: [new EmbedBuilder().setColor('Green').setTitle("🎶 Added the playlist to the queue").setDescription(hyperlink(textLengthOverCut(res.playlist.name, 50), res.playlist.uri))],
                }).then(async (m) => {
                    setTimeout(() => m.delete(), 5000);
                    await message.delete();
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