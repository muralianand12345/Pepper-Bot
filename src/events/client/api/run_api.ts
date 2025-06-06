import discord from 'discord.js';
import ApiServer from './core/api-server';
import { BotEvent } from '../../../types';

const event: BotEvent = {
    name: discord.Events.ClientReady,
    execute: async (client: discord.Client): Promise<void> => {
        try {
            if (!client.config.api?.enabled) {
                client.logger.info('[API] API server is disabled in configuration');
                return;
            }
            
            const apiServer = new ApiServer(client);
            apiServer.start();

            client.logger.success('[API] API server initialized successfully');
        } catch (error) {
            client.logger.error(`[API] Failed to initialize API server: ${error}`);
        }
    },
};

export default event;