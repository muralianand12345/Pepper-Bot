import discord from "discord.js";
import { MusicResponseHandler } from "../../../utils/music/embed_template";

export const handleShuffleQueue = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    player: any
) => {
    player.queue.shuffle();

    await interaction.reply({
        embeds: [
            new MusicResponseHandler(client).createSuccessEmbed(
                "Shuffled the music queue"
            ),
        ],
    });
};