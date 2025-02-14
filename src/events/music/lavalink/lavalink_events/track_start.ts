import discord from "discord.js";
import { Player, Track, TrackStartEvent } from "magmastream";
import { sendTempMessage } from "../../../../utils/music/music_functions";
import { MusicResponseHandler } from "../../../../utils/music/embed_template";
import { LavalinkEvent } from "../../../../types";

/**
 * Creates a track start notification embed
 * @param track - Track that started playing
 * @param client - Discord client instance
 * @returns EmbedBuilder instance
 */
const createTrackStartEmbed = (
    track: Track,
    client: discord.Client
): discord.EmbedBuilder => {
    return new MusicResponseHandler(client).createSuccessEmbed(
        `🎵 ${track.title}`
    );
};

/**
 * Handles track start event logging
 * @param track - Track that started playing
 * @param player - Music player instance
 * @param client - Discord client instance
 */
const logTrackStart = (
    track: Track,
    player: Player,
    client: discord.Client
): void => {
    const guildName = client.guilds.cache.get(player.guildId)?.name;
    const requester = track.requester as discord.User;

    client.logger.debug(
        `[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guildId}) ` +
            `By ${requester.tag} (${requester.id})`
    );
    client.logger.debug(
        `[LAVALINK] User: ${requester.tag} (${requester.id}) requested song uri ${track.uri} ` +
            `in ${guildName} (${player.guildId})`
    );
};

/**
 * Lavalink track start event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: "trackStart",
    execute: async (
        player: Player,
        track: Track,
        payload: TrackStartEvent,
        client: discord.Client
    ) => {
        if (!player?.textChannelId || !client?.channels) return;

        try {
            const channel = (await client.channels.fetch(
                player.textChannelId
            )) as discord.TextChannel;
            if (!channel?.isTextBased() || player.trackRepeat) return;

            // Delete track start notification after 5 seconds
            sendTempMessage(
                channel,
                createTrackStartEmbed(track, client),
                track.duration
            );

            logTrackStart(track, player, client);
        } catch (error) {
            client.logger?.error(`Error in trackStart event: ${error}`);
        }
    },
};

export default lavalinkEvent;
