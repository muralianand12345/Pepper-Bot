import discord from "discord.js";
import { createEmbed } from "../../../utils/music/embed_template";
import { sendTempMessage } from "../../../utils/music/music_functions";
import { BotEvent } from "../../../types";

/**
 * Voice state update event handler for music bot
 * Manages music playback based on voice channel member presence
 */
const event: BotEvent = {
    name: discord.Events.VoiceStateUpdate,
    execute: async (
        oldState: discord.VoiceState,
        newState: discord.VoiceState,
        client: discord.Client
    ) => {
        if (!client.config.music.enabled) return;

        const player = client.manager.get(newState.guild.id);
        if (!player || player.state !== "CONNECTED") return;

        // Handle bot disconnection
        if (newState.id === client.user?.id && !newState.channelId) {
            return player.destroy();
        }

        // Get voice channel info
        if (!player.voiceChannel) return;
        const playerChannel = client.channels.cache.get(
            player.voiceChannel
        ) as discord.VoiceBasedChannel;
        if (!playerChannel) return;

        const textChannel = client.channels.cache.get(
            String(player.textChannel)
        ) as discord.TextChannel;
        if (!textChannel) return;

        const memberCount = playerChannel.members.filter(
            (member) => !member.user.bot
        ).size;
        const color =
            client.config.content.embed.music_playing.color ?? "#000000";

        // Resume playback when first user joins
        if (memberCount === 1 && player.paused) {
            player.pause(false);
            const embed = createEmbed("▶️ Resumed playback", color);
            await sendTempMessage(textChannel, embed);
        }

        // Pause playback when last user leaves
        if (memberCount === 0 && !player.paused && player.playing) {
            player.pause(true);
            const embed = createEmbed(
                "⏸️ Paused playback because the voice channel is empty",
                color
            );
            await sendTempMessage(textChannel, embed);
        }
    },
};

export default event;
