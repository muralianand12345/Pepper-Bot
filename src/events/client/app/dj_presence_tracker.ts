import discord from "discord.js";
import { BotEvent } from "../../../types";
import music_guild from "../../database/schema/music_guild";
import DJRoleService from "../../../utils/music/dj_role_service";

const event: BotEvent = {
    name: discord.Events.PresenceUpdate,
    execute: async (
        oldPresence: discord.Presence | null,
        newPresence: discord.Presence | null,
        client: discord.Client
    ): Promise<void> => {
        // Skip if no new presence data
        if (!newPresence || !newPresence.member || !newPresence.guild) return;

        // Skip if feature is disabled in config
        if (!client.config.bot.features?.spotify_presence?.enabled) return;

        //check if the user is a bot
        if (newPresence.user?.bot) return;

        try {
            // Check if this guild has DJ role enabled
            const guildData = await music_guild.findOne({ guildId: newPresence.guild.id });
            if (!guildData || !guildData.dj || !guildData.dj.enabled || !guildData.dj.auto.assign) return;

            // Check if the DJ role has expired but wasn't removed yet
            if (guildData.dj.users.currentDJ &&
                guildData.dj.users.currentDJ.userId &&
                guildData.dj.users.currentDJ.expiresAt) {

                const now = new Date();
                const expiryTime = new Date(guildData.dj.users.currentDJ.expiresAt);

                if (now > expiryTime) {
                    // DJ role has expired, get the DJ service to handle it
                    const djService = new DJRoleService(client);
                    await djService.processExpiredDJs();

                    // Re-fetch guild data
                    const updatedGuildData = await music_guild.findOne({ guildId: newPresence.guild.id });
                    if (!updatedGuildData) return;

                    // Check if guild has a DJ after processing
                    if (updatedGuildData.dj.users.currentDJ && updatedGuildData.dj.users.currentDJ.userId) {
                        return; // A new DJ was already assigned
                    }
                }
            }

            // Check if the user is listening to Spotify
            const spotifyActivity = newPresence.activities.find(
                activity => activity.type === discord.ActivityType.Listening &&
                    activity.name === "Spotify"
            );

            if (!spotifyActivity) return;

            // Get basic user info for logging
            const userId = newPresence.user?.id || "";
            const username = newPresence.user?.username || "";

            // Check if the guild has no current DJ
            if (!guildData.dj.users.currentDJ || !guildData.dj.users.currentDJ.userId) {
                // Only take action if the user has been actively listening for a while
                // We'll need to check their activity level

                const djService = new DJRoleService(client);
                const activeUsers = await djService.getMostActiveUsers(
                    newPresence.guild.id,
                    3600000, // 1 hour timeframe
                    3        // At least 3 songs
                );

                // Find this user in the active users list
                const userActivity = activeUsers.find(user => user.userId === userId);

                // If this user is active enough, make them the DJ
                if (userActivity) {
                    await djService.assignDJRole(
                        newPresence.guild.id,
                        userId,
                        username
                    );

                    client.logger.info(`[DJ_ROLE] Assigned DJ role to ${username} (${userId}) based on Spotify activity in ${newPresence.guild.name}`);
                }
            }
        } catch (error) {
            client.logger.error(`[DJ_ROLE] Error in presence tracker: ${error}`);
        }
    }
};

export default event;