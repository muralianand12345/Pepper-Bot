import discord from "discord.js";
import { MusicResponseHandler } from "../../../utils/music/embed_template";
import { sendTempMessage } from "../../../utils/music/music_functions";
import { NowPlayingManager } from "../../../utils/music/now_playing_manager";
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
            // Bot was disconnected from voice channel
            player.destroy();
            NowPlayingManager.removeInstance(player.guildId);
            return;
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

            // Set up auto-disconnect after 10 minutes if no one returns
            const DISCONNECT_DELAY = 600000; // 10 minutes
            const scheduledAt = Date.now();
            player.cleanupScheduledAt = scheduledAt;

            client.logger.info(`[VOICE_STATE] Everyone left channel in guild ${player.guildId}, scheduling disconnect in 10 minutes`);

            // Use setTimeout instead of wait to avoid blocking
            setTimeout(async () => {
                try {
                    // Get fresh player instance
                    const currentPlayer = client.manager.get(player.guildId);
                    if (!currentPlayer) return;

                    // Check if this task is still valid
                    if (currentPlayer.cleanupScheduledAt !== scheduledAt) return;

                    // Check if the voice channel is still empty
                    const currentChannel = client.channels.cache.get(
                        String(currentPlayer.voiceChannelId)
                    ) as discord.VoiceBasedChannel;

                    if (!currentChannel) return;

                    const currentMemberCount = currentChannel.members.filter(
                        (member) => !member.user.bot
                    ).size;

                    if (currentMemberCount === 0) {
                        // Still no users, destroy the player
                        client.logger.info(`[VOICE_STATE] Voice channel still empty after 10 minutes, disconnecting from guild ${player.guildId}`);

                        // Send message before disconnecting
                        const disconnectEmbed = new MusicResponseHandler(client).createInfoEmbed(
                            "🔌 Disconnecting due to inactivity (10 minutes with no listeners)"
                        );
                        await sendTempMessage(textChannel, disconnectEmbed);

                        // Clean up
                        NowPlayingManager.removeInstance(player.guildId);
                        currentPlayer.destroy();
                    }
                } catch (error) {
                    client.logger.error(`[VOICE_STATE] Error during auto-disconnect: ${error}`);
                }
            }, DISCONNECT_DELAY);
        }
    },
};

export default event;
