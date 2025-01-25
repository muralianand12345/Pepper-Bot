import fs from "fs";
import path from "path";
import discord from "discord.js";
import client from "./pepper";
import { ConfigManager } from './utils/config';

// Load environment variables
const configManager = ConfigManager.getInstance();

/**
 * Loads handler files and attaches them to the client
 * @param client Discord client instance
 * @param handlersPath Path to handlers directory
 */
const loadHandlers = async (client: discord.Client, handlersPath: string): Promise<void> => {
    try {
        const handlerFiles = fs.readdirSync(handlersPath)
            .filter(file => file.endsWith('.js'));

        for (const file of handlerFiles) {
            try {
                const filePath = path.join(handlersPath, file);
                const handler = require(filePath).default;

                if (!handler?.name || !handler?.execute) {
                    client.logger.warn(`[MAIN] Invalid handler file structure: ${file}`);
                    continue;
                }

                client.on(handler.name, (...args) => handler.execute(...args, client));
                client.logger.info(`[MAIN] Loaded handler: ${handler.name}`);
            } catch (error) {
                client.logger.error(`[MAIN] Failed to load handler ${file}: ${error}`);
            }
        }
    } catch (error) {
        client.logger.error(`[MAIN] Failed to read handlers directory: ${error}`);
        throw error;
    }
};

/**
 * Loads event files from nested directory structure
 * @param client Discord client instance
 * @param eventsPath Path to events directory
 */
const loadEvents = async (client: discord.Client, eventsPath: string): Promise<void> => {
    try {
        const mainDirs = fs.readdirSync(eventsPath);

        for (const mainDir of mainDirs) {
            const mainDirPath = path.join(eventsPath, mainDir);
            if (!fs.statSync(mainDirPath).isDirectory()) continue;

            const subFolders = fs.readdirSync(mainDirPath);
            for (const subDir of subFolders) {
                const subDirPath = path.join(mainDirPath, subDir);
                if (!fs.statSync(subDirPath).isDirectory()) continue;

                const eventFiles = fs.readdirSync(subDirPath)
                    .filter(file => file.endsWith('.js'));

                for (const file of eventFiles) {
                    try {
                        const filePath = path.join(subDirPath, file);
                        const event = require(filePath).default;

                        if (!event?.name || !event?.execute) {
                            //check if the folder name ends with schema
                            if (!subDirPath.endsWith("schema")) {
                                client.logger.warn(`[MAIN] Invalid event file structure: ${file}`);
                            } else {
                                client.logger.debug(`[MAIN] Ignored Schema files: ${file}`);
                            }
                            continue;
                        }

                        if (event.once) {
                            client.once(event.name, (...args) => event.execute(...args, client));
                        } else {
                            client.on(event.name, (...args) => event.execute(...args, client));
                        }

                        client.logger.debug(`[MAIN] Loaded event: ${event.name} from ${mainDir}/${subDir}/${file}`);
                    } catch (error) {
                        client.logger.error(`[MAIN] Failed to load event ${file}: ${error}`);
                    }
                }
            }
        }
    } catch (error) {
        client.logger.error(`[MAIN] Failed to read events directory: ${error}`);
        throw error;
    }
};

/**
 * Sets up process-wide error handlers
 * @param client Discord client instance
 */
const setupErrorHandlers = (client: discord.Client): void => {
    process.on('unhandledRejection', (error: Error) => {
        client.logger.error(`[UNHANDLED-REJECTION] ${error.name}: ${error.message}`);
        client.logger.error(`Stack trace: ${error.stack}`);
    });

    process.on('uncaughtException', (error: Error, origin) => {
        client.logger.error(`[UNCAUGHT-EXCEPTION] ${error.name}: ${error.message}`);
        client.logger.error(`Origin: ${origin}`);
        client.logger.error(`Stack trace: ${error.stack}`);
    });
};

/**
 * Initializes the bot by loading all handlers, events and connect to database
 * @param client Discord client instance
 */
const initializeBot = async (client: discord.Client): Promise<void> => {
    const handlersPath = path.join(__dirname, 'handlers');
    const eventsPath = path.join(__dirname, 'events');

    try {
        await loadHandlers(client, handlersPath);
        await loadEvents(client, eventsPath);
        setupErrorHandlers(client);

        await client.login(configManager.getToken());
        client.logger.success(`[MAIN] [${client.user?.username} #${client.user?.discriminator}] has connected successfully`);
        client.logger.info(`Code by murlee#0 ❤️`);
    } catch (error) {
        client.logger.error(`[MAIN] Failed to initialize bot: ${error}`);
        process.exit(1);
    }
};

// Initialize the bot
initializeBot(client).catch(error => {
    console.error('[MAIN] Fatal error during initialization:', error);
    process.exit(1);
});