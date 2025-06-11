import discord from "discord.js";
import timers from "timers/promises";


export const sendTempMessage = async (channel: discord.TextChannel, embed: discord.EmbedBuilder, duration: number = 10000): Promise<void> => {
    if (!channel.isTextBased()) throw new Error("Channel is not text-based");

    const message = await channel.send({ embeds: [embed] }).catch((error) => {
        if (error.code === 50001) return null;
        return null;
    });

    if (!message) return;

    setTimeout(() => {
        message.delete().catch((deleteError) => {
            if (deleteError.code !== 10008) { }
        });
    }, duration);
};

export const wait = async (ms: number): Promise<void> => {
    await timers.setTimeout(ms);
};