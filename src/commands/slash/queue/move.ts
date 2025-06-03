import discord from "discord.js";
import { MusicResponseHandler } from "../../../core/music";

export const handleMoveInQueue = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client,
    player: any
) => {
    const from = interaction.options.getInteger("from", true) - 1;
    const to = interaction.options.getInteger("to", true) - 1;

    if (from >= player.queue.size || to >= player.queue.size) {
        return await interaction.reply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "Invalid position in queue"
                ),
            ],
            flags: discord.MessageFlags.Ephemeral,
        });
    }

    const track = player.queue[from];
    player.queue.remove(from);
    player.queue.add(track, to);

    await interaction.reply({
        embeds: [
            new MusicResponseHandler(client).createSuccessEmbed(
                `Moved \`${track.title}\` to position ${to + 1}`
            ),
        ],
    });
};