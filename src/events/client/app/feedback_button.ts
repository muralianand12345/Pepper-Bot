import discord from "discord.js";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: discord.Events.InteractionCreate,
    execute: async (
        interaction: discord.Interaction,
        client: discord.Client
    ): Promise<void> => {
        if (!interaction.isButton() || !interaction.customId.startsWith('feedback_request_')) {
            return;
        }

        try {
            const guildId = interaction.customId.replace('feedback_request_', '');

            const modal = new discord.ModalBuilder()
                .setCustomId(`feedback_modal_${guildId}`)
                .setTitle(`${client.user?.username || "Pepper"} Feedback`);

            const qualityInput = new discord.TextInputBuilder()
                .setCustomId('feedback_quality')
                .setLabel('How would you rate the audio quality? (1-5)')
                .setPlaceholder('e.g., 4')
                .setStyle(discord.TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(1);

            const usabilityInput = new discord.TextInputBuilder()
                .setCustomId('feedback_usability')
                .setLabel('How easy was it to use? (1-5)')
                .setPlaceholder('e.g., 3')
                .setStyle(discord.TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(1);

            const featuresInput = new discord.TextInputBuilder()
                .setCustomId('feedback_features')
                .setLabel('Did it have all features you needed?')
                .setPlaceholder('If not, what was missing?')
                .setStyle(discord.TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(1000);

            const issuesInput = new discord.TextInputBuilder()
                .setCustomId('feedback_issues')
                .setLabel('Did you experience any issues?')
                .setPlaceholder('Disconnections, lag, delays?')
                .setStyle(discord.TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(1000);

            const reasonInput = new discord.TextInputBuilder()
                .setCustomId('feedback_reason')
                .setLabel('Why did you remove the bot?')
                .setPlaceholder('Main reason for removal')
                .setStyle(discord.TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000);

            modal.addComponents(
                new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(qualityInput),
                new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(usabilityInput),
                new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(featuresInput),
                new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(issuesInput),
                new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(reasonInput),
            );

            await interaction.showModal(modal);
            client.logger.debug(`[FEEDBACK] Showed server leave feedback modal to ${interaction.user.tag} (${interaction.user.id})`);
        } catch (error) {
            client.logger.error(`[FEEDBACK] Error showing feedback modal: ${error}`);

            try {
                if (interaction.isRepliable()) {
                    await interaction.reply({
                        content: "Sorry, there was an error displaying the feedback form. Please try again later or join our support server.",
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                client.logger.error(`[FEEDBACK] Failed to send error reply: ${replyError}`);
            }
        }
    },
};

export default event;