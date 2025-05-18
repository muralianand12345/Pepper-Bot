import discord from "discord.js";
import { BotEvent } from "../../../types";
import DJRoleService from "../../../utils/music/dj_role_service";

const event: BotEvent = {
    name: discord.Events.ClientReady,
    once: true,
    execute: async (client: discord.Client) => {
        client.logger.info("[DJ_ROLE] Initializing DJ role scheduler");
        const djService = new DJRoleService(client);
        const SCHEDULER_INTERVAL = 5 * 60 * 1000;

        const processExpiredDJs = async () => {
            try {
                await djService.processExpiredDJs();
            } catch (error) {
                client.logger.error(`[DJ_ROLE] Error in scheduler: ${error}`);
            }
        };

        setTimeout(processExpiredDJs, 30000);
        setInterval(processExpiredDJs, SCHEDULER_INTERVAL);

        client.logger.success("[DJ_ROLE] DJ role scheduler initialized");
    }
};

export default event;