"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const magmastream_1 = require("magmastream");
const msg_1 = require("../../../../utils/msg");
const music_1 = require("../../../../core/music");
const music_guild_1 = __importDefault(require("../../../../events/database/schema/music_guild"));
const patchNodeRest = (node, client) => {
    const rest = node.rest;
    if (rest._patched)
        return;
    const originalUpdatePlayer = rest.updatePlayer.bind(rest);
    rest.updatePlayer = async (options) => {
        try {
            const data = options?.data ?? options;
            const guildId = options?.guildId ?? data?.guildId;
            if (data?.voice && !data.voice.channelId && guildId) {
                const player = client.manager.getPlayer(guildId);
                if (player?.voiceChannelId) {
                    data.voice.channelId = player.voiceChannelId;
                    client.logger.debug(`[REST_PATCH] Injected channelId ${player.voiceChannelId} for guild ${guildId}`);
                }
            }
        }
        catch (err) {
            client.logger.warn(`[REST_PATCH] Failed to inject channelId: ${err}`);
        }
        return originalUpdatePlayer(options);
    };
    rest._patched = true;
    client.logger.info(`[REST_PATCH] Patched Rest.updatePlayer on node ${node.options.identifier}`);
};
const reconnectTwentyFourSevenGuilds = async (client) => {
    try {
        const guilds = await music_guild_1.default.find({
            twentyFourSeven: true,
            voiceChannelId: { $ne: null },
            textChannelId: { $ne: null },
        });
        if (!guilds.length)
            return;
        client.logger.info(`[24/7_RECONNECT] Found ${guilds.length} guild(s) with 24/7 mode, attempting reconnect...`);
        for (const guildData of guilds) {
            try {
                const guild = client.guilds.cache.get(guildData.guildId);
                if (!guild) {
                    client.logger.warn(`[24/7_RECONNECT] Guild ${guildData.guildId} not in cache, skipping`);
                    continue;
                }
                const existingPlayer = client.manager.getPlayer(guildData.guildId);
                if (existingPlayer && existingPlayer.state === 'CONNECTED') {
                    client.logger.debug(`[24/7_RECONNECT] Player already connected for guild ${guildData.guildId}, skipping`);
                    continue;
                }
                const voiceChannel = client.channels.cache.get(guildData.voiceChannelId);
                if (!voiceChannel || !voiceChannel.isVoiceBased()) {
                    client.logger.warn(`[24/7_RECONNECT] Voice channel ${guildData.voiceChannelId} not found for guild ${guildData.guildId}, clearing stored channels`);
                    guildData.voiceChannelId = null;
                    guildData.textChannelId = null;
                    await guildData.save();
                    continue;
                }
                const botMember = guild.members.me;
                if (!botMember)
                    continue;
                const permissions = voiceChannel.permissionsFor(botMember);
                if (!permissions || !permissions.has([discord_js_1.default.PermissionsBitField.Flags.Connect, discord_js_1.default.PermissionsBitField.Flags.Speak])) {
                    client.logger.warn(`[24/7_RECONNECT] Missing permissions for voice channel ${voiceChannel.name} in guild ${guild.name}`);
                    continue;
                }
                const textChannel = client.channels.cache.get(guildData.textChannelId);
                if (!textChannel || !textChannel.isTextBased()) {
                    client.logger.warn(`[24/7_RECONNECT] Text channel ${guildData.textChannelId} not found for guild ${guildData.guildId}`);
                    continue;
                }
                const player = client.manager.create({
                    guildId: guildData.guildId,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: textChannel.id,
                    ...music_1.MUSIC_CONFIG.PLAYER_OPTIONS,
                });
                player.connect();
                client.logger.success(`[24/7_RECONNECT] Reconnected to ${voiceChannel.name} in ${guild.name}`);
                const responseHandler = new music_1.MusicResponseHandler(client);
                const embed = responseHandler.createInfoEmbed(client.localizationManager?.translate('responses.music.twenty_four_seven_reconnected', 'en') || '🔄 24/7 mode: Reconnected after restart');
                await (0, msg_1.send)(client, textChannel.id, { embeds: [embed] }).catch((err) => client.logger.warn(`[24/7_RECONNECT] Failed to send reconnect message: ${err}`));
            }
            catch (error) {
                client.logger.error(`[24/7_RECONNECT] Failed to reconnect guild ${guildData.guildId}: ${error}`);
            }
        }
    }
    catch (error) {
        client.logger.error(`[24/7_RECONNECT] Error during 24/7 reconnect: ${error}`);
    }
};
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.NodeConnect,
    execute: async (node, client) => {
        client.logger.success(`[LAVALINK] Node ${node.options.identifier} connected`);
        patchNodeRest(node, client);
        await reconnectTwentyFourSevenGuilds(client);
    },
};
exports.default = lavalinkEvent;
