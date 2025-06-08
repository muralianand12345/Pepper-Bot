import discord from "discord.js";

import { Command } from "../types";
import { Music } from "../core/music";


const command: Command = {
    cooldown: 2,
    data: new discord.SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip the current song and play the next one"),
    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
        const music = new Music(client, interaction);
        await music.skip();
    }
};

export default command;