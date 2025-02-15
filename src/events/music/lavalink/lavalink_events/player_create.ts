import discord from "discord.js";
import magmastream from "magmastream";
import { LavalinkEvent } from "../../../../types";

/**
 * Lavalink player create event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: "playerCreate",
    execute: async (player: magmastream.Player, client: discord.Client) => {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild) return;

        client.logger.info(
            `[LAVALINK] Player for guild ${guild.name} (${guild.id}) created`
        );
    },
};

export default lavalinkEvent;
