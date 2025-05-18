import discord from "discord.js";
import music_user from "../../events/database/schema/music_user";
import music_guild from "../../events/database/schema/music_guild";
import { IMusicGuild, IDJUser } from "../../types";

/**
 * Service for managing DJ role assignment and configuration
 */
class DJRoleService {
    private client: discord.Client;

    /**
     * Initialize the DJRoleService
     * @param client Discord.js client instance
     */
    constructor(client: discord.Client) {
        this.client = client;
    }

    /**
     * Get DJ role configuration for a guild
     * @param guildId Guild ID to retrieve configuration for
     * @returns Promise resolving to DJ configuration or null if not found
     */
    public async getConfig(guildId: string): Promise<IMusicGuild | null> {
        try {
            let guildData = await music_guild.findOne({ guildId });

            if (!guildData) {
                const defaultDJConfig: IDJUser = {
                    enabled: false,
                    roleId: null,
                    auto: {
                        assign: true,
                        timeout: 86400000,
                    },
                    users: {
                        currentDJ: null,
                        previousDJs: []
                    }
                };

                guildData = new music_guild({
                    guildId,
                    songChannelId: null,
                    dj: defaultDJConfig,
                    songs: []
                });

                await guildData.save();
            } else if (!guildData.dj) {
                guildData.dj = {
                    enabled: false,
                    roleId: null,
                    auto: {
                        assign: true,
                        timeout: 86400000,
                    },
                    users: {
                        currentDJ: null,
                        previousDJs: []
                    }
                };

                await guildData.save();
            }

            return guildData;
        } catch (error) {
            this.client.logger.error(`[DJ_ROLE] Error getting DJ role config: ${error}`);
            return null;
        }
    }

    /**
     * Update DJ role configuration
     * @param guildId Guild ID to update configuration for
     * @param updateData Partial DJ configuration to update
     * @returns Promise resolving to updated configuration or null if update failed
     */
    public async updateConfig(guildId: string, updateData: Partial<IDJUser>): Promise<IMusicGuild | null> {
        try {
            let guildData = await this.getConfig(guildId);

            if (!guildData) {
                return null;
            }

            if (updateData.enabled !== undefined) guildData.dj.enabled = updateData.enabled;
            if (updateData.roleId) guildData.dj.roleId = updateData.roleId;
            if (updateData.auto) {
                if (updateData.auto.assign !== undefined) guildData.dj.auto.assign = updateData.auto.assign;
                if (updateData.auto.timeout !== undefined) guildData.dj.auto.timeout = updateData.auto.timeout;
            }

            if (updateData.users) {
                if (updateData.users.currentDJ) {
                    if (!guildData.dj.users.currentDJ) {
                        guildData.dj.users.currentDJ = {
                            userId: null,
                            username: null,
                            assignedAt: null,
                            expiresAt: null
                        };
                    }

                    if (updateData.users.currentDJ.userId)
                        guildData.dj.users.currentDJ.userId = updateData.users.currentDJ.userId;
                    if (updateData.users.currentDJ.username)
                        guildData.dj.users.currentDJ.username = updateData.users.currentDJ.username;
                    if (updateData.users.currentDJ.assignedAt)
                        guildData.dj.users.currentDJ.assignedAt = updateData.users.currentDJ.assignedAt;
                    if (updateData.users.currentDJ.expiresAt)
                        guildData.dj.users.currentDJ.expiresAt = updateData.users.currentDJ.expiresAt;
                }

                if (updateData.users.previousDJs) {
                    guildData.dj.users.previousDJs = updateData.users.previousDJs;
                }
            }

            await guildData.save();
            return guildData;
        } catch (error) {
            this.client.logger.error(`[DJ_ROLE] Error updating DJ role config: ${error}`);
            return null;
        }
    }

    /**
     * Get the most active music listeners in a guild
     * @param guildId Guild ID to find active listeners for
     * @param timeWindow Time window in milliseconds to consider (default: 7 days)
     * @param minimumSongs Minimum number of songs played to qualify (default: 5)
     * @returns Promise resolving to array of users sorted by activity
     */
    public async getMostActiveUsers(
        guildId: string,
        timeWindow: number = 604800000,
        minimumSongs: number = 5
    ): Promise<Array<{ userId: string, username: string, activity: number }>> {
        try {
            const cutoffTime = new Date(Date.now() - timeWindow);
            const guildData = await music_guild.findOne({ guildId });
            if (!guildData || !guildData.songs || guildData.songs.length === 0) {
                return [];
            }

            const userActivity = new Map<string, { count: number, username: string }>();

            for (const song of guildData.songs) {
                if (!song.requester || !song.timestamp) continue;

                const songTime = new Date(song.timestamp);
                if (songTime < cutoffTime) continue;

                const userId = song.requester.id;
                const username = song.requester.username;

                if (!userActivity.has(userId)) {
                    userActivity.set(userId, { count: 1, username });
                } else {
                    userActivity.get(userId)!.count++;
                }
            }

            const spotifyPresencePromises = Array.from(userActivity.keys()).map(async (userId) => {
                try {
                    const userData = await music_user.findOne({ userId });
                    if (!userData || !userData.songs) return;

                    let spotifyCount = 0;
                    userData.songs.forEach(song => {
                        if (song.timestamp && new Date(song.timestamp) >= cutoffTime) {
                            if (song.sourceName === "Spotify") {
                                spotifyCount++;
                            }
                        }
                    });

                    if (userActivity.has(userId)) {
                        userActivity.get(userId)!.count += spotifyCount;
                    }
                } catch (error) {
                    this.client.logger.error(`[DJ_ROLE] Error processing user ${userId} Spotify data: ${error}`);
                }
            });

            await Promise.all(spotifyPresencePromises);
            return Array.from(userActivity.entries())
                .map(([userId, data]) => ({
                    userId,
                    username: data.username,
                    activity: data.count
                }))
                .filter(user => user.activity >= minimumSongs)
                .sort((a, b) => b.activity - a.activity);

        } catch (error) {
            this.client.logger.error(`[DJ_ROLE] Error finding active users: ${error}`);
            return [];
        }
    }

    /**
     * Assign DJ role to a user in a guild
     * @param guildId Guild ID to assign role in
     * @param userId User ID to assign role to
     * @param userName Username for logging purposes
     * @param durationMs Duration in milliseconds for the role (null for default timeout)
     * @returns Promise resolving to boolean indicating success
     */
    public async assignDJRole(
        guildId: string,
        userId: string,
        userName: string,
        durationMs: number | null = null
    ): Promise<boolean> {
        try {
            const guildData = await this.getConfig(guildId);
            if (!guildData || !guildData.dj || !guildData.dj.enabled) {
                return false;
            }

            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                this.client.logger.error(`[DJ_ROLE] Guild ${guildId} not found for DJ role assignment`);
                return false;
            }

            let role: discord.Role | null = null;
            if (guildData.dj.roleId) {
                role = guild.roles.cache.get(guildData.dj.roleId) || null;
            }

            if (!role) {
                try {
                    role = await guild.roles.create({
                        name: this.client.config.bot.features?.dj_role?.default_role_name || "DJ",
                        color: discord.Colors.Purple,
                        reason: "DJ role for music system",
                        permissions: []
                    });

                    guildData.dj.roleId = role.id;
                    await guildData.save();
                } catch (error) {
                    this.client.logger.error(`[DJ_ROLE] Failed to create DJ role: ${error}`);
                    return false;
                }
            }

            if (guildData.dj.users.currentDJ &&
                guildData.dj.users.currentDJ.userId &&
                guildData.dj.users.currentDJ.userId !== userId &&
                this.isValidSnowflake(guildData.dj.users.currentDJ.userId)) {

                guildData.dj.users.previousDJs.push({
                    userId: guildData.dj.users.currentDJ.userId,
                    username: guildData.dj.users.currentDJ.username || "Unknown",
                    assignedAt: guildData.dj.users.currentDJ.assignedAt || new Date(),
                    expiresAt: guildData.dj.users.currentDJ.expiresAt || new Date()
                });

                if (guildData.dj.users.previousDJs.length > 10) {
                    guildData.dj.users.previousDJs = guildData.dj.users.previousDJs.slice(-10);
                }

                try {
                    const previousMember = await guild.members.fetch(guildData.dj.users.currentDJ.userId);
                    if (previousMember && role) {
                        await previousMember.roles.remove(role);
                    }
                } catch (error) {
                    this.client.logger.warn(`[DJ_ROLE] Failed to remove DJ role from previous DJ: ${error}`);
                }
            }

            const now = new Date();
            const duration = durationMs || guildData.dj.auto.timeout;
            const expiresAt = new Date(now.getTime() + duration);

            if (!guildData.dj.users.currentDJ) {
                guildData.dj.users.currentDJ = {
                    userId: null,
                    username: null,
                    assignedAt: null,
                    expiresAt: null
                };
            }

            guildData.dj.users.currentDJ.userId = userId;
            guildData.dj.users.currentDJ.username = userName;
            guildData.dj.users.currentDJ.assignedAt = now;
            guildData.dj.users.currentDJ.expiresAt = expiresAt;

            await guildData.save();

            try {
                const member = await guild.members.fetch(userId);
                if (member && role) {
                    await member.roles.add(role);
                    return true;
                } else {
                    return false;
                }
            } catch (error) {
                this.client.logger.error(`[DJ_ROLE] Failed to assign DJ role to user ${userId}: ${error}`);
                return false;
            }
        } catch (error) {
            this.client.logger.error(`[DJ_ROLE] Error assigning DJ role: ${error}`);
            return false;
        }
    }

    /**
     * Remove DJ role from a user
     * @param guildId Guild ID to remove role in
     * @param userId User ID to remove role from (if null, removes from current DJ)
     * @returns Promise resolving to boolean indicating success
     */
    public async removeDJRole(guildId: string, userId: string | null = null): Promise<boolean> {
        try {
            const guildData = await this.getConfig(guildId);
            if (!guildData || !guildData.dj || !guildData.dj.enabled || !guildData.dj.roleId) {
                return false;
            }

            if (!userId && (!guildData.dj.users.currentDJ || !guildData.dj.users.currentDJ.userId)) {
                return false;
            }

            const targetUserId = userId || (guildData.dj.users.currentDJ?.userId || null);

            if (!targetUserId || !this.isValidSnowflake(targetUserId)) {
                this.client.logger.warn(`[DJ_ROLE] Invalid user ID for role removal: ${targetUserId}`);

                if (!userId && guildData.dj.users.currentDJ) {
                    if (guildData.dj.users.currentDJ.userId &&
                        guildData.dj.users.currentDJ.username &&
                        guildData.dj.users.currentDJ.assignedAt &&
                        guildData.dj.users.currentDJ.expiresAt) {

                        guildData.dj.users.previousDJs.push({
                            userId: guildData.dj.users.currentDJ.userId,
                            username: guildData.dj.users.currentDJ.username,
                            assignedAt: guildData.dj.users.currentDJ.assignedAt,
                            expiresAt: guildData.dj.users.currentDJ.expiresAt
                        });

                        if (guildData.dj.users.previousDJs.length > 10) {
                            guildData.dj.users.previousDJs = guildData.dj.users.previousDJs.slice(-10);
                        }
                    }

                    guildData.dj.users.currentDJ = null;
                    await guildData.save();
                }

                return true;
            }

            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                this.client.logger.error(`[DJ_ROLE] Guild ${guildId} not found for DJ role removal`);
                return false;
            }

            const role = guild.roles.cache.get(guildData.dj.roleId);
            if (!role) {
                this.client.logger.error(`[DJ_ROLE] Role ${guildData.dj.roleId} not found in guild ${guildId}`);

                if (!userId && guildData.dj.users.currentDJ) {
                    guildData.dj.users.currentDJ = null;
                    await guildData.save();
                }

                return true;
            }

            if (!userId || (guildData.dj.users.currentDJ && guildData.dj.users.currentDJ.userId === targetUserId)) {
                if (guildData.dj.users.currentDJ && guildData.dj.users.currentDJ.userId) {
                    guildData.dj.users.previousDJs.push({
                        userId: guildData.dj.users.currentDJ.userId,
                        username: guildData.dj.users.currentDJ.username || "Unknown",
                        assignedAt: guildData.dj.users.currentDJ.assignedAt || new Date(),
                        expiresAt: guildData.dj.users.currentDJ.expiresAt || new Date()
                    });

                    if (guildData.dj.users.previousDJs.length > 10) {
                        guildData.dj.users.previousDJs = guildData.dj.users.previousDJs.slice(-10);
                    }
                }

                guildData.dj.users.currentDJ = null;
                await guildData.save();
            }

            try {
                const member = await guild.members.fetch(targetUserId);
                if (member) {
                    await member.roles.remove(role);
                    return true;
                }
            } catch (error) {
                this.client.logger.error(`[DJ_ROLE] Failed to remove DJ role from user ${targetUserId}: ${error}`);
                return true;
            }

            return false;
        } catch (error) {
            this.client.logger.error(`[DJ_ROLE] Error removing DJ role: ${error}`);
            return false;
        }
    }

    /**
     * Check if a string is a valid Discord snowflake (user ID)
     * @param id String to validate
     * @returns Boolean indicating if the ID is a valid snowflake
     */
    private isValidSnowflake(id: string): boolean {
        return /^\d{17,20}$/.test(id);
    }

    /**
     * Check for expired DJ roles and process them
     * Should be called periodically from a scheduled task
     */
    public async processExpiredDJs(): Promise<void> {
        try {
            const now = new Date();
            const guilds = await music_guild.find({
                "dj.enabled": true,
                "dj.users.currentDJ.userId": { $exists: true, $ne: null },
                "dj.users.currentDJ.expiresAt": { $lt: now }
            });

            for (const guildData of guilds) {
                try {
                    await this.removeDJRole(guildData.guildId);
                    if (guildData.dj.auto.assign) {
                        const activeUsers = await this.getMostActiveUsers(
                            guildData.guildId,
                            604800000,
                            5
                        );

                        if (activeUsers.length > 0) {
                            const nextDJ = activeUsers[0];
                            if (guildData.dj.users.previousDJs &&
                                guildData.dj.users.previousDJs.length > 0 &&
                                guildData.dj.users.previousDJs[guildData.dj.users.previousDJs.length - 1].userId === nextDJ.userId) {

                                if (activeUsers.length > 1) {
                                    const alternativeDJ = activeUsers[1];
                                    await this.assignDJRole(
                                        guildData.guildId,
                                        alternativeDJ.userId,
                                        alternativeDJ.username
                                    );
                                }
                            } else {
                                await this.assignDJRole(
                                    guildData.guildId,
                                    nextDJ.userId,
                                    nextDJ.username
                                );
                            }
                        }
                    }
                } catch (innerError) {
                    this.client.logger.error(`[DJ_ROLE] Error processing expired DJ for guild ${guildData.guildId}: ${innerError}`);
                }
            }
        } catch (error) {
            this.client.logger.error(`[DJ_ROLE] Error processing expired DJs: ${error}`);
        }
    }
}

export default DJRoleService;