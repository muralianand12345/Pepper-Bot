import discord from 'discord.js';
import magmastream from 'magmastream';
import music_guild from '../../database/schema/music_guild';
import { createEmbed } from '../../../utils/music/embed_template';
import { wait, updateMusicGuildChannelDB, sendTempMessage } from '../../../utils/music/music_functions';
import { BotEvent, IMusicGuild } from '../../../types';


/**
 * Handles inactive voice channel cleanup
 */
const handleInactivity = async (
    client: discord.Client,
    musicData: IMusicGuild,
    player: magmastream.Player,
    channel: discord.VoiceBasedChannel
): Promise<void> => {
    if (musicData?.status247) return;
    await wait(600000); // 10 minutes

    const currentMembers = channel.members.filter(member => !member.user.bot).size;
    if (!player.paused || currentMembers > 0) return;

    player.destroy();
    const textChannel = client.channels.cache.get(String(player.textChannel)) as discord.TextChannel;
    if (!textChannel) return;

    const embed = createEmbed(
        "👋 The voice channel was empty for 10 minutes, so the music has ended, and I left.",
        client.config.content.embed.music_playing.color ?? '#000000'
    );

    await sendTempMessage(textChannel, embed);
};

/**
 * Voice state update event handler for music bot
 * Manages music playback based on voice channel member presence
 */
const event: BotEvent = {
    name: discord.Events.VoiceStateUpdate,
    execute: async (oldState: discord.VoiceState, newState: discord.VoiceState, client: discord.Client) => {
        if (!client.config.music.enabled) return;

        const musicData = await music_guild.findOne({ guildId: newState.guild.id });
        const player = client.manager.get(newState.guild.id);

        if (!player || player.state !== "CONNECTED") return;

        // Handle bot disconnection
        if (newState.id === client.user?.id && !newState.channelId) {
            if (musicData) await updateMusicGuildChannelDB(client, musicData, player, null, true);
            return player.destroy();
        }

        // Get voice channel info
        if (!player.voiceChannel) return;
        const playerChannel = client.channels.cache.get(player.voiceChannel) as discord.VoiceBasedChannel;
        if (!playerChannel) return;

        const textChannel = client.channels.cache.get(String(player.textChannel)) as discord.TextChannel;
        if (!textChannel) return;

        const memberCount = playerChannel.members.filter(member => !member.user.bot).size;
        const color = client.config.content.embed.music_playing.color ?? '#000000';

        // Resume playback when first user joins
        if (memberCount === 1 && player.paused) {
            player.pause(false);
            const embed = createEmbed("▶️ Resumed playback", color);
            await sendTempMessage(textChannel, embed);
        }

        // Pause playback when last user leaves
        if (memberCount === 0 && !player.paused && player.playing) {
            player.pause(true);
            const embed = createEmbed("⏸️ Paused playback because the voice channel is empty", color);
            await sendTempMessage(textChannel, embed);

            if (musicData) {
                await handleInactivity(client, musicData, player, playerChannel);
            }
        }
    }
};

export default event;