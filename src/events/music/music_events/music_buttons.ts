import discord from 'discord.js';
import musicGuildModel from '../../database/schema/music_guild';
import { updateMusicGuildChannelDB } from '../../../utils/music/music_functions';
import { BotEvent } from '../../../types';

/**
 * Validates common conditions for music commands
 * @param {discord.ButtonInteraction} interaction - The button interaction
 * @param {any} player - The music player instance
 * @returns {Promise<boolean>} Returns true if validation passes, false otherwise
 */
const validateMusicCommand = async (interaction: discord.ButtonInteraction, player: any): Promise<boolean> => {
    if (!player?.queue?.current) {
        await interaction.reply({
            embeds: [new discord.EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
            ephemeral: true,
        });
        return false;
    }

    const member = interaction.member as discord.GuildMember;
    if (!member.voice.channel) {
        await interaction.reply({
            embeds: [new discord.EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")],
            ephemeral: true,
        });
        return false;
    }

    if (member.voice.channel.id !== player.voiceChannel) {
        await interaction.reply({
            embeds: [new discord.EmbedBuilder()
                .setColor('Red')
                .setDescription("It seems like you are not in the same voice channel as me")
                .setFooter({ text: 'If you think there is an issue, kindly contact the server admin to use `/dcbot` command.' })],
            ephemeral: true,
        });
        return false;
    }

    return true;
}

/**
 * Handles the pause music button interaction
 * @param {discord.ButtonInteraction} interaction - The button interaction
 * @param {discord.Client} client - The Discord client instance
 */
const handlePauseMusic = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void> => {
    const player = client.manager.get(interaction.guild!.id);

    if (!await validateMusicCommand(interaction, player)) return;

    if (player?.paused) {
        await interaction.reply({
            embeds: [new discord.EmbedBuilder().setColor('Red').setDescription("The music is already paused")],
            ephemeral: true,
        });
        return;
    }

    player?.pause(true);
    await interaction.reply({
        embeds: [new discord.EmbedBuilder()
            .setColor((client.config.content.embed.music_playing.color ?? "#FF0000") as discord.ColorResolvable)
            .setDescription("Paused the music!")],
        ephemeral: true,
    });
}

/**
 * Handles the resume music button interaction
 * @param {discord.ButtonInteraction} interaction - The button interaction
 * @param {discord.Client} client - The Discord client instance
 */
const handleResumeMusic = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void> => {
    const player = client.manager.get(interaction.guild!.id);

    if (!await validateMusicCommand(interaction, player)) return;

    if (!player?.paused) {
        await interaction.reply({
            embeds: [new discord.EmbedBuilder().setColor('Red').setDescription("The music is already playing")],
            ephemeral: true,
        });
        return;
    }

    player?.pause(false);
    await interaction.reply({
        embeds: [new discord.EmbedBuilder()
            .setColor((client.config.content.embed.music_playing.color ?? "#FF0000") as discord.ColorResolvable)
            .setDescription("Resumed the music!")],
        ephemeral: true,
    });
}

/**
 * Handles the skip music button interaction
 * @param {discord.ButtonInteraction} interaction - The button interaction
 * @param {discord.Client} client - The Discord client instance
 */
const handleSkipMusic = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void> => {
    const player = client.manager.get(interaction.guild!.id);
    const count = 1;

    if (!await validateMusicCommand(interaction, player)) return;
    const playerSize = player?.queue.size;
    if (!playerSize) {
        await interaction.reply({
            embeds: [new discord.EmbedBuilder().setColor('Red').setDescription("There are no songs in the queue")],
            ephemeral: true,
        });
        return;
    }

    if (playerSize < count) {
        await interaction.reply({
            embeds: [new discord.EmbedBuilder()
                .setColor('Red')
                .setDescription(`There are only ${playerSize} songs in the queue`)],
            ephemeral: true,
        });
        return;
    }

    player.stop(count);

    if (player.queue.size === 0) {
        const musicData = await musicGuildModel.findOne({ guildId: interaction.guild!.id });
        if (musicData) {
            await updateMusicGuildChannelDB(client, musicData, player, null, true);
        }
        player.destroy();
    }

    await interaction.reply({
        embeds: [new discord.EmbedBuilder()
            .setColor((client.config.content.embed.music_playing.color ?? "#FF0000") as discord.ColorResolvable)
            .setDescription(`I skipped ${count} song!`)],
        ephemeral: true,
    });
}

/**
 * Handles the stop music button interaction
 * @param {discord.ButtonInteraction} interaction - The button interaction
 * @param {discord.Client} client - The Discord client instance
 */
const handleStopMusic = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void> => {
    const player = client.manager.get(interaction.guild!.id);
    if (!player) {
        await interaction.reply({
            embeds: [new discord.EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
            ephemeral: true,
        });
        return;
    }

    if (!await validateMusicCommand(interaction, player)) return;

    const musicData = await musicGuildModel.findOne({ guildId: interaction.guild!.id });
    if (musicData) {
        await updateMusicGuildChannelDB(client, musicData, player, null, true);
    }

    player.destroy();
    await interaction.reply({
        embeds: [new discord.EmbedBuilder()
            .setColor((client.config.content.embed.no_music_playing.color ?? "#FF0000") as discord.ColorResolvable)
            .setDescription("I stopped the music!")],
        ephemeral: true,
    });
}

/**
 * Handles the loop music button interaction
 * @param {discord.ButtonInteraction} interaction - The button interaction
 * @param {discord.Client} client - The Discord client instance
 */
const handleLoopMusic = async (interaction: discord.ButtonInteraction, client: discord.Client): Promise<void> => {
    const player = client.manager.get(interaction.guild!.id);
    if (!player) {
        await interaction.reply({
            embeds: [new discord.EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
            ephemeral: true,
        });
        return;
    }

    if (!await validateMusicCommand(interaction, player)) return;

    player.setTrackRepeat(!player.trackRepeat);
    await interaction.reply({
        embeds: [new discord.EmbedBuilder()
            .setColor((client.config.content.embed.music_playing.color ?? "#FF0000") as discord.ColorResolvable)
            .setDescription(`Looping is now ${player.trackRepeat ? 'enabled' : 'disabled'}!`)],
        ephemeral: true,
    });
}

/**
 * Main event handler for button interactions related to music controls
 * @type {BotEvent}
 */
const event: BotEvent = {
    name: discord.Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isButton()) return;

        const handlers = {
            'pause-music': handlePauseMusic,
            'resume-music': handleResumeMusic,
            'skip-music': handleSkipMusic,
            'stop-music': handleStopMusic,
            'loop-music': handleLoopMusic
        };

        const handler = handlers[interaction.customId as keyof typeof handlers];
        if (handler) {
            await handler(interaction, client);
        }
    }
};

export default event;