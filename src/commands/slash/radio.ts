import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from "discord.js";
import { SlashCommand } from "../../types";

import { createAudioResource, createAudioPlayer, NoSubscriberBehavior, joinVoiceChannel, getVoiceConnection } from '@discordjs/voice';
import { fetchAudioStream } from "../../utils/musicFunction";

const radiocommand: SlashCommand = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('radio')
        .setDescription("Play Tamil Radios")
        .setDMPermission(false),
    execute: async (interaction, client) => {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        const radioLink = client.config.music.radio;

        client.logger.debug(`User ${interaction.user.tag} (${interaction.user.id}) requested to play radio in ${interaction.guild?.name} (${interaction.guild?.id})`);

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

        if (!interaction.guild.members.me?.permissions.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`Permission to connect or speak in <#${guildMember.voice.channel?.id}> channel is required`)],
            });
        }

        if (!guildMember.voice.channel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first before using this command")],
                ephemeral: true,
            });
        }

        const voiceChannel = guildMember.voice.channel;

        if (!voiceChannel.joinable) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`I don't have permission to join <#${guildMember.voice.channel.id}> channel`)],
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        const connection = getVoiceConnection(interaction.guildId!);

        if (!connection) {
            const voiceConnection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            const audioPlayer = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });

            voiceConnection.subscribe(audioPlayer);

            const audioStream = await fetchAudioStream(radioLink);
            const audioResource = createAudioResource(audioStream);
            audioPlayer.play(audioResource);

            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor('Green').setDescription(`Playing Radio in <#${voiceChannel.id}>`)],
            });

            audioPlayer.on('stateChange', async (_, newState) => {
                if (newState.status === 'autopaused') {
                    if (connection) await voiceConnection.destroy();
                    await interaction.editReply({
                        embeds: [new EmbedBuilder().setColor('Red').setDescription(`No one is listening, Stopped Radio`)],
                    });
                }
            });

        } else {
            if (connection && connection.joinConfig.guildId === interaction.guildId) {
                connection.destroy();
            }
            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor('Green').setDescription(`Stopped Radio`)],
            });
        }
    }
}

export default radiocommand;