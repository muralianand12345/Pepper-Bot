import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { SlashCommand } from "../../types";

import musicModel from "../../events/database/schema/musicGuild";
import { updateMusicChannel } from "../../utils/musicFunction";

const skipcommand: SlashCommand = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription("Skip Music")
        .setDMPermission(false)
        .addIntegerOption(option => option
            .setName('amount')
            .setDescription('Amount of songs to skip')
            .setRequired(false)
        ),
    execute: async (interaction, client) => {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        if (!interaction.guild) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("This command can only be used in server")],
                ephemeral: true,
            });
        }

        const player = client.manager.get(interaction.guild.id);
        const count = interaction.options.getInteger("amount") || 1;

        if (!count) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please provide a valid amount")],
                ephemeral: true,
            });
        }

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

        if (player.queue.size < count) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`There are only ${player.queue.size} songs in the queue`)],
                ephemeral: true,
            });
        }

        player.stop(count);

        if (player.queue.size === 0) {
            var musicData = await musicModel.findOne({
                guildId: interaction.guild.id
            });

            if (musicData) {
                await updateMusicChannel(client, musicData, player, null, true);
            }

            player.destroy();
        }

        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription(`I skipped ${count} songs!`)],
        });
    }
};

export default skipcommand;