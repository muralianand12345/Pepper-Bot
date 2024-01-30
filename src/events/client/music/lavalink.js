const {
    Events,
    EmbedBuilder
} = require('discord.js');
const wait = require("timers/promises").setTimeout;

const musicModel = require('../../database/modals/musicGuild.js');
const musicUserModel = require('../../database/modals/musicUser.js');
const musicServerModel = require('../../database/modals/musicServerStats.js');

const { updateMusicDB, updateMusicChannel } = require('./musicUtls/musicFunctions.js');

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
                        await updateMusicChannel(client, musicData, player, track, false);
                        setTimeout(() => m.delete(), 5000);
                    }

                    var musicUserData = await musicUserModel.findOne({
                        userID: track.requester.id
                    });
                    if (!musicUserData) {
                        musicUserData = new musicUserModel({
                            userID: track.requester.id,
                            songsNo: 0,
                            songs: []
                        });
                    }

                    var musicServerData = await musicServerModel.findOne({
                        guildID: m.guild.id
                    });
                    if (!musicServerData) {
                        musicServerData = new musicServerModel({
                            guildID: m.guild.id,
                            songsNo: 0,
                            songs: []
                        });
                    }
            
                    await updateMusicDB(musicServerData, track);
                    await updateMusicDB(musicUserData, track);
                });
                let guildName = client.guilds.cache.get(player.guild).name;
                client.logger.debug(`Track ${track.title} started playing in ${guildName} (${player.guild}) By ${track.requester.tag} (${track.requester.id})`);
                client.logger.debug(`User: ${track.requester.tag} (${track.requester.id}) requested song uri ${track.uri} in ${guildName} (${player.guild})`);
            })
            .on("queueEnd", async (player) => {
                client.channels.cache.get(player.textChannel).send({ embeds: [new EmbedBuilder().setDescription("🎵 Played all music in queue").setColor(client.config.music.embedcolor)] }).then(async (m) => {
                    var musicData = await musicModel.findOne({
                        guildID: m.guild.id
                    });

                    if (musicData) {
                        await updateMusicChannel(client, musicData, player, null, true);
                        await wait(async () => {
                            if (musicData.status247) return;
                            player.destroy();
                        }, 600000 / 2);
                    }
                });
            });
    }
}