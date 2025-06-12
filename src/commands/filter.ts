import discord from "discord.js";

import { Command } from "../types";
import { Music, MUSIC_CONFIG } from "../core/music";
import { LocalizationManager } from "../core/locales";


const localizationManager = LocalizationManager.getInstance();

const filterCommand: Command = {
    cooldown: 3,
    data: new discord.SlashCommandBuilder()
        .setName("filter")
        .setDescription("Apply audio filters to enhance your music experience")
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.filter.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.filter.description'))
        .setContexts(discord.InteractionContextType.Guild)
        .addStringOption(option =>
            option.setName("type")
                .setDescription("Choose an audio filter to apply")
                .setNameLocalizations(localizationManager.getCommandLocalizations('commands.filter.options.type.name'))
                .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.filter.options.type.description'))
                .setRequired(true)
                .addChoices(
                    ...Object.entries(MUSIC_CONFIG.AUDIO_FILTERS).map(([value, data]) => ({
                        name: `${data.emoji} ${data.name} - ${data.description}`,
                        value
                    }))
                )
        ),
    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
        const music = new Music(client, interaction);
        const filterType = interaction.options.getString("type", true);
        await music.filter(filterType);
    }
};

export default filterCommand;