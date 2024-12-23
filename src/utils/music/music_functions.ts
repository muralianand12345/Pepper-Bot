import discord from "discord.js";
import https from "https";
import { Readable } from "stream";
import timers from "timers/promises";
import { Player, Track } from "magmastream";
import {
    disabldMusicButton,
    musicButton,
    noMusicEmbed,
    musicEmbed
} from "./embed_template";
import { IMusicGuild, IMusicUser } from "../../types";

/**
 * Creates a promise that resolves after the specified milliseconds
 * @param ms - Number of milliseconds to wait
 * @returns Promise that resolves after the specified delay
 */
const wait = async (ms: number): Promise<void> => {
    await timers.setTimeout(ms);
};

/**
 * Formats the queue message for display
 * @param player - Music player instance
 * @returns Formatted queue message string
 */
const formatQueueMessage = (player: Player): string => {
    const queueList = player.queue
        .map((track, i) => `**${i + 1}** - [${track.title}](${track.uri})`)
        .slice(0, 5)
        .join("\n");

    const remainingTracks = player.queue.length > 5
        ? `And **${player.queue.length - 5}** more tracks...`
        : `In the playlist **${player.queue.length}** tracks...`;

    return `Song queue:\n\n${queueList}\n\n${remainingTracks}`;
};

/**
 * Updates the music user database with track information
 * @param data - Music user or guild data object
 * @param track - Track object containing song information
 */
const updateMusicDB = async (data: IMusicUser | IMusicGuild, track: Track): Promise<void> => {
    try {
        data.songsNo = (data.songsNo || 0) + 1;
        const song = data.songs?.find((s) => s.name === track.title);

        if (song) {
            song.times = (song.times || 0) + 1;
        } else {
            data.songs = data.songs || [];
            data.songs.push({
                name: track.title,
                url: track.uri,
                times: 1
            });
        }

        await data.save();
    } catch (error) {
        console.error('Error updating music user database:', error);
        throw error;
    }
};

/**
 * Updates the music guild's message panel with current track information
 * @param client - Discord client instance
 * @param data - Music guild data object
 * @param player - Music player instance
 * @param track - Current track (null if no track is playing)
 * @param off - Boolean indicating if music is turned off
 */
const updateMusicGuildChannelDB = async (
    client: discord.Client,
    data: IMusicGuild,
    player: Player,
    track: Track | null,
    off: boolean
): Promise<void> => {
    try {
        const { musicPannelId, musicChannel } = data;
        if (!musicPannelId) return;

        const pannelChan = client.channels.cache.get(musicChannel) as discord.TextChannel;
        if (!pannelChan) return;

        const pannelMsg = await pannelChan.messages.fetch(musicPannelId).catch(() => null);
        if (!pannelMsg) return;

        const updateData = off
            ? {
                embed: await noMusicEmbed(client),
                embedRow: disabldMusicButton.toJSON(),
                msgContent: (client as any).config.content.text.no_music_playing
            }
            : {
                embed: track ? await musicEmbed(client, track) : null,
                embedRow: musicButton.toJSON(),
                msgContent: track ? formatQueueMessage(player) : undefined
            };

        if (!off && (!updateData.embed || !updateData.msgContent)) return;

        const messageOptions: discord.MessageEditOptions = {
            components: [updateData.embedRow]
        };

        if (updateData.msgContent) {
            messageOptions.content = updateData.msgContent;
        }

        if (updateData.embed) {
            messageOptions.embeds = [updateData.embed];
        }

        await pannelMsg.edit(messageOptions);
    } catch (error) {
        console.error('Error updating music guild database:', error);
        throw error;
    }
};

/**
 * Fetches an audio stream from a given URL
 * @param url - URL of the audio stream
 * @returns Promise resolving to a Readable stream
 * @throws Error if the stream cannot be fetched
 */
const fetchAudioStream = (url: string): Promise<Readable> => {
    return new Promise<Readable>((resolve, reject) => {
        https.get(url, { rejectUnauthorized: false }, response => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to fetch audio stream: ${response.statusCode}`));
                return;
            }
            resolve(response);
        }).on('error', error => {
            reject(new Error(`Error fetching audio stream: ${error.message}`));
        });
    });
};

export {
    wait,
    updateMusicDB,
    updateMusicGuildChannelDB,
    fetchAudioStream
};