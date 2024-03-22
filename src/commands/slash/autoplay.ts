import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from "discord.js";
import { SlashCommand } from "../../types";

const autoplaycommand: SlashCommand = {
    cooldown: 1000,
    owner: false,
    premium: true,
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription("AutoPlay music")
        .setDMPermission(true),
    execute: async (interaction, client) => {

        if (!interaction.guild) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("This command can only be used in server")],
                ephemeral: true,
            });
        }

        const guildMember = interaction.guild.members.cache.get(interaction.user.id);

        if (!guildMember) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Member not found")],
                ephemeral: true,
            });
        }

        const { channel } = guildMember.voice;

        if (!channel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first before using this command")],
                ephemeral: true,
            });
        }

        if (!interaction.guild.members.me?.permissions.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`Permission to connect or speak in <#${channel.id}> channel is required`)],
            });
        }

        if (!channel.joinable) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`I don't have permission to join <#${channel.id}> channel`)],
                ephemeral: true,
            });
        }

        const player = client.manager.get(interaction.guild.id);

        if (!player) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("I'm not connected to any voice channel!")],
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: false });

        const autoplay = player.get("autoplay");

        if (autoplay === true) {
            player.set("autoplay", false);
            const embed = new EmbedBuilder()
                .setDescription(`Autoplay is now disabled`)
                .setColor('Red');
            return interaction.editReply({ embeds: [embed] });
        } else {
            player.set("autoplay", true);
            const embed = new EmbedBuilder()
                .setDescription(`Autoplay is now enabled`)
                .setColor('Green');

            return interaction.editReply({ embeds: [embed] });
        }
    }
}

export default autoplaycommand;