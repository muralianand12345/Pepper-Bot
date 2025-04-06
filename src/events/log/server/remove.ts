import discord from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: discord.Events.GuildDelete,
    execute: async (
        guild: discord.Guild,
        client: discord.Client
    ): Promise<void> => {
        // Create detailed embed for server leave
        const embed = new discord.EmbedBuilder()
            .setTitle("Server Left")
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() || "" })
            .setDescription(
                `I have left **${guild.name}** (${guild.id}). Now in **${client.guilds.cache.size}** servers.`
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
            .setColor("Red")
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
        client.logger.info(`[SERVER] Left ${guild.name} (${guild.id})`);
    },
};

export default event;
