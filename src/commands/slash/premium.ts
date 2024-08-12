import { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, Embed } from "discord.js";
import moment from "moment";

import { SlashCommand } from "../../types";
import userPremiumModal from "../../events/database/schema/userPremium";
import premiumRedeemModal from "../../events/database/schema/redeemCode";
import musicModal from "../../events/database/schema/musicGuild";
import { musicContent, musicrowdis, musicEmbedOff } from "../../utils/musicEmbed";

const premiumcommand: SlashCommand = {
    cooldown: 10000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription("Setup premium")
        .setDMPermission(true)
        .addSubcommand((subcommand) => subcommand
            .setName("redeem")
            .setDescription("Redeem a premium code")
            .addStringOption((option) => option
                .setName("code")
                .setDescription("Redeem Code")
                .setRequired(true))
        )
        .addSubcommand((subcommand) => subcommand
            .setName("setup")
            .setDescription("Setup premium")
        )
        .addSubcommand((subcommand) => subcommand
            .setName("status")
            .setDescription("Check premium status")
            .addBooleanOption((option) => option
                .setName("remove")
                .setDescription("Remove premium")
                .setRequired(false)
            )
        ),

    execute: async (interaction, client) => {

        if (interaction.options.getSubcommand() === "redeem") {
            const input = interaction.options.getString("code");

            if (!input) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("Please provide a code!")],
                    ephemeral: true,
                });
            }

            let member = await userPremiumModal.findOne({
                userId: interaction.user.id
            });

            if (!member) {
                member = new userPremiumModal({
                    userId: interaction.user.id,
                    isPremium: false,
                    premium: {
                        redeemedBy: null,
                        redeemedAt: null,
                        expiresAt: null,
                        plan: null
                    }
                });
                await member.save();
            }

            if (member.isPremium) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("You are already premium user!")],
                    ephemeral: true,
                });
            }

            const premium = await premiumRedeemModal.findOne({
                code: input.toUpperCase()
            });

            if (premium) {
                const expires = moment(premium.expiresAt).format('do/MMMM/YYYY (HH:mm:ss)');
                member.isPremium = true;
                member.premium.redeemedBy = interaction.user.id;
                member.premium.redeemedAt = Date.now();
                member.premium.expiresAt = premium.expiresAt;
                member.premium.plan = premium.plan;

                await member.save();
                await premium.deleteOne();

                const embed = new EmbedBuilder()
                    .setTitle("Premium Redeemed")
                    .setDescription(`**Plan:** ${premium.plan}\n**Expires:** ${expires}`)
                    .setColor("#00FF00")
                    .setFooter({ text: interaction.user.tag, iconURL: interaction.user.avatarURL() || "" })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            } else {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("Invalid code!")],
                    ephemeral: true,
                });
            }
        }

        if (interaction.options.getSubcommand() === "setup") {

            if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")] });

            await interaction.deferReply({ ephemeral: true });

            if (interaction.inCachedGuild() && !interaction.member?.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("You don't have permission to use this command!")],
                    ephemeral: true,
                });
            }

            var musicData = await musicModal.findOne({
                guildId: interaction.guild?.id
            });

            if (!musicData) {
                musicData = new musicModal({
                    guildId: interaction.guild?.id,
                    musicChannel: null
                });
            }

            if (interaction.channel?.type === ChannelType.GuildText) {
                var channel = await interaction.guild?.channels.create({
                    name: "music channel",
                    type: ChannelType.GuildText,
                    topic: `${client.user?.tag} | Music Search`,
                    parent: interaction.channel?.parent,
                });
            } else {
                return interaction.editReply({ content: "Failed to create music channel!" });
            }

            if (!channel) {
                return interaction.editReply({ content: "Failed to create music channel!" });
            }

            const musicembed = musicEmbedOff(client);

            const musicmsg = await channel.send({ content: musicContent, embeds: [(await musicembed).toJSON()], components: [musicrowdis] });

            musicData.musicChannel = channel.id;
            musicData.musicPannelId = musicmsg.id;
            await musicData.save();

            return await interaction.editReply({ content: "Music channel created!" });
        }

        if (interaction.options.getSubcommand() === "status") {

            await interaction.deferReply({ ephemeral: true });

            var embed = new EmbedBuilder()
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.avatarURL() || "" });

            let member = await userPremiumModal.findOne({
                userId: interaction.user.id
            });

            if (interaction.options.getBoolean("remove")) {
                if (member) {
                    member.isPremium = false;
                    member.premium.redeemedBy = "null";
                    member.premium.redeemedAt = null;
                    member.premium.expiresAt = null;
                    member.premium.plan = "null";
                    await member.save();

                    embed.addFields({ name: "Premium", value: "Premium removed!" });
                }
            }

            if (!member) {
                embed.setDescription("You are not a premium user 😔")
                    .setColor('Red');
            } else {
                if (member.isPremium) {
                    const expires = moment(member.premium.expiresAt).format('do/MMMM/YYYY (HH:mm:ss)');
                    embed.setDescription(`**Plan:** ${member.premium.plan}\n**Expires:** ${expires}`)
                        .setColor("Green");
                } else {
                    embed.setDescription("You are not a premium user 😔")
                        .setColor('Red');
                }
            }

            return await interaction.editReply({ embeds: [embed] });
        }
    }
}

export default premiumcommand;