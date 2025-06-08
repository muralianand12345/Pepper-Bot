import discord from "discord.js";

import { Command } from "../types";
import { Music } from "../core/music";

const command: Command = {
    cooldown: 1,
    data: new discord.SlashCommandBuilder()
        .setName("resume")
        .setDescription("Resume the paused music"),
    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
        const music = new Music(client, interaction);
        await music.resume();
    }
};

export default command;