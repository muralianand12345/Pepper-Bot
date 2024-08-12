import { Events, InteractionType, EmbedBuilder, Collection, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import ms from "ms";

import { BotEvent } from "../../../types";

import botAnalysis from "../../database/schema/botDataAnalysis";
import checkPremium from "../../database/schema/userPremium";
import blockedUser from "../../database/schema/blockUser";

const cooldown: Collection<string, number> = new Collection();

const event: BotEvent = {
    name: Events.InteractionCreate,
    execute: async (interaction, client) => {

        if (!interaction) return client.logger.warn('No interaction!');

        var botAnalysisData = await botAnalysis.findOne({
            clientId: client.user.id
        });

        if (!botAnalysisData) {
            botAnalysisData = new botAnalysis({
                clientId: client.user.id,
                restartCount: 0,
                interactionCount: 0
            });
            await botAnalysisData.save();
        }

        botAnalysisData.interactionCount += 1;
        await botAnalysisData.save();

        const command = client.slashCommands.get(interaction.commandName);
        if (!command) return;

        if (interaction.isAutocomplete()) {
            try {
                await command.autocomplete(interaction, client);
            } catch (e) {
                client.logger.error(e);
            }
            return;
        }

        if (interaction.type !== InteractionType.ApplicationCommand) return;

        const blockedUserData = await blockedUser.findOne({
            userId: interaction.user.id,
            status: true
        });

        if (blockedUserData) {
            const blockedUserEmbed = new EmbedBuilder()
                .setDescription(`🚫 <@${interaction.user.id}>, **You are blocked from using the bot!**`)
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

            await client.users.cache.get(interaction.user.id).send({
                embeds: [blockedUserEmbed],
                components: [blockerUserButton]
            });

            return interaction.reply({
                embeds: [blockedUserEmbed],
                components: [blockerUserButton],
                ephemeral: true
            });
        }

        try {
            if (command.cooldown) {
                if (cooldown.has(`${command.name}${interaction.user.id}`)) {
                    const cooldownMsg = client.config.bot?.cooldownMsg;
                    const cooldownTime = cooldown.get(`${command.name}${interaction.user.id}`);
                    const remainingCooldown = cooldownTime ? ms(cooldownTime - Date.now(), { long: true }) : "N/A";
                    const coolMsg = cooldownMsg.replace('<duration>', remainingCooldown);
                    const coolEmbed = new EmbedBuilder()
                        .setDescription(`${coolMsg}`)
                        .setColor('#ED4245')
                    return interaction.reply({ embeds: [coolEmbed], ephemeral: true });
                }
                if (interaction.guild) {
                    if (command.owner) {
                        if (!client.config.bot.owners.includes(interaction.user.id)) {
                            const ownerEmbed = new EmbedBuilder()
                                .setDescription(`🚫 <@${interaction.user.id}>, You don't have permission to use this command!`)
                                .setColor('#ED4245')
                            return interaction.reply({ embeds: [ownerEmbed], ephemeral: true });
                        }
                    }

                    if (command.premium) {
                        const member = await checkPremium.findOne({
                            userId: interaction.user.id
                        });
                        if (!member) {
                            const premiumEmbed = new EmbedBuilder()
                                .setDescription(`🚫 <@${interaction.user.id}>, You are not a premium user to use this command!`)
                                .setColor('#ED4245')
                            return interaction.reply({ embeds: [premiumEmbed], ephemeral: true });
                        }
                        if (!member.isPremium) {
                            const premiumEmbed = new EmbedBuilder()
                                .setDescription(`🚫 <@${interaction.user.id}>, You are not a premium user to use this command!`)
                                .setColor('#ED4245')
                            return interaction.reply({ embeds: [premiumEmbed], ephemeral: true });
                        }
                    }
                    if (command.userPerms || command.botPerms) {
                        if (!interaction.member.permissions.has(PermissionsBitField.resolve(command.userPerms || []))) {
                            const userPerms = new EmbedBuilder()
                                .setDescription(`🚫 <@${interaction.user.id}>, You don't have \`${command.userPerms}\` permissions to use this command!`)
                                .setColor('#ED4245')
                            return interaction.reply({ embeds: [userPerms], ephemeral: true });
                        }
                        if (!interaction.guild.members.cache.get(client.user.id).permissions.has(PermissionsBitField.resolve(command.botPerms || []))) {
                            const botPerms = new EmbedBuilder()
                                .setDescription(`🚫 <@${interaction.user.id}>, I don't have \`${command.botPerms}\` permissions to use this command!`)
                                .setColor('#ED4245')
                            return interaction.reply({ embeds: [botPerms], ephemeral: true });
                        }
                    }
                } else {
                    if (command.userPerms || command.botPerms) {
                        return;
                    }
                }

                await command.execute(interaction, client, client.config);

                const logguild = interaction.guild || null;
                const logchannel = interaction.channel || null;
                await client.cmdLogger.log(client, `/${interaction.commandName}`, logguild, interaction.user, logchannel);

                cooldown.set(`${command.name}${interaction.user.id}`, Date.now() + command.cooldown)
                setTimeout(() => {
                    cooldown.delete(`${command.name}${interaction.user.id}`)
                }, command.cooldown);

            } else {

                if (command.owner) {
                    if (!client.config.bot.owners.includes(interaction.user.id)) {
                        const ownerEmbed = new EmbedBuilder()
                            .setDescription(`🚫 <@${interaction.user.id}>, You don't have permission to use this command!`)
                            .setColor('#ED4245')
                        return interaction.reply({ embeds: [ownerEmbed], ephemeral: true });
                    }
                }
                if (command.userPerms || command.botPerms) {
                    if (!interaction.member.permissions.has(PermissionsBitField.resolve(command.userPerms || []))) {
                        const userPerms = new EmbedBuilder()
                            .setDescription(`🚫 <@${interaction.user.id}>, You don't have \`${command.userPerms}\` permissions to use this command!`)
                            .setColor('#ED4245')
                        return interaction.reply({ embeds: [userPerms], ephemeral: true });
                    }
                    if (!interaction.guild.members.cache.get(client.user.id).permissions.has(PermissionsBitField.resolve(command.botPerms || []))) {
                        const botPerms = new EmbedBuilder()
                            .setDescription(`🚫 <@${interaction.user.id}>, I don't have \`${command.botPerms}\` permissions to use this command!`)
                            .setColor('#ED4245')
                        return interaction.reply({ embeds: [botPerms], ephemeral: true });
                    }
                }

                const logguild = interaction.guild || null;
                const logchannel = interaction.channel || null;
                await client.cmdLogger.log(client, `/${interaction.commandName}`, logguild, interaction.user, logchannel);

                await command.execute(interaction, client, client.config);
            }

        } catch (error) {
            client.logger.error(error);
            const botErrorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription('An internal error occurred. Please contact the bot developers.');
            const botErrorButton = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Join Support Server')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://discord.gg/XzE9hSbsNb')
                );

            if (interaction.deferred) {
                return interaction.editReply({ embeds: [botErrorEmbed], components: [botErrorButton], ephemeral: true });
            } else {
                return interaction.reply({ embeds: [botErrorEmbed], components: [botErrorButton], ephemeral: true });
            }
        }
    }
}

export default event;