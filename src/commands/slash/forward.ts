import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { SlashCommand } from "../../types";

const forwardcommand: SlashCommand = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('forward')
        .setDescription("Forward a currently playing song")
        .setDMPermission(false)
        .addNumberOption(option => option
            .setName('seconds')
            .setDescription('How many seconds to forward?')
            .setRequired(true)
        ),
    execute: async (interaction, client) => {

        await interaction.deferReply({ ephemeral: false });

        const value = interaction.options.getNumber('seconds');

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

        const player = client.manager.get(interaction.guild.id);

        if (!player || !player?.queue?.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music currently playing")],
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

        if (guildMember.voice.channel?.id !== player.voiceChannel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me").setFooter({text: 'If you think there is an issue, kindly contact the server admin to use \`/dcbot\` command.'})],
                ephemeral: true,
            });
        }

        if (value && !isNaN(value)) {

            if (!player.queue.current.duration) {
                return interaction.editReply('Unable to forward the song')
            }

            if ((player.position + value * 1000) < player.queue.current.duration) {
                player.seek(player.position + value * 1000);

                const embed = new EmbedBuilder()
                    .setDescription(`Muisc ${player.queue.current.title} has been forwarded to ${value} seconds`)
                    .setColor('Blue');
                return interaction.editReply({ embeds: [embed] });

            } else {
                return interaction.editReply('You cannot forward beyond the song duration')
            }
        } else {
            return interaction.editReply('Please enter a valid number of seconds to forward')
        }
    }
}

export default forwardcommand;