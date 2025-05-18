import discord from "discord.js";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { Command } from "../../types";

const command: Command = {
    name: "stop",
    description: "Stop all music playback",
    cooldown: 5,
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

        player.destroy();

        return message.reply({
            embeds: [
                new MusicResponseHandler(client).createSuccessEmbed(
                    "Music playback has been stopped"
                ),
            ],
        });
    },
};

export default command;