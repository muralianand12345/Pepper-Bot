import discord from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: discord.Events.GuildDelete,
    execute: async (
        guild: discord.Guild,
        client: discord.Client
    ): Promise<void> => {
        try {
            // Log server leave event
            client.logger.info(`[SERVER_LEAVE] Left ${guild.name} (${guild.id})`);

            // Create detailed embed for server leave (existing functionality)
            const leaveEmbed = new discord.EmbedBuilder()
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
            if (logChannel?.isTextBased()) {
                await logChannel.send({ embeds: [leaveEmbed] });
            }

            // Send feedback request DM to server owner
            await sendFeedbackRequestDM(guild, client);
        } catch (error) {
            client.logger.error(`[SERVER_LEAVE] Error handling guild delete event: ${error}`);
        }
    },
};

/**
 * Sends a feedback request DM to the server owner when the bot is kicked from a server
 * @param guild The guild that removed the bot
 * @param client Discord client instance
 */
const sendFeedbackRequestDM = async (
    guild: discord.Guild,
    client: discord.Client
): Promise<void> => {
    try {
        // Skip if there's no owner ID
        if (!guild.ownerId) {
            client.logger.warn(`[FEEDBACK] Cannot send feedback DM - no owner ID for guild ${guild.id}`);
            return;
        }

        // Try to fetch the guild owner
        const owner = await client.users.fetch(guild.ownerId).catch((error) => {
            client.logger.error(`[FEEDBACK] Failed to fetch guild owner: ${error}`);
            return null;
        });

        if (!owner) {
            client.logger.warn(`[FEEDBACK] Cannot send feedback DM - owner not found for guild ${guild.id}`);
            return;
        }

        // Create the feedback request embed
        const feedbackEmbed = new discord.EmbedBuilder()
            .setColor("#5865F2") // Discord blurple
            .setTitle("Your Feedback Matters!")
            .setThumbnail(client.user?.displayAvatarURL() || null)
            .setDescription(
                `Thank you for trying ${client.user?.username} Music Bot! We noticed the bot is no longer in your server.\n\n` +
                "We'd love to hear your feedback to improve our service. Your insights are valuable to us!"
            )
            .setFooter({
                text: `${client.user?.username || "Pepper"} Music Bot`,
                iconURL: client.user?.displayAvatarURL() || undefined,
            });

        // Create feedback button
        const actionRow = new discord.ActionRowBuilder<discord.ButtonBuilder>()
            .addComponents(
                new discord.ButtonBuilder()
                    .setCustomId(`feedback_request_${guild.id}`)
                    .setLabel("Share Feedback")
                    .setStyle(discord.ButtonStyle.Primary)
                    .setEmoji("📝"),
                new discord.ButtonBuilder()
                    .setLabel(`Re-Invite ${client.user?.username} Bot`)
                    .setStyle(discord.ButtonStyle.Link)
                    .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands`)
                    .setEmoji("🎵"),
                new discord.ButtonBuilder()
                    .setLabel("Support Server")
                    .setStyle(discord.ButtonStyle.Link)
                    .setURL("https://discord.gg/XzE9hSbsNb")
                    .setEmoji("🔧")
            );

        // Send DM with feedback request
        await owner.send({
            content: `Hello! This is **${client.user?.username}**, the music bot that was recently removed from **${guild.name}**.`,
            embeds: [feedbackEmbed],
            components: [actionRow]
        }).then(() => {
            client.logger.info(`[FEEDBACK] Sent feedback request DM to ${owner.tag} (${owner.id}) for guild ${guild.name} (${guild.id})`);
        }).catch((error) => {
            client.logger.error(`[FEEDBACK] Failed to send DM to owner: ${error}`);
        });
    } catch (error) {
        client.logger.error(`[FEEDBACK] Error sending feedback request DM: ${error}`);
    }
};

export default event;