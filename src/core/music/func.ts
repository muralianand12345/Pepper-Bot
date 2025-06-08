import discord from "discord.js";


export const sendTempMessage = async (channel: discord.TextChannel, embed: discord.EmbedBuilder, duration: number = 10000): Promise<void> => {
    if (!channel.isTextBased()) throw new Error("Channel is not text-based");

    const message = await channel.send({ embeds: [embed] }).catch((error: Error | any) => {
        if (error.code === 50001) return null;
        return null;
    });

    if (!message) return;

    setTimeout(() => {
        message.delete().catch((deleteError: Error | any) => {
            if (deleteError.code !== 10008) { }
        });
    }, duration);
};