import discord from "discord.js";
import {
    VoiceChannelValidator,
    MusicPlayerValidator,
} from "../../utils/music/music_validations";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { Command } from "../../types";

const command: Command = {
    name: "skip",
    description: "Skip the current song or skip to a specific time",
    cooldown: 2,
    owner: false,
    execute: async (
        client: discord.Client,
        message: discord.Message,
        args: Array<string>
    ) => {
        if (!client.config.music.enabled) {
            return message.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Music is currently disabled"
                    ),
                ],
            });
        }

        const player = client.manager.get(message.guild?.id || "");
        if (!player) {
            return message.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "No music is currently playing"
                    ),
                ],
            });
        }

        const validator = new VoiceChannelValidator(client, message);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) {
                return message.reply({ embeds: [embed] });
            }
        }

        // Check for a specific time to skip to
        let time = 0;
        if (args.length > 0) {
            const parsedTime = parseInt(args[0]);
            if (!isNaN(parsedTime)) {
                time = parsedTime;
            }
        }

        if (time > 0) {
            // Skip to a specific time in the song
            player.seek(time * 1000);
            return message.reply({
                embeds: [
                    new MusicResponseHandler(client).createSuccessEmbed(
                        `Skipped to ${time} seconds`
                    ),
                ],
            });
        } else {
            // Skip to the next song
            const music_validator = new MusicPlayerValidator(client, player);
            const [queueValid, queueError] = await music_validator.validateQueueSize(1);

            if (!queueValid && queueError) {
                return message.reply({
                    embeds: [queueError],
                });
            }

            player.stop(1);
            if (player.queue.size === 0) {
                player.destroy();
            }

            return message.reply({
                embeds: [
                    new MusicResponseHandler(client).createSuccessEmbed(
                        "Skipped the current song!"
                    ),
                ],
            });
        }
    },
};

export default command;