import discord from "discord.js";
import { BotEvent } from "../../../types";

/**
 * Handles Discord.js warning events
 * Captures non-critical issues that deserve attention
 * 
 * @event Warn
 * @implements {BotEvent}
 * 
 * Features:
 * - Captures non-critical warnings
 * - Provides early warning system for potential issues
 * - Helps with proactive maintenance
 * - Assists in debugging and monitoring
 * 
 * @param {string} message - Warning message detailing the issue
 * @param {discord.Client} client - Discord client instance for logging
 * 
 * @example
 * // Warning event triggered
 * client.emit(Events.Warn, "Rate limit approaching");
 * 
 * @remarks
 * Common warning scenarios include:
 * - Rate limit warnings
 * - Performance issues
 * - Deprecated feature usage
 * - Connection instability
 */
const event: BotEvent = {
    name: discord.Events.Warn,
    execute: async (message: string, client: discord.Client) => {
        client.logger.warn(`[REQUEST] Warning! ${message}`);
    }
};

export default event;