import discord from "discord.js";
import { ConfigManager } from "../../../utils/config";
import { MusicResponseHandler } from "../../../utils/music/embed_template";
import { BotEvent } from "../../../types";

const processFeedback = (
    feedback: string,
    maxLength: number = 1000
): string[] =>
    feedback.match(new RegExp(`[\\s\\S]{1,${maxLength}}`, "g")) || [];

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

const event: BotEvent = {
    name: discord.Events.InteractionCreate,
    execute: async (
        interaction: discord.Interaction,
        client: discord.Client
    ): Promise<void> => {
        if (
            !interaction.isModalSubmit() ||
            interaction.customId !== "feedback-modal"
        )
            return;

        try {
            const configManager = ConfigManager.getInstance();
            const webhookClient = new discord.WebhookClient({
                url: configManager.getFeedbackWebhook(),
            });

            const username =
                interaction.fields.getTextInputValue(
                    "feedback-modal-username"
                ) || "Anonymous";
            const feedback =
                interaction.fields.getTextInputValue(
                    "feedback-modal-message"
                ) || "No message provided";

            const feedbackChunks = processFeedback(feedback);
            const feedbackEmbed = createFeedbackEmbed(
                interaction,
                client,
                username,
                feedbackChunks
            );

            await webhookClient.send({ embeds: [feedbackEmbed] });
            await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createSuccessEmbed(
                        "Thank you for your feedback!"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        } catch (error) {
            client.logger.error(
                `[FEEDBACK_MODALS] Failed to submit feedback: ${error}`
            );
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
    },
};

export default event;
