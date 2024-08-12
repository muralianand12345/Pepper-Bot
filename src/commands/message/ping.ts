import { EmbedBuilder } from "discord.js";
import { Command } from "../../types";

const command: Command = {
    name: 'ping',
    description: 'Replies with pong!',
    cooldown: 10000,
    owner: false,
    execute: async (client, message, args) => {

        await message.reply("**🏓 Pong!**");

        let embed = new EmbedBuilder()
            .addFields({ name: "Ping:", value: Math.round(client.ws.ping) + "ms" })
            .setColor("Random")
            .setTimestamp()
        await message.channel.send({ embeds: [embed] });
    }
}

export default command;