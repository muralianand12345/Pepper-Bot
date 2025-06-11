import path from "path";
import fs from "fs/promises";
import discord from "discord.js";

import { BotEvent, Command } from "../types";
import { ConfigManager } from "../utils/config";


const configManager = ConfigManager.getInstance();

const loadCommands = async (
    directory: string,
    fileFilter: (file: string) => boolean
): Promise<Command[]> => {
    const files = await fs.readdir(directory);
    const commandFiles = files.filter(fileFilter);

    return await Promise.all(
        commandFiles.map(async (file) => {
            const { default: command } = await import(path.join(directory, file));
            return command;
        })
    );
};

const event: BotEvent = {
    name: discord.Events.ClientReady,
    execute: async (client: discord.Client): Promise<void> => {
        const clientId = client.user?.id;
        if (!clientId) return client.logger.error("[COMMAND] Client Id is undefined");

        const commands = new discord.Collection<string, Command>();
        const slashCommands: (discord.SlashCommandBuilder | discord.SlashCommandSubcommandsOnlyBuilder | discord.SlashCommandOptionsOnlyBuilder)[] = [];

        const slashCommandsDir = path.join(__dirname, "../commands");
        const loadedSlashCommands = (await loadCommands(slashCommandsDir, (file) => file.endsWith(".js") || file.endsWith(".ts"))) as Command[];
        loadedSlashCommands.forEach((command) => {
            client.commands.set(command.data.name, command);
            slashCommands.push(command.data);
            commands.set(command.data.name, command);
        });

        client.logger.info(`[COMMAND] Loaded ${client.commands.size} commands.`);

        try {
            const rest = new discord.REST({ version: "10" }).setToken(configManager.getToken() ?? "");
            await rest.put(discord.Routes.applicationCommands(clientId), { body: slashCommands.map((command) => command.toJSON()) });
            client.logger.success("[COMMAND] Successfully registered application commands.");
        } catch (error) {
            client.logger.error(`[COMMAND] Failed to register application commands: ${error}`);
        }
    }
};

export default event;