import discord from "discord.js";

import { Command } from "../types";
import { Music } from "../core/music";


const command: Command = {
    cooldown: 1,
    data: new discord.SlashCommandBuilder()
        .setName("pause")
        .setDescription("Pause the currently playing music"),
    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
        const music = new Music(client, interaction);
        await music.pause();
    }
};

export default command;