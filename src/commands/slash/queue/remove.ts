import discord from "discord.js";
import { MusicResponseHandler } from "../../../utils/music/embed_template";

export const handleRemoveFromQueue = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    player: any
) => {
    const position = interaction.options.getInteger("position", true) - 1;

    if (position >= player.queue.size) {
        return await interaction.reply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "Invalid position in queue"
                ),
            ],
            flags: discord.MessageFlags.Ephemeral,
        });
    }

    const removedTrack = player.queue[position];
    player.queue.remove(position);

    await interaction.reply({
        embeds: [
            new MusicResponseHandler(client).createSuccessEmbed(
                `Removed \`${removedTrack.title}\` from the queue`
            ),
        ],
    });
};