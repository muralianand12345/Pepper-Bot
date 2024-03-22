import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { SlashCommand } from "../../types";

import musicModel from "../../events/database/schema/musicGuild";

const set24x7command: SlashCommand = {
    owner: false,
    premium: true,
    data: new SlashCommandBuilder()
        .setName('set24x7')
        .setDescription("Sets 24 X 7 in VC Mode")
        .setDMPermission(false)
        .addBooleanOption(option => option
            .setName('status')
            .setDescription('Status of 24 X 7')
            .setRequired(true)
        ),
    execute: async (interaction, client) => {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        const status = interaction.options.getBoolean("status");

        if (!status) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please provide a valid status")],
                ephemeral: true,
            });
        }

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

        if (!guildMember.voice.channel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")],
                ephemeral: true,
            });
        }

        const musicData = await musicModel.findOne({
            guildId: interaction.guild.id,
        });

        if (!musicData) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Use `/premium setup` first to use this command!")],
                ephemeral: true,
            });
        }

        if (status === true) {
            musicData.status247 = true;
            await musicData.save();
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Green').setDescription("24 X 7 Mode is now enabled")],
                ephemeral: true,
            });
        } else if (status === false) {
            musicData.status247 = false;
            await musicData.save();
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Green').setDescription("24 X 7 Mode is now disabled")],
                ephemeral: true,
            });
        }
    }
}

export default set24x7command;