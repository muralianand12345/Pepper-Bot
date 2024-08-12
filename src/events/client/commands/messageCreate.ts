import { Events, Message, EmbedBuilder, Collection, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import ms from "ms";

import { BotEvent } from "../../../types";

import botAnalysis from "../../database/schema/botDataAnalysis";
import checkPremium from "../../database/schema/userPremium";
import blockedUser from "../../database/schema/blockUser";

const cooldown: Collection<string, number> = new Collection();

const event: BotEvent = {
    name: Events.MessageCreate,
    execute: async (message, client) => {

        if (client.config.bot.disableMessage) return;
        if (message.author.bot) return;

        const prefix = client.config.bot.prefix;
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/g);
        const cmd = args.shift().toLowerCase();
        if (cmd.length == 0) return;

        var botAnalysisData = await botAnalysis.findOne({
            clientId: client.user.id
        });

        if (!botAnalysisData) {
            botAnalysisData = new botAnalysis({
                clientId: client.user.id,
                restartCount: 0,
                commandCount: 0
            });
            await botAnalysisData.save();
        }

        try {

            let command = client.commands.get(cmd);
            if (command == null) return;
            if (!command) command = client.commands.get(client.aliases.get(cmd));

            if (command) {
                const blockedUserData = await blockedUser.findOne({
                    userId: message.author.id,
                    status: true
                });

                if (blockedUserData) {
                    const blockedUserEmbed = new EmbedBuilder()
                        .setDescription(`🚫 <@${message.author.id}>, **You are banned from using the bot!**`)
                        .setFooter({ text: `If you have any clarification, kindly join our support server.` })
                        .setColor('Red')
                        .setTimestamp();

                    const blockerUserButton = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel('Join Support Server')
                                .setStyle(ButtonStyle.Link)
                                .setURL('https://discord.gg/XzE9hSbsNb')
                        );

                    await client.users.cache.get(message.author.id).send({
                        embeds: [blockedUserEmbed],
                        components: [blockerUserButton]
                    });

                    return message.channel.send({
                        embeds: [blockedUserEmbed],
                        components: [blockerUserButton]
                    }).then((m: Message) => setTimeout(async () => await m.delete(), 5000));
                }

                if (command.cooldown) {

                    if (cooldown.has(`${command.name}${message.author.id}`)) {
                        const cooldownMsg = client.config.bot?.cooldownMsg;
                        const cooldownTime = cooldown.get(`${command.name}${message.author.id}`);
                        const remainingCooldown = cooldownTime ? ms(cooldownTime - Date.now(), { long: true }) : "N/A";
                        const coolMsg = cooldownMsg.replace('<duration>', remainingCooldown);

                        const coolEmbed = new EmbedBuilder()
                            .setDescription(`${coolMsg}`)
                            .setColor('#ED4245');
                        return message.channel.send({ embeds: [coolEmbed] }).then((msg: Message) => {
                            setTimeout(function () {
                                msg.delete();
                            }, 4000);
                        });
                    }

                    if (command.owner) {
                        if (!client.config.bot.owners.includes(message.author.id)) {
                            const ownerEmbed = new EmbedBuilder()
                                .setDescription(`🚫 <@${message.author.id}>, You don't have permission to use this command!`)
                                .setColor('#ED4245')
                            return message.channel.send({ embeds: [ownerEmbed] }).then((msg: Message) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }
                    }

                    if (command.premium) {
                        const member = await checkPremium.findOne({
                            userId: message.author.id
                        });

                        if (!member) {
                            const premiumEmbed = new EmbedBuilder()
                                .setDescription(`🚫 <@${message.author.id}>, You are not a premium user to use this command!`)
                                .setColor('#ED4245')
                            return message.channel.send({ embeds: [premiumEmbed] }).then((msg: Message) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }

                        if (!member.isPremium) {
                            const premiumEmbed = new EmbedBuilder()
                                .setDescription(`🚫 <@${message.author.id}>, You are not a premium user to use this command!`)
                                .setColor('#ED4245')
                            return message.channel.send({ embeds: [premiumEmbed] }).then((msg: Message) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }
                    }

                    if (command.userPerms || command.botPerms) {
                        if (!message.member.permissions.has(PermissionsBitField.resolve(command.userPerms || []))) {
                            const userPerms = new EmbedBuilder()
                                .setDescription(`🚫 ${message.author}, You don't have \`${command.userPerms}\` permissions to use this command!`)
                                .setColor('#ED4245');
                            return message.reply({ embeds: [userPerms] }).then((msg: Message) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }

                        if (!message.guild.members.cache.get(client.user.id).permissions.has(PermissionsBitField.resolve(command.botPerms || []))) {
                            const botPerms = new EmbedBuilder()
                                .setDescription(`🚫 ${message.author}, I don't have \`${command.botPerms}\` permissions to use this command!`)
                                .setColor('#ED4245');
                            return message.reply({ embeds: [botPerms] }).then((msg: Message) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }
                    }

                    const logguild = message.guild || null;
                    const logchannel = message.channel || null;
                    await client.cmdLogger.log(client, `${client.config.bot.prefix}${command.name}`, logguild, message.author, logchannel);

                    command.execute(client, message, args);

                    cooldown.set(`${command.name}${message.author.id}`, Date.now() + command.cooldown);
                    setTimeout(() => {
                        cooldown.delete(`${command.name}${message.author.id}`);
                    }, command.cooldown);

                } else {

                    if (command.owner) {
                        if (!client.config.bot.owners.includes(message.author.id)) {
                            const ownerEmbed = new EmbedBuilder()
                                .setDescription(`🚫 <@${message.author.id}>, You don't have permission to use this command!`)
                                .setColor('#ED4245')
                            return message.channel.send({ embeds: [ownerEmbed] }).then((msg: Message) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }
                    }

                    if (command.userPerms || command.botPerms) {
                        if (!message.member.permissions.has(PermissionsBitField.resolve(command.userPerms || []))) {
                            const userPerms = new EmbedBuilder()
                                .setDescription(`🚫 ${message.author}, You don't have \`${command.userPerms}\` permissions to use this command!`)
                                .setColor('#ED4245');
                            return message.reply({ embeds: [userPerms] }).then((msg: Message) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }

                        if (!message.guild.members.cache.get(client.user.id).permissions.has(PermissionsBitField.resolve(command.botPerms || []))) {
                            const botPerms = new EmbedBuilder()
                                .setDescription(`🚫 ${message.author}, I don't have \`${command.botPerms}\` permissions to use this command!`)
                                .setColor('#ED4245');
                            return message.reply({ embeds: [botPerms] }).then((msg: Message) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }
                    }

                    const logguild = message.guild || null;
                    const logchannel = message.channel || null;
                    await client.cmdLogger.log(client, `${client.config.bot.prefix}${command.name}`, logguild, message.author, logchannel);

                    command.execute(client, message, args);
                }

                botAnalysisData.commandCount += 1;
                await botAnalysisData.save();
            }


        } catch (error) {
            client.logger.error(error);
            const botErrorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription('An Internal **Error** Occurred, Kindly Contact The Bot Developers!');
            const botErrorButton = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Join Support Server')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://discord.gg/XzE9hSbsNb')
                );
            return message.reply({ embeds: [botErrorEmbed], components: [botErrorButton], ephemeral: true }).then((msg: Message) => {
                setTimeout(function () {
                    msg.delete();
                }, 4000);
            });
        }
    }
}

export default event;