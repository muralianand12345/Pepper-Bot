import discord from "discord.js";
import { SlashCommand } from "../../types";

const pingcommand: SlashCommand = {
    cooldown: 10000,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with pong!'),
    execute: async (interaction, client) => {

        await interaction.reply({ content: "**🏓 Pong!**" });

        let embed = new discord.EmbedBuilder()
            .addFields({ name: "Ping:", value: Math.round(client.ws.ping) + "ms" })
            .setColor("Random")
            .setTimestamp()
        await interaction.editReply({ embeds: [embed] });
    }
}

export default pingcommand;