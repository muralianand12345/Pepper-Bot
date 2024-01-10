const {
    Events,
    EmbedBuilder,
    Collection,
    PermissionsBitField
} = require('discord.js');
const cooldown = new Collection();
const ms = require('ms');

const botAnalysis = require('../../database/modals/botDataAnalysis.js');
const checkPremium = require('../../database/modals/userPremium.js');

module.exports = {
    name: Events.MessageCreate,
    execute: async (message, client) => {

        if (message.author.bot) return;

        const botReply = [
            "Hello! How can I help you?",
            "Yes, how can I help you?",
            "Raise a ticket, we are happy to help you!",
            "At your service ❤️",
            "Yes Sir!",
            "How may I assist you?",
            "I'm here to help. What can I do for you?",
            "Good day! How can I be of service?",
            "I'm all ears. What do you need help with?",
            "Hello! What can I do for you today?"
        ];

        const randomIndex = Math.floor(Math.random() * (botReply.length - 1) + 1);
        const newActivity = botReply[randomIndex];

        //mention reply
        const mention = new RegExp(`^<@!?${client.user.id}>( |)$`);
        if (message.content.match(mention)) {
            return message.reply({ content: newActivity });
        }

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

            let command = client.messageCommands.get(cmd);

            if (command == null) return;

            if (!command) command = client.messageCommands.get(client.aliases.get(cmd));
            if (command) {
                if (command.cooldown) {

                    if (cooldown.has(`${command.name}${message.author.id}`)) {
                        var coolMsg = client.config.bot["cooldownMsg"].replace('<duration>', ms(cooldown.get(`${command.name}${message.author.id}`) - Date.now(), { long: true }));
                        const coolEmbed = new EmbedBuilder()
                            .setDescription(`${coolMsg}`)
                            .setColor('#ED4245');
                        return message.channel.send({ embeds: [coolEmbed] }).then((msg) => {
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
                            return message.channel.send({ embeds: [ownerEmbed] }).then((msg) => {
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
                            return message.channel.send({ embeds: [premiumEmbed] }).then((msg) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }

                        if (!member.isPremium) {
                            const premiumEmbed = new EmbedBuilder()
                                .setDescription(`🚫 <@${message.author.id}>, You are not a premium user to use this command!`)
                                .setColor('#ED4245')
                            return message.channel.send({ embeds: [premiumEmbed] }).then((msg) => {
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
                            return message.reply({ embeds: [userPerms] }).then((msg) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }

                        if (!message.guild.members.cache.get(client.user.id).permissions.has(PermissionsBitField.resolve(command.botPerms || []))) {
                            const botPerms = new EmbedBuilder()
                                .setDescription(`🚫 ${message.author}, I don't have \`${command.botPerms}\` permissions to use this command!`)
                                .setColor('#ED4245');
                            return message.reply({ embeds: [botPerms] }).then((msg) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }
                    }

                    //log
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
                            return message.channel.send({ embeds: [ownerEmbed] }).then((msg) => {
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
                            return message.reply({ embeds: [userPerms] }).then((msg) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }

                        if (!message.guild.members.cache.get(client.user.id).permissions.has(PermissionsBitField.resolve(command.botPerms || []))) {
                            const botPerms = new EmbedBuilder()
                                .setDescription(`🚫 ${message.author}, I don't have \`${command.botPerms}\` permissions to use this command!`)
                                .setColor('#ED4245');
                            return message.reply({ embeds: [botPerms] }).then((msg) => {
                                setTimeout(function () {
                                    msg.delete();
                                }, 4000);
                            });
                        }
                    }

                    //log
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
            return message.reply({
                embeds: [botErrorEmbed],
                ephemeral: true
            }).then((msg) => {
                setTimeout(function () {
                    msg.delete();
                }, 4000);
            });
        }
    }
};