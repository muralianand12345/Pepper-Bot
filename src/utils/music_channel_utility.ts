import discord from "discord.js";
import music_guild from "../events/database/schema/music_guild";


/**
 * Checks if a channel is the dedicated music channel for a guild
 * @param channelId - The channel ID to check
 * @param guildId - The guild ID
 * @param client - Discord client instance for logging
 * @returns Promise resolving to boolean indicating if this is the music panel channel
 */
export const isMusicPanelChannel = async (
    channelId: string,
    guildId: string,
    client: discord.Client
): Promise<boolean> => {
    try {
        const guildData = await music_guild.findOne({ guildId });
        if (!guildData || !guildData.songChannelId) return false;

        // Return true if this channel matches the configured music channel
        return guildData.songChannelId === channelId;
    } catch (error) {
        client.logger.error(`[MUSIC_CHANNEL] Error checking music panel channel: ${error}`);
        return false;
    }
};

/**
 * Gets the music panel message ID for a guild if it exists
 * @param guildId - The guild ID 
 * @returns Promise resolving to the message ID or null if not found
 */
export const getMusicPanelMessageId = async (
    guildId: string
): Promise<string | null> => {
    try {
        const guildData = await music_guild.findOne({ guildId });
        return guildData?.musicPannelId || null;
    } catch (error) {
        return null;
    }
};

/**
 * Determines whether the message should be sent in this channel
 * based on channel type and if it's the dedicated music channel
 * @param channelId - The channel ID to check
 * @param guildId - The guild ID
 * @param client - Discord client instance
 * @returns Promise resolving to boolean indicating if messages should be sent
 */
export const shouldSendMessageInChannel = async (
    channelId: string,
    guildId: string,
    client: discord.Client
): Promise<boolean> => {
    // Only prevent messages in the dedicated music channel
    const isMusicChannel = await isMusicPanelChannel(channelId, guildId, client);
    return !isMusicChannel;
};