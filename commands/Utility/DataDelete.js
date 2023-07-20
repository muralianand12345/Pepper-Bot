const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: ["datadelete"],
    description: "Request your data deletion!",
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
            .setAuthor({ name: 'Request your Data Deletion!', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(client.user.displayAvatarURL())
            .setColor('Red')
            .setDescription('Join the support server for data deletion');
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel(`Data Delete`)
                    .setURL('https://discord.gg/sEXavJRqxZ')
                    .setStyle(ButtonStyle.Link)
            )

        return interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    }
}
