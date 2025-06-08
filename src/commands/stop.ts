import discord from "discord.js";

import { Command } from "../types";
import { Music } from "../core/music";


const command: Command = {
    cooldown: 2,
    data: new discord.SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stop the music and disconnect from voice channel"),
    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
        const music = new Music(client, interaction);
        await music.stop();
    }
};

export default command;