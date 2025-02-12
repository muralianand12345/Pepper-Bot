import path from "path";
import fs from "fs/promises";
import discord from "discord.js";
import { BotEvent, Command, SlashCommand } from "../types";
import { ConfigManager } from "../utils/config";

// Load environment variables
const configManager = ConfigManager.getInstance();

/**
 * Loads command files from a specified directory
 * @param directory - The directory path to load commands from
 * @param fileFilter - A function to filter command files (e.g., by extension)
 * @returns Promise resolving to an array of Command or SlashCommand objects
 *
 * @example
 * const commands = await loadCommands('./commands', (file) => file.endsWith('.js'));
 */
const loadCommands = async (
    directory: string,
    fileFilter: (file: string) => boolean
): Promise<Command[] | SlashCommand[]> => {
    try {
        // Read all files from the specified directory
        const files = await fs.readdir(directory);
        const commandFiles = files.filter(fileFilter);

        // Load and return command modules
        return await Promise.all(
            commandFiles.map(async (file) => {
                const { default: command } = await import(
                    path.join(directory, file)
                );
                return command;
            })
        );
    } catch (error) {
        console.error(`Error loading commands from ${directory}:`, error);
        return [];
    }
};

/**
 * Client Ready event handler
 * Responsible for loading and registering both message commands and slash commands
 * based on configuration settings.
 *
 * @event ClientReady
 * @implements {BotEvent}
 */
const event: BotEvent = {
    name: discord.Events.ClientReady,
    execute: async (client: discord.Client): Promise<void> => {
        // Validate client ID
        const clientID = client.user?.id;
        if (!clientID) {
            client.logger.error("[COMMAND] Client ID is undefined");
            return;
        }

        // Initialize collections for commands
        const commands = new discord.Collection<
            string,
            Command | SlashCommand
        >();
        const slashCommands: discord.SlashCommandBuilder[] = [];

        /**
         * Load message-based commands if enabled in config
         * These are traditional prefix commands (e.g., !help)
         */
        if (!client.config.bot.command.disable_message) {
            const messageCommandsDir = path.join(__dirname, "../commands/msg");
            const messageCommands = (await loadCommands(
                messageCommandsDir,
                (file) => file.endsWith(".js")
            )) as Command[];

            // Register message commands to both collections
            messageCommands.forEach((command) => {
                client.commands.set(command.name, command);
                commands.set(command.name, command);
            });
        }

        /**
         * Load and register slash commands
         * These are Discord's application commands that show up in the UI
         */
        const slashCommandsDir = path.join(__dirname, "../commands/slash");
        const loadedSlashCommands = (await loadCommands(
            slashCommandsDir,
            (file) => file.endsWith(".js")
        )) as SlashCommand[];

        /**
         * Filter and register slash commands based on configuration
         * Allows for selective command registration if specific commands are configured
         */
        loadedSlashCommands.forEach((command) => {
            const shouldRegister =
                !client.config.bot.command.register_specific_commands.enabled ||
                client.config.bot.command.register_specific_commands.commands.includes(
                    command.data.name
                );

            if (shouldRegister) {
                client.slashCommands.set(command.data.name, command);
                slashCommands.push(command.data);
                commands.set(command.data.name, command);
            }
        });

        // Log command registration statistics
        client.logger.info(
            `[COMMAND] Loaded ${client.commands.size} message commands.`
        );
        client.logger.info(
            `[COMMAND] Loaded ${slashCommands.length} slash commands.`
        );

        /**
         * Register slash commands with Discord API
         * This makes the commands available in Discord's UI
         */
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

        //return commands;
    },
};

export default event;
