const {
    Events,
    EmbedBuilder,
    Collection,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const botAnalysis = require('../database/modals/botDataAnalysis.js');
const checkPremium = require('../database/modals/userPremium.js');
const blockedUser = require('../database/modals/blockUser.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {

        if (!interaction.isModalSubmit()) return;

        if (interaction.customId == 'msg-commands-modal') {
            const messageContent = interaction.fields.getTextInputValue('msg-command-commandName');
            const prefix = client.config.bot.prefix;

            if (!messageContent.startsWith(prefix)) return interaction.reply({ content: `Use ${prefix} Prefix`, ephemeral: true });

            const args = messageContent.slice(prefix.length).trim().split(/ +/);
            const cmd = args.shift().toLowerCase();
            if (cmd.length == 0) return interaction.reply({ content: `This is not a valid command`, ephemeral: true });

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

                await interaction.deferReply({ ephemeral: true });

                let command = client.messageCommands.get(cmd);
                if (command == null) return await interaction.editReply({ content: `This is not a valid command`, ephemeral: true });

                if (!command) command = client.messageCommands.get(client.aliases.get(cmd));
                if (command) {

                    const blockedUserData = await blockedUser.findOne({
                        userId: interaction.user.id,
                        status: true
                    });

                    if (blockedUserData) {
                        const blockedUserEmbed = new EmbedBuilder()
                            .setDescription(`🚫 <@${interaction.user.id}>, **You are banned from using the bot!**`)
                            .setFooter({ text: `If you have any clarification, kindly join our support server.` })
                            .setColor('Red')
                            .setTimestamp();

                        const blockerUserButton = new ActionRowBuilder()
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

                        return await interaction.editReply({
                            embeds: [blockedUserEmbed],
                            components: [blockerUserButton],
                            ephemeral: true
                        });
                    }

                    if (command.cooldown) {
                        if (cooldown.has(`${command.name}${interaction.user.id}`)) {
                            var coolMsg = client.config.bot["cooldownMsg"].replace('<duration>', ms(cooldown.get(`${command.name}${interaction.user.id}`) - Date.now(), { long: true }));
                            const coolEmbed = new EmbedBuilder()
                                .setDescription(`${coolMsg}`)
                                .setColor('#ED4245');
                            return await interaction.editReply({
                                embeds: [coolEmbed],
                                ephemeral: true
                            });
                        }

                        if (command.owner) {
                            if (!client.config.bot.owners.includes(interaction.user.id)) {
                                const ownerEmbed = new EmbedBuilder()
                                    .setDescription(`🚫 <@${interaction.user.id}>, You don't have permission to use this command!`)
                                    .setColor('#ED4245')
                                return await interaction.editReply({
                                    embeds: [ownerEmbed],
                                    ephemeral: true
                                });
                            }
                        }

                        if (command.premium) return await interaction.editReply({ content: `Premium command doesn't work using \`/msgcommand\``, ephemeral: true });

                        if (command.userPerms || command.botPerms) {
                            if (!interaction.member.permissions.has(PermissionsBitField.resolve(command.userPerms || []))) {
                                const userPerms = new EmbedBuilder()
                                    .setDescription(`🚫 ${message.author}, You don't have \`${command.userPerms}\` permissions to use this command!`)
                                    .setColor('#ED4245');
                                return await interaction.editReply({
                                    embeds: [userPerms],
                                    ephemeral: true
                                });
                            }

                            if (!interaction.guild.members.cache.get(client.user.id).permissions.has(PermissionsBitField.resolve(command.botPerms || []))) {
                                const botPerms = new EmbedBuilder()
                                    .setDescription(`🚫 ${message.author}, I don't have \`${command.botPerms}\` permissions to use this command!`)
                                    .setColor('#ED4245');
                                return await interaction.editReply({
                                    embeds: [botPerms],
                                    ephemeral: true
                                });
                            }
                        }
                    }

                    const logguild = interaction.guild || null;
                    const logchannel = interaction.channel || null;
                    await client.cmdLogger.log(client, `${client.config.bot.prefix}${command.name}`, logguild, interaction.user, logchannel);

                    command.execute(client, interaction, args);

                    cooldown.set(`${command.name}${message.author.id}`, Date.now() + command.cooldown);
                    setTimeout(() => {
                        cooldown.delete(`${command.name}${message.author.id}`);
                    }, command.cooldown);
                }

            } catch (error) {

            }



        }

    }
}