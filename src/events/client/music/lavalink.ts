import { Events, EmbedBuilder, User, Message } from "discord.js";
import * as timers from "timers/promises";

import { Node, Player, Track } from "../../../module/magmastream";

const wait = async (ms: number) => {
    await timers.setTimeout(ms);
};

import { BotEvent } from "../../../types";
import musicModel from "../../database/schema/musicGuild";
import musicUserModel from "../../database/schema/musicUser";
import musicServerModel from "../../database/schema/musicServerStats";

import { updateMusicDB, updateMusicChannel } from "../../../utils/musicFunction";

const event: BotEvent = {
    name: Events.ClientReady,
    async execute(client) {

        if (!client.config.music.enabled) return;

        client.manager.init(client.user.id);

        client.manager.on("nodeConnect", (node: Node) => {
            client.logger.success(`Lavalink connection to "${node.options.identifier}" has been established`);
        })
            .on("nodeDisconnect", (node: Node, reason: string) => {
                client.logger.warn(`Lavalink connection to "${node.options.identifier}" has been disconnected`);
                client.logger.warn(reason);
            })
            .on("nodeReconnect", (node: Node) => {
                client.logger.info(`Lavalink connection to "${node.options.identifier}" has been reconnected`);
            })
            .on("nodeError", (node: Node, error: Error) => {
                client.logger.error(`Lavalink connection to "${node.options.identifier}" has been errored\nError: ${error}`);
            })
            .on("playerCreate", (player: Player) => {
                const guild = client.guilds.cache.get(player.guild);
                client.logger.debug(`Player Created from (${guild.id || "Unknown Guild"} | ${guild.name})`);
            })
            .on("playerDestroy", (player: Player) => {
                const guild = client.guilds.cache.get(player.guild);
                client.logger.debug(`Player Destroyed from (${guild.id || "Unknown Guild"} | ${guild.name})`);
            })
            .on("trackStart", (player: Player, track: Track) => {
                const bindChannel = client.channels.cache.get(player.textChannel);
                if (!player.trackRepeat) bindChannel.send({ embeds: [new EmbedBuilder().setDescription(`🎵 ${track.title}`).setColor(client.config.music.embedcolor)] }).then(async (m: Message) => {
                    var musicData = await musicModel.findOne({
                        guildId: player.guild
                    });

                    if (musicData) {
                        await updateMusicChannel(client, musicData, player, track, false);
                        setTimeout(() => m.delete(), 5000);
                    }

                    var musicUserData = await musicUserModel.findOne({
                        userId: (track.requester as User).id
                    });
                    if (!musicUserData) {
                        musicUserData = new musicUserModel({
                            userId: (track.requester as User).id,
                            songsNo: 0,
                            songs: []
                        });
                    }

                    var musicServerData = await musicServerModel.findOne({
                        guildId: player.guild
                    });
                    if (!musicServerData) {
                        musicServerData = new musicServerModel({
                            guildId: player.guild,
                            songsNo: 0,
                            songs: []
                        });
                    }

                    await updateMusicDB(musicServerData, track);
                    await updateMusicDB(musicUserData, track);
                });
                let guildName = client.guilds.cache.get(player.guild).name;
                client.logger.debug(`Track ${track.title} started playing in ${guildName} (${player.guild}) By ${(track.requester as User).tag} (${(track.requester as User).id})`);
                client.logger.debug(`User: ${(track.requester as User).tag} (${(track.requester as User).id}) requested song uri ${track.uri} in ${guildName} (${player.guild})`);
            })
            .on("queueEnd", async (player: Player) => {
                await client.channels.cache.get(player.textChannel).send({ embeds: [new EmbedBuilder().setDescription("🎵 Played all music in queue").setColor(client.config.music.embedcolor)] }).then(async (m: Message) => {
                    var musicData = await musicModel.findOne({
                        guildId: player.guild
                    });

                    if (musicData) {
                        await updateMusicChannel(client, musicData, player, null, true);
                        if (musicData?.status247) return;
                        await wait(600000 / 2);
                        player.destroy();
                    }
                });
            });
    }
};

export default event;