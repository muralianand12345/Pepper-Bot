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
            // Get guild data or create if it doesn't exist
            let guildData = await music_guild.findOne({ guildId });

            if (!guildData) {
                // Create default DJ configuration
                const defaultDJConfig: IDJUser = {
                    enabled: false,
                    roleId: null,
                    auto: {
                        assign: true,
                        timeout: 86400000, // 24 hours
                    },
                    users: {
                        currentDJ: null,
                        previousDJs: []
                    }
                };

                // Create new guild document with default DJ config
                guildData = new music_guild({
                    guildId,
                    songChannelId: null,
                    dj: defaultDJConfig,
                    songs: []
                });

                await guildData.save();
            } else if (!guildData.dj) {
                // If guild exists but DJ config doesn't, add default DJ config
                guildData.dj = {
                    enabled: false,
                    roleId: null,
                    auto: {
                        assign: true,
                        timeout: 86400000, // 24 hours
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

            // Update DJ configuration fields with provided values
            if (updateData.enabled !== undefined) guildData.dj.enabled = updateData.enabled;
            if (updateData.roleId) guildData.dj.roleId = updateData.roleId;

            // Update nested properties if provided
            if (updateData.auto) {
                if (updateData.auto.assign !== undefined) guildData.dj.auto.assign = updateData.auto.assign;
                if (updateData.auto.timeout !== undefined) guildData.dj.auto.timeout = updateData.auto.timeout;
            }

            // Update user data if provided
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
        timeWindow: number = 604800000, // 7 days default
        minimumSongs: number = 5
    ): Promise<Array<{ userId: string, username: string, activity: number }>> {
        try {
            // Calculate cutoff timestamp
            const cutoffTime = new Date(Date.now() - timeWindow);

            // Get guild's music history
            const guildData = await music_guild.findOne({ guildId });
            if (!guildData || !guildData.songs || guildData.songs.length === 0) {
                return [];
            }

            // Count songs per user within the time window
            const userActivity = new Map<string, { count: number, username: string }>();

            for (const song of guildData.songs) {
                // Skip songs without requester or timestamp
                if (!song.requester || !song.timestamp) continue;

                // Skip songs outside time window
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

            // Add Spotify presence data from music_user
            const spotifyPresencePromises = Array.from(userActivity.keys()).map(async (userId) => {
                try {
                    const userData = await music_user.findOne({ userId });
                    if (!userData || !userData.songs) return;

                    let spotifyCount = 0;

                    // Count Spotify songs within time window
                    userData.songs.forEach(song => {
                        if (song.timestamp && new Date(song.timestamp) >= cutoffTime) {
                            if (song.sourceName === "Spotify") {
                                spotifyCount++;
                            }
                        }
                    });

                    // Add Spotify activity to total count
                    if (userActivity.has(userId)) {
                        userActivity.get(userId)!.count += spotifyCount;
                    }
                } catch (error) {
                    this.client.logger.error(`[DJ_ROLE] Error processing user ${userId} Spotify data: ${error}`);
                }
            });

            // Wait for all promises to resolve
            await Promise.all(spotifyPresencePromises);

            // Convert to array, filter by minimum requirement, and sort by activity
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
            // Get guild data with DJ configuration
            const guildData = await this.getConfig(guildId);
            if (!guildData || !guildData.dj || !guildData.dj.enabled) {
                return false;
            }

            // Get the Discord guild
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                this.client.logger.error(`[DJ_ROLE] Guild ${guildId} not found for DJ role assignment`);
                return false;
            }

            // Get or create the DJ role
            let role: discord.Role | null = null;

            if (guildData.dj.roleId) {
                role = guild.roles.cache.get(guildData.dj.roleId) || null;
            }

            // Create role if it doesn't exist or if the existing role ID is invalid
            if (!role) {
                try {
                    role = await guild.roles.create({
                        name: this.client.config.bot.features?.dj_role?.default_role_name || "DJ",
                        color: discord.Colors.Purple,
                        reason: "DJ role for music system",
                        permissions: []
                    });

                    // Update role ID in configuration
                    guildData.dj.roleId = role.id;
                    await guildData.save();
                } catch (error) {
                    this.client.logger.error(`[DJ_ROLE] Failed to create DJ role: ${error}`);
                    return false;
                }
            }

            // If there's a current DJ, move them to previous DJs
            if (guildData.dj.users.currentDJ &&
                guildData.dj.users.currentDJ.userId &&
                guildData.dj.users.currentDJ.userId !== userId &&
                this.isValidSnowflake(guildData.dj.users.currentDJ.userId)) {

                // Add current DJ to previous DJs list
                guildData.dj.users.previousDJs.push({
                    userId: guildData.dj.users.currentDJ.userId,
                    username: guildData.dj.users.currentDJ.username || "Unknown",
                    assignedAt: guildData.dj.users.currentDJ.assignedAt || new Date(),
                    expiresAt: guildData.dj.users.currentDJ.expiresAt || new Date()
                });

                // Limit previous DJs list to last 10
                if (guildData.dj.users.previousDJs.length > 10) {
                    guildData.dj.users.previousDJs = guildData.dj.users.previousDJs.slice(-10);
                }

                // Try to remove role from previous DJ
                try {
                    const previousMember = await guild.members.fetch(guildData.dj.users.currentDJ.userId);
                    if (previousMember && role) {
                        await previousMember.roles.remove(role);
                    }
                } catch (error) {
                    this.client.logger.warn(`[DJ_ROLE] Failed to remove DJ role from previous DJ: ${error}`);
                    // Continue despite this error
                }
            }

            // Set the new DJ
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

            // Assign role to the new DJ
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
            // Get guild data with DJ configuration
            const guildData = await this.getConfig(guildId);
            if (!guildData || !guildData.dj || !guildData.dj.enabled || !guildData.dj.roleId) {
                return false;
            }

            // Determine which user to remove the role from
            if (!userId && (!guildData.dj.users.currentDJ || !guildData.dj.users.currentDJ.userId)) {
                // No user specified and no current DJ
                return false;
            }

            const targetUserId = userId || (guildData.dj.users.currentDJ?.userId || null);

            // Validate the user ID is a valid snowflake
            if (!targetUserId || !this.isValidSnowflake(targetUserId)) {
                this.client.logger.warn(`[DJ_ROLE] Invalid user ID for role removal: ${targetUserId}`);

                // Still update the database to remove invalid current DJ
                if (!userId && guildData.dj.users.currentDJ) {
                    // Move to previous DJs list if it's a valid entry
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

                        // Limit previous DJs list
                        if (guildData.dj.users.previousDJs.length > 10) {
                            guildData.dj.users.previousDJs = guildData.dj.users.previousDJs.slice(-10);
                        }
                    }

                    // Clear current DJ
                    guildData.dj.users.currentDJ = null;
                    await guildData.save();
                }

                return true; // Return true because we've cleaned up the database
            }

            // Get the Discord guild
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                this.client.logger.error(`[DJ_ROLE] Guild ${guildId} not found for DJ role removal`);
                return false;
            }

            // Get the role
            const role = guild.roles.cache.get(guildData.dj.roleId);
            if (!role) {
                this.client.logger.error(`[DJ_ROLE] Role ${guildData.dj.roleId} not found in guild ${guildId}`);

                // Update the configuration anyway
                if (!userId && guildData.dj.users.currentDJ) {
                    guildData.dj.users.currentDJ = null;
                    await guildData.save();
                }

                return true; // Return true because we've cleaned up the database
            }

            // If removing the current DJ, update the configuration
            if (!userId || (guildData.dj.users.currentDJ && guildData.dj.users.currentDJ.userId === targetUserId)) {
                if (guildData.dj.users.currentDJ && guildData.dj.users.currentDJ.userId) {
                    // Move to previous DJs list
                    guildData.dj.users.previousDJs.push({
                        userId: guildData.dj.users.currentDJ.userId,
                        username: guildData.dj.users.currentDJ.username || "Unknown",
                        assignedAt: guildData.dj.users.currentDJ.assignedAt || new Date(),
                        expiresAt: guildData.dj.users.currentDJ.expiresAt || new Date()
                    });

                    // Limit previous DJs list to last 10
                    if (guildData.dj.users.previousDJs.length > 10) {
                        guildData.dj.users.previousDJs = guildData.dj.users.previousDJs.slice(-10);
                    }
                }

                // Clear current DJ
                guildData.dj.users.currentDJ = null;
                await guildData.save();
            }

            // Remove the role from the member
            try {
                const member = await guild.members.fetch(targetUserId);
                if (member) {
                    await member.roles.remove(role);
                    return true;
                }
            } catch (error) {
                this.client.logger.error(`[DJ_ROLE] Failed to remove DJ role from user ${targetUserId}: ${error}`);

                // Still return true if we updated the database successfully
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
        // Discord snowflakes are 17-20 digit numbers
        return /^\d{17,20}$/.test(id);
    }

    /**
     * Check for expired DJ roles and process them
     * Should be called periodically from a scheduled task
     */
    public async processExpiredDJs(): Promise<void> {
        try {
            // Find all guilds with DJ role enabled
            const now = new Date();
            const guilds = await music_guild.find({
                "dj.enabled": true,
                "dj.users.currentDJ.userId": { $exists: true, $ne: null },
                "dj.users.currentDJ.expiresAt": { $lt: now }
            });

            // Process each expired DJ
            for (const guildData of guilds) {
                try {
                    // Remove the DJ role
                    await this.removeDJRole(guildData.guildId);

                    // If auto-assign is enabled, find a new DJ
                    if (guildData.dj.auto.assign) {
                        // Find most active users
                        const activeUsers = await this.getMostActiveUsers(
                            guildData.guildId,
                            604800000, // 7 days in milliseconds
                            5 // Minimum 5 songs
                        );

                        // If we found active users, assign the top one
                        if (activeUsers.length > 0) {
                            const nextDJ = activeUsers[0];

                            // Skip if this user was the previous DJ to avoid immediate reassignment
                            if (guildData.dj.users.previousDJs &&
                                guildData.dj.users.previousDJs.length > 0 &&
                                guildData.dj.users.previousDJs[guildData.dj.users.previousDJs.length - 1].userId === nextDJ.userId) {

                                // If we have more than one active user, use the second most active
                                if (activeUsers.length > 1) {
                                    const alternativeDJ = activeUsers[1];
                                    await this.assignDJRole(
                                        guildData.guildId,
                                        alternativeDJ.userId,
                                        alternativeDJ.username
                                    );
                                }
                            } else {
                                // Assign the most active user as DJ
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