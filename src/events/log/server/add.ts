import discord from "discord.js";
import { BotEvent } from "../../../types";

/**
 * Handles Discord guild join (server add) events
 * Creates and sends a detailed embed message to the configured log channel
 *
 * @event GuildCreate
 * @implements {BotEvent}
 *
 * Features:
 * - Tracks new server joins
 * - Creates detailed embed with server information
 * - Logs server statistics
 * - Updates total server count
 *
 * @param {discord.Guild} guild - The guild that was joined
 * @param {discord.Client} client - Discord client instance
 *
 * Embed Information:
 * - Server name and ID
 * - Member count
 * - Owner information
 * - Server creation date
 * - Server icon
 * - Updated total server count
 *
 * @example
 * // Guild create event triggered when bot joins a new server
 * client.emit(Events.GuildCreate, guild);
 *
 * @remarks
 * Requires:
 * - Valid log channel configuration in client.config.bot.log.server
 * - Text channel permissions to send embeds
 */
const event: BotEvent = {
    name: discord.Events.GuildCreate,
    execute: async (
        guild: discord.Guild,
        client: discord.Client
    ): Promise<void> => {
        // Create detailed embed for new server join
        const embed = new discord.EmbedBuilder()
            .setTitle("New Server Joined")
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() || "" })
            .setDescription(
                `I have joined **${guild.name}** (${guild.id}). Now in **${client.guilds.cache.size}** servers.`
            )
            .addFields(
                {
                    name: "Members",
                    value: guild.memberCount?.toString() || "Unknown",
                    inline: true,
                },
                {
                    name: "Owner",
                    value: guild.ownerId
                        ? `<@${guild.ownerId}>`
                        : "Unknown Owner",
                    inline: true,
                },
                {
                    name: "Created",
                    value: guild.createdAt?.toDateString() || "Unknown Date",
                    inline: true,
                }
            )
            .setThumbnail(guild.iconURL() || null)
            .setColor("Green")
            .setFooter({ text: `Now in ${client.guilds.cache.size} servers` })
            .setTimestamp();

        // Get and validate log channel
        const logChannel = client.channels.cache.get(
            client.config.bot.log.server
        ) as discord.TextChannel;
        if (!logChannel?.isTextBased())
            return client.logger.warn(
                `[SERVER] Log channel is not a text channel`
            );

        // Send embed and log event
        logChannel.send({ embeds: [embed] });
        client.logger.info(`[SERVER] Joined ${guild.name} (${guild.id})`);
    },
};

export default event;
