const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

module.exports = {
    cooldown: 1000,
    owner: true,
    userPerms: ['Administrator'],
    botPerms: ['Administrator'],
    data: new SlashCommandBuilder()
        .setName('msgcommand')
        .setDescription('Message Command'),
    async execute(interaction, client) {

        const msgComModal = new ModalBuilder()
            .setCustomId('msg-commands-modal')
            .setTitle('Message Command');

        const msgInput1 = new TextInputBuilder()
            .setCustomId('msg-command-commandName')
            .setLabel('Command Name')
            .setPlaceholder('Enter the command')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const msgRow = new ActionRowBuilder().addComponents(msgInput1);
        msgComModal.addComponents(msgRow);

        await interaction.showModal(msgComModal);
    }
}