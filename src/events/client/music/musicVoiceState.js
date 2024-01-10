const { Events, EmbedBuilder } = require("discord.js");
const wait = require("timers/promises").setTimeout;
const musicModel = require('../../database/modals/musicGuild.js');
const { musicContent, musicrowdis, musicEmbedOff } = require('./musicUtls/musicEmbed.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) {

        if (!client.config.music.enabled) return;

        const checkInactivity = async () => {
            await wait(() => {
                if (player.paused && stateChange.members.size === 0) {
                    player.destroy();
                    client.channels.cache
                        .get(String(player.textChannel))
                        .send({ embeds: [new EmbedBuilder().setTitle("👋 The voice channel was empty for 10 minutes, so the music has ended, and I left.").setColor(client.config.music.embedcolor)] }).then(async (m) => {
                            setTimeout(() => m.delete(), 10000);
                        });
                }
            }, 600000); // 10 minutes (600,000 ms)
        };

        let guildId = newState.guild.id;
        const player = client.manager.get(guildId);

        var musicData = await musicModel.findOne({
            guildID: guildId
        });

        // Check if connected to a channel
        if (!player || player.state !== "CONNECTED") return;

        // Bot kicked from the channel
        if (oldState.channelId && !newState.channelId && newState.id === client.user.id) {
            if (musicData) {
                const pannelId = musicData.musicPannelId;
                if (pannelId) {
                    const pannelMsg = await client.channels.cache.get(musicData.musicChannel).messages.fetch(pannelId);
                    if (!pannelMsg) return;
                    pannelMsg.edit({ content: musicContent, embeds: [musicEmbedOff(client)], components: [musicrowdis] });
                }
            }
            return player.destroy();
        }

        // Prepare data for comparison
        const stateChange = {};
        if (oldState.channel === null && newState.channel !== null) stateChange.type = "JOIN";
        if (oldState.channel !== null && newState.channel === null) stateChange.type = "LEAVE";
        if (oldState.channel !== null && newState.channel !== null) stateChange.type = "MOVE";
        if (oldState.channel === null && newState.channel === null) return; // you never know, right
        if (newState.serverMute == true && oldState.serverMute == false) return player.pause(true);
        if (newState.serverMute == false && oldState.serverMute == true) return player.pause(false);

        // Check for channel move
        if (stateChange.type === "MOVE") {
            if (oldState.channel.id === player.voiceChannel) stateChange.type = "LEAVE";
            if (newState.channel.id === player.voiceChannel) stateChange.type = "JOIN";
        }
        if (stateChange.type === "JOIN") stateChange.channel = newState.channel;
        if (stateChange.type === "LEAVE") stateChange.channel = oldState.channel;

        if (!stateChange.channel || stateChange.channel.id !== player.voiceChannel) return;

        // Filtering current users based on the bot
        stateChange.members = stateChange.channel.members.filter((member) => !member.user.bot);

        if (newState.mute !== oldState.mute) return;
        if (newState.selfVideo !== oldState.selfVideo) return;
        if (newState.selfMute !== oldState.selfMute) return;
        if (newState.selfStream !== oldState.selfStream) return;

        switch (stateChange.type) {
            case "JOIN":
                if (stateChange.members.size === 1 && player.paused) {
                    client.channels.cache.get(String(player.textChannel)).send({ embeds: [new EmbedBuilder().setTitle("▶️ Resumed playback").setColor(client.config.music.embedcolor)] }).then(async (m) => {
                        setTimeout(() => m.delete(), 10000);
                    });
                    player.pause(false);
                }
                break;
            case "LEAVE":
                if (stateChange.members.size === 0 && !player.paused && player.playing) {
                    client.channels.cache
                        .get(String(player.textChannel))
                        .send({ embeds: [new EmbedBuilder().setTitle("⏸️ Paused playback because the voice channel is empty").setColor(client.config.music.embedcolor)] }).then(async (m) => {
                            setTimeout(() => m.delete(), 10000);
                        });

                    player.pause(true);
                    checkInactivity();
                }
                break;
        }
    },
};