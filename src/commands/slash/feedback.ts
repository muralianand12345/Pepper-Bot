import discord from "discord.js";
import { SlashCommand } from "../../types";

/**
 * Slash command for collecting user feedback via a modal form
 * @module FeedbackCommand
 */
const feedbackCommand: SlashCommand = {
    cooldown: 10000,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName('feedback')
        .setDescription('Send feedback to the bot developers')
        .setContexts(discord.InteractionContextType.Guild),

    /**
     * Executes the feedback command by displaying a modal form
     * @param {discord.ChatInputCommandInteraction} interaction - The command interaction
     * @param {discord.Client} client - The Discord client instance
     */
    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
        const createTextInput = (
            id: string,
            label: string,
            placeholder: string,
            style: discord.TextInputStyle,
            required: boolean
        ): discord.TextInputBuilder => {
            return new discord.TextInputBuilder()
                .setCustomId(id)
                .setLabel(label)
                .setPlaceholder(placeholder)
                .setStyle(style)
                .setRequired(required)
                .setMinLength(style === discord.TextInputStyle.Paragraph ? 10 : 0)
                .setMaxLength(style === discord.TextInputStyle.Paragraph ? 4000 : 100);
        };

        try {
            const modal = new discord.ModalBuilder()
                .setCustomId('feedback-modal')
                .setTitle(`${client.user?.username} Feedback`);

            const nameInput = createTextInput(
                'feedback-modal-username',
                'Your Name',
                'Leave blank to be anonymous',
                discord.TextInputStyle.Short,
                false
            ); //actually it's not anonymous

            const feedbackInput = createTextInput(
                'feedback-modal-message',
                'Your Feedback',
                'Please describe your feedback, suggestions, or issues...',
                discord.TextInputStyle.Paragraph,
                true
            );

            modal.addComponents(
                new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(nameInput),
                new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(feedbackInput)
            );

            await interaction.showModal(modal);
        } catch (error) {
            console.error('Error creating feedback modal:', error);
            await interaction.reply({
                content: 'Failed to open feedback form. Please try again later.',
                ephemeral: true
            });
        }
    }
};

export default feedbackCommand;