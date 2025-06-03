import discord from "discord.js";
import { MusicResponseHandler } from "../../../utils/music/embed_template";

export const handleClearQueue = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    player: any
) => {
    player.queue.clear();

    await interaction.reply({
        embeds: [
            new MusicResponseHandler(client).createSuccessEmbed(
                "Cleared the music queue"
            ),
        ],
    });
};