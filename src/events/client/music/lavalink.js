const {
    Events,
    EmbedBuilder
} = require('discord.js');

const wait = require("timers/promises").setTimeout;
const musicModel = require('../../database/modals/musicGuild.js');
const musicUserModel = require('../../database/modals/musicUser.js');
const { musicContent, musicrowdis, musicrow, musicEmbedOff, musicEmbed } = require('./musicUtls/musicEmbed.js');

async function updateMusicDB(musicData, track) {
    if (!musicData) {
        musicData = new musicUserModel({
            userID: track.requester.id,
            songsNo: 0,
            songs: []
        });
    }
    musicData.songsNo += 1;
    let song = musicData.songs.find((song) => song.name === track.title);
    if (song) {
        song.times += 1;
    } else {
        musicData.songs.push({
            name: track.title,
            url: track.uri,
            times: 1
        });
    }
    await musicData.save();
}

module.exports = {
    name: Events.ClientReady,
    async execute(client) {

        if (!client.config.music.enabled) return;

        client.manager.init(client.user.id);

        client.manager.on("nodeConnect", (node) => {
            client.logger.success(`Lavalink connection to "${node.options.identifier}" has been established`);
        })
            .on("nodeDisconnect", (node, reason) => {
                client.logger.warn(`Lavalink connection to "${node.options.identifier}" has been disconnected`);
                client.logger.warn(reason);
            })
            .on("nodeReconnect", (node) => {
                client.logger.info(`Lavalink connection to "${node.options.identifier}" has been reconnected`);
            })
            .on("nodeError", (node, error) => {
                client.logger.error(`Lavalink connection to "${node.options.identifier}" has been errored\nError: ${error}`);
            })
            .on("playerCreate", (player) => {
                const guild = client.guilds.cache.get(player.guild);
                client.logger.debug(`Player Created from (${guild.id} | ${guild.name})`);
            })
            .on("playerDestroy", (player) => {
                const guild = client.guilds.cache.get(player.guild);
                client.logger.debug(`Player Destroyed from (${guild.id} | ${guild.name})`);
            })
            .on("trackStart", (player, track) => {
                const bindChannel = client.channels.cache.get(player.textChannel);
                if (!player.trackRepeat) bindChannel.send({ embeds: [new EmbedBuilder().setDescription(`🎵 ${track.title}`).setColor(client.config.music.embedcolor)] }).then(async (m) => {
                    var musicData = await musicModel.findOne({
                        guildID: m.guild.id
                    });

                    if (musicData) {
                        const pannelId = musicData.musicPannelId;
                        if (pannelId) {
                            const pannelChan = client.channels.cache.get(musicData.musicChannel);
                            const pannelMsg = await pannelChan.messages.fetch(pannelId);
                            if (!pannelMsg) return client.logger.error(`Music Pannel not found, setup again! | ${pannelId} `);
                            const embed = musicEmbed(client, track);
                            const musicContent = `Song queue:\n\n${player.queue.map((track, i) => `**${i + 1}** - [${track.title}](${track.uri})`).slice(0, 5).join("\n")}\n\n${player.queue.length > 5 ? `And **${player.queue.length - 5}** more tracks...` : `In the playlist **${player.queue.length}** tracks...`}`;
                            pannelMsg.edit({ content: musicContent, embeds: [embed], components: [musicrow] });
                        }
                        setTimeout(() => m.delete(), 5000);
                    }

                    var musicUserData = await musicUserModel.findOne({
                        userID: track.requester.id
                    });

                    await updateMusicDB(musicUserData, track);
                });
                let guildName = client.guilds.cache.get(player.guild).name;
                client.logger.debug(`Track ${track.title} started playing in ${guildName} (${player.guild}) By ${track.requester.tag} (${track.requester.id})`);
            })
            .on("queueEnd", async (player) => {

                client.channels.cache.get(player.textChannel).send({ embeds: [new EmbedBuilder().setDescription("🎵 Played all music in queue").setColor(client.config.music.embedcolor)] }).then(async (m) => {
                    var musicData = await musicModel.findOne({
                        guildID: m.guild.id
                    });

                    if (musicData) {
                        const pannelId = musicData.musicPannelId;
                        if (pannelId) {
                            const pannelChan = client.channels.cache.get(musicData.musicChannel);
                            const pannelMsg = await pannelChan.messages.fetch(pannelId);
                            if (!pannelMsg) return client.logger.error(`Music Pannel not found, setup again! | ${pannelId} `);
                            const embed = musicEmbedOff(client);
                            pannelMsg.edit({ content: musicContent, embeds: [embed], components: [musicrowdis] });
                        }
                        setTimeout(() => m.delete(), 5000);

                        await wait(async () => {
                            if (musicData.status247) return;
                            player.destroy();
                        }, 600000 / 2);

                    }
                });
            });
    }
}