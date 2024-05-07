import { Events, EmbedBuilder, Message, VoiceChannel, StageChannel } from 'discord.js';
import * as timers from "timers/promises";
import { Player } from '../../../module/magmastream';

const wait = async (ms: number) => {
    await timers.setTimeout(ms);
};

import musicModel from '../../database/schema/musicGuild';
import { updateMusicChannel } from '../../../utils/musicFunction';

import { BotEvent, IMusicGuild, StateChange } from '../../../types';

const event: BotEvent = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) {

        if (!client.config.music.enabled) return;

        const checkInactivity = async (musicData: IMusicGuild, player: Player, stateChange: StateChange) => {

            if (musicData.status247) return;

            await wait(600000);

            if (player.paused && stateChange.members?.size === 0) {
                player.destroy();
                client.channels.cache
                    .get(String(player.textChannel))
                    .send({ embeds: [new EmbedBuilder().setTitle("👋 The voice channel was empty for 10 minutes, so the music has ended, and I left.").setColor(client.config.music.embedcolor)] }).then(async (m: Message) => {
                        setTimeout(() => m.delete(), 10000);
                    });
            }
        };

        var musicData = await musicModel.findOne({
            guildId: newState.guild.id
        });

        let guildId = newState.guild.id;
        const player = client.manager.get(guildId);

        if (!player || player.state !== "CONNECTED") return;

        if (oldState.channelId && !newState.channelId && newState.id === client.user.id) {
            if (musicData) {
                await updateMusicChannel(client, musicData, player, null, true);
            }
            return player.destroy();
        }

        const stateChange: StateChange = {};
        if (oldState.channel === null && newState.channel !== null) stateChange.type = "JOIN";
        if (oldState.channel !== null && newState.channel === null) stateChange.type = "LEAVE";
        if (oldState.channel !== null && newState.channel !== null) stateChange.type = "MOVE";
        if (oldState.channel === null && newState.channel === null) return;
        if (newState.serverMute == true && oldState.serverMute == false) return player.pause(true);
        if (newState.serverMute == false && oldState.serverMute == true) return player.pause(false);

        if (stateChange.type === "MOVE") {
            if (oldState.channel.id === player.voiceChannel) stateChange.type = "LEAVE";
            if (newState.channel.id === player.voiceChannel) stateChange.type = "JOIN";
        }
        if (stateChange.type === "JOIN") stateChange.channel = newState.channel;
        if (stateChange.type === "LEAVE") stateChange.channel = oldState.channel;

        if (!stateChange.channel || stateChange.channel.id !== player.voiceChannel) return;

        if (stateChange.channel instanceof VoiceChannel || stateChange.channel instanceof StageChannel) {
            stateChange.members = stateChange.channel.members.filter((member) => !member.user.bot);
        }

        if (newState.mute !== oldState.mute) return;
        if (newState.selfVideo !== oldState.selfVideo) return;
        if (newState.selfMute !== oldState.selfMute) return;
        if (newState.selfStream !== oldState.selfStream) return;

        switch (stateChange.type) {
            case "JOIN":
                if (stateChange.members.size === 1 && player.paused) {
                    client.channels.cache.get(String(player.textChannel)).send({ embeds: [new EmbedBuilder().setTitle("▶️ Resumed playback").setColor(client.config.music.embedcolor)] }).then(async (m: Message) => {
                        setTimeout(() => m.delete(), 10000);
                    });
                    player.pause(false);
                }
                break;
            case "LEAVE":
                if (stateChange.members.size === 0 && !player.paused && player.playing) {
                    client.channels.cache
                        .get(String(player.textChannel))
                        .send({ embeds: [new EmbedBuilder().setTitle("⏸️ Paused playback because the voice channel is empty").setColor(client.config.music.embedcolor)] }).then(async (m: Message) => {
                            setTimeout(() => m.delete(), 10000);
                        });

                    player.pause(true);

                    if (!musicData) return;
                    checkInactivity(musicData, player, stateChange);
                }
                break;
        }

    }
};

export default event;