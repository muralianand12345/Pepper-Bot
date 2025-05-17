import discord from "discord.js";
import { ConfigManager } from "../../../utils/config";
import { MusicResponseHandler } from "../../../utils/music/embed_template";
import { BotEvent } from "../../../types";

/**
 * Processes feedback text into chunks for embedding
 * @param feedback The feedback text to process
 * @param maxLength Maximum length for each chunk
 * @returns Array of feedback chunks
 */
const processFeedback = (
    feedback: string,
    maxLength: number = 1000
): string[] =>
    feedback.match(new RegExp(`[\\s\\S]{1,${maxLength}}`, "g")) || [];

/**
 * Creates a feedback embed for regular feedback submissions
 * @param interaction Modal submit interaction with feedback
 * @param client Discord client instance
 * @param username Username to display 
 * @param feedback Array of feedback text chunks
 * @returns Configured embed for regular feedback
 */
const createFeedbackEmbed = (
    interaction: discord.ModalSubmitInteraction,
    client: discord.Client,
    username: string,
    feedback: string[]
): discord.EmbedBuilder => {
    const embed = new discord.EmbedBuilder()
        .setColor("#2B2D31")
        .setAuthor({
            name: username,
            iconURL: interaction.user.displayAvatarURL({ size: 128 }),
        })
        .setTitle("📝 New Feedback Received")
        .setDescription(
            `> 🔍 From: ${interaction.user.tag}\n> 📍 Channel: ${interaction.channel?.toString() || "DM"
            }`
        )
        .addFields(
            {
                name: "🎭 User Information",
                value: [
                    `• **ID:** \`${interaction.user.id}\``,
                    `• **Name:** ${interaction.user.toString()}`,
                    `• **Joined:** <t:${Math.floor(
                        interaction.user.createdTimestamp / 1000
                    )}:R>`,
                ].join("\n"),
                inline: true,
            },
            {
                name: "🌐 Server Details",
                value: interaction.guild
                    ? [
                        `• **ID:** \`${interaction.guild.id}\``,
                        `• **Name:** ${interaction.guild.name}`,
                        `• **Members:** ${interaction.guild.memberCount}`,
                    ].join("\n")
                    : "• Direct Message",
                inline: true,
            }
        )
        .setFooter({
            text: `${client.user?.username} Feedback System`,
            iconURL: client.user?.displayAvatarURL(),
        })
        .setTimestamp();

    feedback.forEach((chunk, index) => {
        const fieldName =
            index === 0
                ? "💭 Feedback Content"
                : `📝 Continued (Part ${index + 1})`;
        embed.addFields({
            name: fieldName,
            value: `\`\`\`${chunk}\`\`\``,
            inline: false,
        });
    });

    return embed;
};

/**
 * Creates a feedback embed for server leave feedback
 * @param interaction Modal submit interaction with feedback
 * @param client Discord client instance 
 * @param guildId ID of the guild the bot was removed from
 * @param feedbackData Structured feedback data from the modal
 * @returns Configured embed for server leave feedback
 */
const createServerLeaveFeedbackEmbed = (
    interaction: discord.ModalSubmitInteraction,
    client: discord.Client,
    guildId: string,
    feedbackData: {
        audioQuality: string;
        usability: string;
        features: string;
        issues: string;
        reason: string;
    }
): discord.EmbedBuilder => {
    return new discord.EmbedBuilder()
        .setColor("#ED4245") // Discord red for server leave feedback
        .setTitle("📝 Server Leave Feedback")
        .setAuthor({
            name: interaction.user.tag,
            iconURL: interaction.user.displayAvatarURL({ size: 128 }),
        })
        .setDescription(`Feedback from **${interaction.user.tag}** after removing the bot from a server.\n\nServer ID: \`${guildId}\``)
        .addFields(
            {
                name: "🎵 Audio Quality Rating",
                value: `**${feedbackData.audioQuality}/5**`,
                inline: true,
            },
            {
                name: "🔧 Usability Rating",
                value: `**${feedbackData.usability}/5**`,
                inline: true,
            },
            {
                name: "🧩 Features Feedback",
                value: feedbackData.features || "No feedback provided",
                inline: false,
            },
            {
                name: "⚠️ Issues Experienced",
                value: feedbackData.issues || "No issues reported",
                inline: false,
            },
            {
                name: "❌ Removal Reason",
                value: feedbackData.reason,
                inline: false,
            },
            {
                name: "💡 User Information",
                value: `• ID: \`${interaction.user.id}\`\n• Created: <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`,
                inline: false,
            }
        )
        .setFooter({
            text: `Server Leave Feedback | ${new Date().toLocaleDateString()}`,
            iconURL: client.user?.displayAvatarURL(),
        })
        .setTimestamp();
};

const event: BotEvent = {
    name: discord.Events.InteractionCreate,
    execute: async (
        interaction: discord.Interaction,
        client: discord.Client
    ): Promise<void> => {
        // Handle only modal submit interactions
        if (!interaction.isModalSubmit()) return;

        try {
            const configManager = ConfigManager.getInstance();
            const webhookUrl = configManager.getFeedbackWebhook();

            if (!webhookUrl) {
                client.logger.error(`[FEEDBACK] No feedback webhook URL configured`);
                if (!interaction.replied) {
                    await interaction.reply({
                        embeds: [
                            new MusicResponseHandler(client).createErrorEmbed(
                                "Unable to process feedback due to missing configuration. Please contact the bot developers.",
                                true
                            )
                        ],
                        flags: discord.MessageFlags.Ephemeral,
                    });
                }
                return;
            }

            const webhookClient = new discord.WebhookClient({ url: webhookUrl });

            // Handle regular feedback modal
            if (interaction.customId === "feedback-modal") {
                const username = interaction.fields.getTextInputValue("feedback-modal-username") || "Anonymous";
                const feedback = interaction.fields.getTextInputValue("feedback-modal-message") || "No message provided";

                const feedbackChunks = processFeedback(feedback);
                const feedbackEmbed = createFeedbackEmbed(interaction, client, username, feedbackChunks);

                await webhookClient.send({ embeds: [feedbackEmbed] });
                await interaction.reply({
                    embeds: [
                        new MusicResponseHandler(client).createSuccessEmbed("Thank you for your feedback!")
                    ],
                    flags: discord.MessageFlags.Ephemeral,
                });

                client.logger.info(`[FEEDBACK] Received feedback from ${interaction.user.tag} (${interaction.user.id})`);
            }
            // Handle server leave feedback modal
            else if (interaction.customId.startsWith("feedback_modal_")) {
                // Extract guild ID from the custom ID
                const guildId = interaction.customId.replace("feedback_modal_", "");

                // Get values from the modal
                const audioQuality = interaction.fields.getTextInputValue("feedback_quality");
                const usability = interaction.fields.getTextInputValue("feedback_usability");
                const features = interaction.fields.getTextInputValue("feedback_features");
                const issues = interaction.fields.getTextInputValue("feedback_issues");
                const reason = interaction.fields.getTextInputValue("feedback_reason");

                // Create feedback data object
                const feedbackData = {
                    audioQuality,
                    usability,
                    features,
                    issues,
                    reason
                };

                // Create and send feedback embed
                const feedbackEmbed = createServerLeaveFeedbackEmbed(
                    interaction,
                    client,
                    guildId,
                    feedbackData
                );

                await webhookClient.send({ embeds: [feedbackEmbed] });

                // Thank the user for their feedback
                await interaction.reply({
                    content: `Thank you for your valuable feedback! We'll use it to improve ${client.user?.username} Music Bot for everyone.`,
                    flags: discord.MessageFlags.Ephemeral,
                });

                client.logger.info(`[FEEDBACK] Received server leave feedback from ${interaction.user.tag} (${interaction.user.id}) for guild ${guildId}`);
            }
        } catch (error) {
            client.logger.error(`[FEEDBACK_MODAL] Failed to process feedback: ${error}`);

            // Reply if not already replied to
            if (!interaction.replied) {
                await interaction.reply({
                    embeds: [
                        new MusicResponseHandler(client).createErrorEmbed(
                            "Failed to submit feedback. Please try again later.",
                            true
                        ),
                    ],
                    components: [
                        new MusicResponseHandler(client).getSupportButton(),
                    ],
                    flags: discord.MessageFlags.Ephemeral,
                });
            }
        }
    },
};

export default event;