import discord from 'discord.js';
import ApiServer from './core/api-server';
import { BotEvent } from '../../../types';

/**
 * Main API module that integrates with the Discord bot
 * @type {BotEvent}
 */
const event: BotEvent = {
    name: discord.Events.ClientReady,
    execute: async (client: discord.Client): Promise<void> => {
        try {
            // Check if API is enabled in the config
            if (!client.config.api?.enabled) {
                client.logger.info('[API] API server is disabled in configuration');
                return;
            }

            // Initialize and start the API server
            const apiServer = new ApiServer(client);
            apiServer.start();

            client.logger.success('[API] API server initialized successfully');
        } catch (error) {
            client.logger.error(`[API] Failed to initialize API server: ${error}`);
        }
    },
};

export default event;