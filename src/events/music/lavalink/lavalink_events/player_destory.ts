import discord from "discord.js";
import magmastream from "magmastream";
import { LavalinkEvent } from "../../../../types";

/**
 * Lavalink player destory event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: "playerDestroy",
    execute: async (player: magmastream.Player, client: discord.Client) => {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild) return;

        client.logger.info(
            `[LAVALINK] Player for guild ${guild.name} (${guild.id}) destroyed`
        );
    },
};

export default lavalinkEvent;
