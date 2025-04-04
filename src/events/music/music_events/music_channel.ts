import discord from "discord.js";
import music_guild from "../../database/schema/music_guild";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: discord.Events.MessageCreate,
    execute: async (
        message: discord.Message,
        client: discord.Client
    ): Promise<void> => {

        if (!message.guild) return;
        if (message.author.bot) return;

        const guild_data = await music_guild.findOne({
            guildId: message.guild?.id,
        });

        if (!guild_data) return;
        if (message.content.startsWith(guild_data.prefix)) return;

        const song_channelId = guild_data.songChannelId;
        if (message.channel.id !== song_channelId) return;

        console.log(
            `Message from ${message.author.username} in song channel: ${message.content}`
        );



    }
}

export default event;