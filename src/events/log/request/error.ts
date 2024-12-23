import discord from "discord.js";
import { BotEvent } from "../../../types";

/**
 * Handles Discord.js client error events
 * 
 * @event Error
 * @implements {BotEvent}
 * 
 * Features:
 * - Captures and logs critical Discord client errors
 * - Provides error tracking through client logger
 * - Helps with debugging and error monitoring
 * 
 * @param {Error} error - The error object containing details about what went wrong
 * @param {discord.Client} client - Discord client instance for logging
 * 
 * @example
 * // Error event triggered
 * client.emit(Events.Error, new Error("Connection failed"));
 */
const event: BotEvent = {
    name: discord.Events.Error,
    execute: async (error: Error, client: discord.Client) => {
        client.logger.error(`[REQUEST] An error occurred: ${error.message}`);
    }
};

export default event;