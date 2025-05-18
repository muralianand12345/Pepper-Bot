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
        if (!newPresence || !newPresence.member || !newPresence.guild) return;
        if (!client.config.bot.features?.spotify_presence?.enabled) return;
        if (newPresence.user?.bot) return;

        try {
            const guildData = await music_guild.findOne({ guildId: newPresence.guild.id });
            if (!guildData || !guildData.dj || !guildData.dj.enabled || !guildData.dj.auto.assign) return;

            if (guildData.dj.users.currentDJ &&
                guildData.dj.users.currentDJ.userId &&
                guildData.dj.users.currentDJ.expiresAt) {

                const now = new Date();
                const expiryTime = new Date(guildData.dj.users.currentDJ.expiresAt);

                if (now > expiryTime) {
                    const djService = new DJRoleService(client);
                    await djService.processExpiredDJs();
                    const updatedGuildData = await music_guild.findOne({ guildId: newPresence.guild.id });
                    if (!updatedGuildData) return;
                    if (updatedGuildData.dj.users.currentDJ && updatedGuildData.dj.users.currentDJ.userId) {
                        return;
                    }
                }
            }

            const spotifyActivity = newPresence.activities.find(
                activity => activity.type === discord.ActivityType.Listening &&
                    activity.name === "Spotify"
            );

            if (!spotifyActivity) return;

            const userId = newPresence.user?.id || "";
            const username = newPresence.user?.username || "";

            if (!guildData.dj.users.currentDJ || !guildData.dj.users.currentDJ.userId) {

                const djService = new DJRoleService(client);
                const activeUsers = await djService.getMostActiveUsers(
                    newPresence.guild.id,
                    3600000,
                    3
                );

                const userActivity = activeUsers.find(user => user.userId === userId);
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