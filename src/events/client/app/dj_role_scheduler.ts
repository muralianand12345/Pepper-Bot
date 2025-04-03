import discord from "discord.js";
import { BotEvent } from "../../../types";
import DJRoleService from "../../../utils/music/dj_role_service";

/**
 * Initializes the DJ role scheduler
 * Processes expired DJ roles periodically
 * 
 * @type {BotEvent}
 */
const event: BotEvent = {
    name: discord.Events.ClientReady,
    once: true,
    execute: async (client: discord.Client) => {
        client.logger.info("[DJ_ROLE] Initializing DJ role scheduler");

        // Set up the DJ role service
        const djService = new DJRoleService(client);

        // Check for expired DJs every 5 minutes
        const SCHEDULER_INTERVAL = 5 * 60 * 1000; // 5 minutes

        const processExpiredDJs = async () => {
            try {
                await djService.processExpiredDJs();
            } catch (error) {
                client.logger.error(`[DJ_ROLE] Error in scheduler: ${error}`);
            }
        };

        // Initial processing
        setTimeout(processExpiredDJs, 30000); // Wait 30 seconds after startup

        // Set up interval for periodic checks
        setInterval(processExpiredDJs, SCHEDULER_INTERVAL);

        client.logger.success("[DJ_ROLE] DJ role scheduler initialized");
    }
};

export default event;