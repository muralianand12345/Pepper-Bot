const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');

module.exports = {
    cooldown: 10000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('feedback')
        .setDescription("Your feedback is important to us!")
        .setDMPermission(true),
    async execute(interaction, client) {

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

        const firstActionRow = new ActionRowBuilder().addComponents(feedbackName);
        const secondActionRow = new ActionRowBuilder().addComponents(feedback);

        modal.addComponents(firstActionRow, secondActionRow);
        await interaction.showModal(modal);
    }
}