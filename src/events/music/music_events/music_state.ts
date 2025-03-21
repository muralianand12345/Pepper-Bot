import discord from "discord.js";
import { MusicResponseHandler } from "../../../utils/music/embed_template";
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
        if (!player.voiceChannelId) return;
        const playerChannel = client.channels.cache.get(
            player.voiceChannelId
        ) as discord.VoiceBasedChannel;
        if (!playerChannel) return;

        const textChannel = client.channels.cache.get(
            String(player.textChannelId)
        ) as discord.TextChannel;
        if (!textChannel) return;

        const memberCount = playerChannel.members.filter(
            (member) => !member.user.bot
        ).size;
        const color = client.config.content.embed.color.info ?? "#000000";

        // Resume playback when first user joins
        if (memberCount === 1 && player.paused) {
            player.pause(false);
            const embed = new MusicResponseHandler(client).createInfoEmbed(
                "▶️ Resumed playback"
            );
            await sendTempMessage(textChannel, embed);
        }

        // Pause playback when last user leaves
        if (memberCount === 0 && !player.paused && player.playing) {
            player.pause(true);
            const embed = new MusicResponseHandler(client).createInfoEmbed(
                "⏸️ Paused playback because the voice channel is empty"
            );
            await sendTempMessage(textChannel, embed);
        }
    },
};

export default event;
