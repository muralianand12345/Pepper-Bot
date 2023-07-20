const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: ["support"],
    description: "Sends support server invite link.",
    category: "Utility",
    permissions: {
        channel: [],
        bot: [],
        user: []
    },
    settings: {
        isPremium: false,
        isPlayer: false,
        isOwner: false,
        inVoice: false,
        sameVoice: false,
    },
    run: async (interaction, client, user, language) => {
        await interaction.deferReply({ ephemeral: true });

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Join the support server!', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(client.user.displayAvatarURL())
            .setColor('Red')
            .setDescription('Feel free to join the support server, where you can receive clarifications and support directly from the developers.');
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel(`Join Server`)
                    .setURL('https://discord.gg/sEXavJRqxZ')
                    .setStyle(ButtonStyle.Link)
            )

        return interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    }
}
