import discord from "discord.js";
import { BotEvent } from "../../../types";

/**
 * Handles Discord.js client invalidation events
 * Triggered when the client session becomes invalid
 *
 * @event Invalidated
 * @implements {BotEvent}
 *
 * Features:
 * - Monitors client session validity
 * - Logs invalidation events
 * - Helps track client disconnections
 * - Useful for debugging connection issues
 *
 * @param {discord.Client} client - Discord client instance for logging
 *
 * @example
 * // Invalidated event triggered
 * client.emit(Events.Invalidated);
 *
 * @remarks
 * This event typically occurs when:
 * - Token becomes invalid
 * - Client session expires
 * - Discord API invalidates the session
 */
const event: BotEvent = {
    name: discord.Events.Invalidated,
    execute: async (client: discord.Client): Promise<void> => {
        client.logger.warn(`[REQUEST] Client invalidated. Reconnecting...`);
    },
};

export default event;
