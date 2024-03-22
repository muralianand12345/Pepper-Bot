import { EmbedBuilder } from "discord.js";

import { Command } from "../../types";
import blockUserModal from "../../events/database/schema/blockUser";

const blockcommand: Command = {
    name: "blockuser",
    description: "Block a user from using the bot | blockuser <user-id> <true/false> <reason>",
    cooldown: 1000,
    owner: true,
    userPerms: ['Administrator'],
    botPerms: ['Administrator'],
    execute: async (client, message, args) => {

        const userID = args[0];
        const remove = args[1];
        const reason = args.slice(2).join(" ") || "No reason provided";

        if (!userID) return message.channel.send("Please provide a user ID!");
        if (!remove) return message.channel.send("Please provide a valid option! (true/false)");

        if (userID === message.author.id) return message.channel.send("You cannot block yourself!");
        if (userID === client.user?.id) return message.channel.send("You cannot block me!");

        var find = await blockUserModal.findOne({
            userId: userID
        });

        var embed = new EmbedBuilder()
            .setTimestamp();

        if (remove === 'true') {
            if (!find) return message.reply({ embeds: [embed.setDescription("This user is not blocked!")] })
            if (find.status === false) return message.channel.send({ embeds: [embed.setDescription("This user is not blocked!")] });

            find.status = false;
            await find.save();
            return message.channel.send({ embeds: [embed.setDescription("User unblocked!")] });

        } else if (remove === 'false') {

            if (!find) {
                find = new blockUserModal({
                    userId: userID,
                    status: true,
                    data: [{
                        reason: reason
                    }]
                });
                await find.save();
            } else {

                if (find.status === true) return message.channel.send({ embeds: [embed.setDescription("This user is already blocked!")] });

                find.status = true;
                find.data.push({
                    reason: reason
                });
                await find.save();

                return message.channel.send({ embeds: [embed.setDescription("User blocked!")] });
            }
        }
    }
}

export default blockcommand;