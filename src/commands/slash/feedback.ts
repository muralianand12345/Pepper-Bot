import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";

import { SlashCommand } from "../../types";

const feedbackcommand: SlashCommand = {
    cooldown: 10000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('feedback')
        .setDescription("Your feedback is important to us!")
        .setDMPermission(true),
    execute: async (interaction, client) => {

        const modal = new ModalBuilder()
            .setCustomId('feedback-modal')
            .setTitle(`${client.config.bot.name} Feedback`);

        const feedbackName = new TextInputBuilder()
            .setCustomId('feedback-modal-name')
            .setLabel("Your Name")
            .setPlaceholder("Leave blank to be anonymous")
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const feedback = new TextInputBuilder()
            .setCustomId('feedback-modal-feedback')
            .setLabel("Your Feedback")
            .setPlaceholder("Your feedback here...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(feedbackName);
        const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(feedback);

        modal.addComponents(firstActionRow, secondActionRow);
        await interaction.showModal(modal);
    }
}

export default feedbackcommand;