import { Events, EmbedBuilder } from 'discord.js';

import musicModel from '../../database/schema/musicGuild';
import { updateMusicChannel } from '../../../utils/musicFunction';

import { BotEvent } from '../../../types';

const event: BotEvent = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {

        if (!interaction.isButton()) return;

        var musicData;

        if (interaction.customId == "pause-music") {

            const player = client.manager.get(interaction.guild.id);

            if (!player || !player?.queue?.current) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
                    ephemeral: true,
                });
            }

            if (!interaction.member.voice.channel) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")],
                    ephemeral: true,
                });
            }

            if (interaction.member.voice.channel?.id !== player.voiceChannel) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me")],
                    ephemeral: true,
                });
            }

            if (player.paused) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("The music is already paused")],
                    ephemeral: true,
                });
            }

            player.pause(true);
            interaction.reply({
                embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription("Paused the music!")],
                ephemeral: true,
            });
        }

        if (interaction.customId == "resume-music") {

            const player = client.manager.get(interaction.guild.id);

            if (!player || !player?.queue?.current) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
                    ephemeral: true,
                });
            }

            if (!interaction.member.voice.channel) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")],
                    ephemeral: true,
                });
            }

            if (interaction.member.voice.channel?.id !== player.voiceChannel) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me")],
                    ephemeral: true,
                });
            }

            if (!player.paused) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("The music is already playing")],
                    ephemeral: true,
                });
            }

            player.pause(false);
            interaction.reply({
                embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription("Resumed the music!")],
                ephemeral: true,
            });
        }

        if (interaction.customId == "skip-music") {

            const player = client.manager.get(interaction.guild.id);
            const count = 1;

            if (!player || !player?.queue?.current) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
                    ephemeral: true,
                });
            }

            if (!interaction.member.voice.channel) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")],
                    ephemeral: true,
                });
            }

            if (interaction.member.voice.channel?.id !== player.voiceChannel) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me")],
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
                musicData = await musicModel.findOne({
                    guildId: interaction.guild.id
                });

                if (musicData) {
                    await updateMusicChannel(client, musicData, player, null, true);
                }

                player.destroy();
            }

            await interaction.reply({
                embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription(`I skipped ${count} song!`)],
                ephemeral: true,
            });
        }

        if (interaction.customId == "stop-music") {

            const player = client.manager.get(interaction.guild.id);

            if (!player || !player?.queue?.current) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
                    ephemeral: true,
                });
            }

            if (!interaction.member.voice.channel) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")],
                    ephemeral: true,
                });
            }

            if (interaction.member.voice.channel?.id !== player.voiceChannel) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me")],
                    ephemeral: true,
                });
            }

            musicData = await musicModel.findOne({
                guildId: interaction.guild.id
            });

            if (musicData) {
                await updateMusicChannel(client, musicData, player, null, true);
            }

            player.destroy();
            await interaction.reply({
                embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription("I stopped the music!")],
                ephemeral: true,
            });
        }

        if (interaction.customId == "loop-music") {

            const player = client.manager.get(interaction.guild.id);

            if (!player || !player?.queue?.current) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
                    ephemeral: true,
                });
            }

            if (!interaction.member.voice.channel) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")],
                    ephemeral: true,
                });
            }

            if (interaction.member.voice.channel?.id !== player.voiceChannel) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me")],
                    ephemeral: true,
                });
            }

            if (player.trackRepeat) {
                player.setTrackRepeat(false);
                interaction.reply({
                    embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription("Looping is now disabled!")],
                    ephemeral: true,
                });
            } else {
                player.setTrackRepeat(true);
                interaction.reply({
                    embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription("Looping is now enabled!")],
                    ephemeral: true,
                });
            }
        }
    }
};

export default event;