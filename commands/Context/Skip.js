const { EmbedBuilder, ApplicationCommandType } = require('discord.js');

module.exports = { 
    name: ["Context | Skip"],
    type: ApplicationCommandType.Message,
    category: "Context",
    permissions: {
        channel: [],
        bot: [],
        user: []
    },
    settings: {
        isPremium: false,
        isPlayer: true,
        isOwner: false,
        inVoice: false,
        sameVoice: true,
    },
    run: async (interaction, client, user, language, player) => {
        await interaction.deferReply({ ephemeral: false });

        if (player.queue.size == 0) {
            await player.destroy();
            await client.UpdateMusic(player);

            const embed = new EmbedBuilder()
                .setDescription(`${client.i18n.get(language, "music", "skip_msg")}`)
                .setColor(client.color);
    
            return interaction.editReply({ embeds: [embed] });
        } else {
            await player.stop();

            const embed = new EmbedBuilder()
                .setDescription(`${client.i18n.get(language, "music", "skip_msg")}`)
                .setColor(client.color);
    
            return interaction.editReply({ embeds: [embed] });
        }
    }
}