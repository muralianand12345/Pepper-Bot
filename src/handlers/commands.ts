import path from "path";
import fs from "fs/promises";
import discord from "discord.js";

import { ConfigManager } from "../utils/config";
import { BotEvent, Command, SlashCommand } from "../types";


const configManager = ConfigManager.getInstance();

/**
 * Recursively load command files from directories
 * @param directory Base directory to search in
 * @param fileFilter Function to filter command files
 * @returns Array of loaded commands
 */
const loadCommandsRecursive = async (
    client: discord.Client,
    directory: string,
    fileFilter: (file: string) => boolean
): Promise<(Command | SlashCommand)[]> => {
    const commands: (Command | SlashCommand)[] = [];
    const items = await fs.readdir(directory, { withFileTypes: true });

    for (const item of items) {
        const itemPath = path.join(directory, item.name);

        if (item.isDirectory()) {
            const subCommands = await loadCommandsRecursive(client, itemPath, fileFilter);
            commands.push(...subCommands);
        } else if (fileFilter(item.name)) {
            try {
                const { default: command } = await import(itemPath);

                if (command) {
                    commands.push(command);
                }
            } catch (error: Error | any) {
                client.logger.error(`Failed to load command from ${itemPath}: ${error}`);
            }
        }
    }

    return commands;
};

const event: BotEvent = {
    name: discord.Events.ClientReady,
    execute: async (client: discord.Client): Promise<void> => {
        const clientID = client.user?.id;
        if (!clientID) {
            client.logger.error("[COMMAND] Client ID is undefined");
            return;
        }

        const commands = new discord.Collection<
            string,
            Command | SlashCommand
        >();
        const slashCommands: (discord.SlashCommandBuilder | discord.SlashCommandSubcommandsOnlyBuilder | discord.SlashCommandOptionsOnlyBuilder)[] = [];

        if (!client.config.bot.command.disable_message) {
            const messageCommandsDir = path.join(__dirname, "../commands/msg");
            const messageCommands = (await loadCommandsRecursive(
                client,
                messageCommandsDir,
                (file) => file.endsWith(".js") || file.endsWith(".ts")
            )) as Command[];
            messageCommands.forEach((command) => {
                client.commands.set(command.name, command);
                commands.set(command.name, command);
            });
        }

        const slashCommandsDir = path.join(__dirname, "../commands/slash");
        const loadedSlashCommands = (await loadCommandsRecursive(
            client,
            slashCommandsDir,
            (file) => (file.endsWith(".js") || file.endsWith(".ts")) && !file.includes(".d.ts")
        )) as SlashCommand[];

        loadedSlashCommands.forEach((command) => {
            const shouldRegister =
                !client.config.bot.command.register_specific_commands.enabled ||
                client.config.bot.command.register_specific_commands.commands.includes(
                    command.data.name
                );

            if (shouldRegister) {
                client.logger.debug(`[COMMAND] Registering slash command: ${command.data.name}`);
                client.slashCommands.set(command.data.name, command);
                slashCommands.push(command.data);
                commands.set(command.data.name, command);
            }
        });

        client.logger.info(
            `[COMMAND] Loaded ${client.commands.size} message commands.`
        );
        client.logger.info(
            `[COMMAND] Loaded ${slashCommands.length} slash commands.`
        );
        client.logger.debug(`[COMMAND] Command names being registered: ${slashCommands.map(cmd => cmd.name).join(', ')}`);

        const commandNames = new Set();
        slashCommands.forEach(command => {
            const name = command.name;
            if (commandNames.has(name)) {
                client.logger.error(`[COMMAND] Duplicate command name detected: ${name}`);
            } else {
                commandNames.add(name);
            }
        });

        try {
            const rest = new discord.REST({ version: "10" }).setToken(
                configManager.getToken() ?? ""
            );
            await rest.put(discord.Routes.applicationCommands(clientID), {
                body: slashCommands.map((command) => command.toJSON()),
            });
            client.logger.success(
                "[COMMAND] Successfully registered application commands."
            );
        } catch (error) {
            client.logger.error(
                `[COMMAND] Failed to register application commands: ${error}`
            );
        }
    },
};

export default event;