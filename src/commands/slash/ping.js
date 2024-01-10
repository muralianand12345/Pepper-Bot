const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');

module.exports = {
    cooldown: 10000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Ping Pong!")
        .setDMPermission(true),
    async execute(interaction, client) {

        await interaction.reply({ content: "**🏓 Pong!**" });

        let embed = new EmbedBuilder()
            .addFields({ name: "Ping:", value: Math.round(client.ws.ping) + "ms" })
            .setColor("Random")
            .setTimestamp()
        await interaction.editReply({ embeds: [embed] });
    }
};