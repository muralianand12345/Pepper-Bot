import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

import musicModel from "../../events/database/schema/musicGuild";
import { updateMusicChannel } from "../../utils/musicFunction";
import { SlashCommand } from "../../types";

const stopcommand: SlashCommand = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription("Stop Music")
        .setDMPermission(false),
    execute: async (interaction, client) => {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        if (!interaction.guild) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("This command can only be used in server")],
                ephemeral: true,
            });
        }

        const player = client.manager.get(interaction.guild.id);

        if (!player || !player?.queue?.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
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

        if (guildMember.voice.channel?.id !== player.voiceChannel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me").setFooter({text: 'If you think there is an issue, kindly contact the server admin to use \`/dcbot\` command.'})],
                ephemeral: true,
            });
        }

        var musicData = await musicModel.findOne({
            guildId: interaction.guild.id
        });

        if (musicData) {
            await updateMusicChannel(client, musicData, player, null, true);
        }

        player.destroy();
        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription("I stopped the music!")],
        });
    }
}

export default stopcommand;