import discord from "discord.js";
import { Player, Track } from "magmastream";
import {
    LavalinkEvent,
    IMusicGuild
} from '../../../../types';
import MusicGuildModel from "../../../database/schema/music_guild";
import MusicUserModel from "../../../database/schema/music_user";
import { updateMusicGuildChannelDB, updateMusicDB } from "../../../../utils/music/music_functions";


/**
 * Creates a new music guild data instance
 * @param player - Music player instance
 * @param messageId - ID of the message to be used as panel
 * @returns New music guild data object
 */
const createMusicGuildData = (player: Player, messageId: string): Partial<IMusicGuild> => ({
    guildId: player.guild,
    musicChannel: player.textChannel!,
    musicPannelId: messageId,
    status247: false,
    songsNo: 0,
    songs: []
});

/**
 * Creates a track start notification embed
 * @param track - Track that started playing
 * @param client - Discord client instance
 * @returns EmbedBuilder instance
 */
const createTrackStartEmbed = (track: Track, client: discord.Client): discord.EmbedBuilder => {
    return new discord.EmbedBuilder()
        .setDescription(`🎵 ${track.title}`)
        .setColor(client.config.content.embed.music_playing.color as discord.ColorResolvable);
};

/**
 * Handles track start event logging
 * @param track - Track that started playing
 * @param player - Music player instance
 * @param client - Discord client instance
 */
const logTrackStart = (track: Track, player: Player, client: discord.Client): void => {
    const guildName = client.guilds.cache.get(player.guild)?.name;
    const requester = track.requester as discord.User;

    client.logger.debug(
        `[LAVALINK] Track ${track.title} started playing in ${guildName} (${player.guild}) ` +
        `By ${requester.tag} (${requester.id})`
    );
    client.logger.debug(
        `[LAVALINK] User: ${requester.tag} (${requester.id}) requested song uri ${track.uri} ` +
        `in ${guildName} (${player.guild})`
    );
};

/**
 * Handle music data updates for both user and guild
 * @param track - Current track
 * @param guildData - Guild music data
 * @param userId - Requester's user ID
 */
const handleMusicDataUpdates = async (
    track: Track,
    guildData: IMusicGuild,
    userId: string
): Promise<void> => {
    let userData = await MusicUserModel.findOne({ userId }) ||
        new MusicUserModel({
            userId,
            songsNo: 0,
            songs: []
        });

    await Promise.all([
        updateMusicDB(userData, track),
        updateMusicDB(guildData, track)
    ]);
};

/**
 * Lavalink track start event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: "trackStart",
    execute: async (player: Player, track: Track, client: discord.Client) => {
        if (!player?.textChannel || !client?.channels) return;

        try {
            const channel = await client.channels.fetch(player.textChannel) as discord.TextChannel;
            if (!channel?.isTextBased() || player.trackRepeat) return;

            const message = await channel.send({
                embeds: [createTrackStartEmbed(track, client)]
            });

            const musicGuildData = await MusicGuildModel.findOne({ guildId: player.guild }) ||
                new MusicGuildModel(createMusicGuildData(player, message.id));

            await updateMusicGuildChannelDB(client, musicGuildData, player, track, false);

            const requesterId = (track.requester as discord.User)?.id;
            if (requesterId) {
                await handleMusicDataUpdates(track, musicGuildData, requesterId);
            }

            // Delete track start notification after 5 seconds
            setTimeout(() => message.delete().catch(() => { }), 5000);

            logTrackStart(track, player, client);
        } catch (error) {
            client.logger?.error(`Error in trackStart event: ${error}`);
        }
    }
};

export default lavalinkEvent;