import discord from "discord.js";
import { sendTempMessage } from "../../../utils/music/music_functions";
import { MusicResponseHandler } from "../../../utils/music/embed_template";
import { NowPlayingManager } from "../../../utils/music/now_playing_manager";
import { BotEvent } from "../../../types";

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

        if (newState.id === client.user?.id && !newState.channelId) {
            player.destroy();
            NowPlayingManager.removeInstance(player.guildId);
            return;
        }

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

        if (memberCount === 1 && player.paused) {
            player.pause(false);
            const embed = new MusicResponseHandler(client).createInfoEmbed(
                "▶️ Resumed playback"
            );
            await sendTempMessage(textChannel, embed);
        }

        if (memberCount === 0 && !player.paused && player.playing) {
            player.pause(true);
            const embed = new MusicResponseHandler(client).createInfoEmbed(
                "⏸️ Paused playback because the voice channel is empty"
            );
            await sendTempMessage(textChannel, embed);

            const DISCONNECT_DELAY = 600000;
            const scheduledAt = Date.now();
            player.cleanupScheduledAt = scheduledAt;

            client.logger.info(`[VOICE_STATE] Everyone left channel in guild ${player.guildId}, scheduling disconnect in 10 minutes`);

            setTimeout(async () => {
                try {
                    const currentPlayer = client.manager.get(player.guildId);
                    if (!currentPlayer) return;
                    if (currentPlayer.cleanupScheduledAt !== scheduledAt) return;

                    const currentChannel = client.channels.cache.get(
                        String(currentPlayer.voiceChannelId)
                    ) as discord.VoiceBasedChannel;

                    if (!currentChannel) return;

                    const currentMemberCount = currentChannel.members.filter(
                        (member) => !member.user.bot
                    ).size;

                    if (currentMemberCount === 0) {
                        client.logger.info(`[VOICE_STATE] Voice channel still empty after 10 minutes, disconnecting from guild ${player.guildId}`);
                        const disconnectEmbed = new MusicResponseHandler(client).createInfoEmbed(
                            "🔌 Disconnecting due to inactivity (10 minutes with no listeners)"
                        );
                        await sendTempMessage(textChannel, disconnectEmbed);
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
