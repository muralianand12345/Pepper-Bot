import discord from "discord.js";
import { Player } from "magmastream";
import { LavalinkEvent } from "../../../../types";

/**
 * Lavalink player destory event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: "playerDestroy",
    execute: async (player: Player, client: discord.Client) => {
        const guild = client.guilds.cache.get(player.guild);
        if (!guild) return;

        client.logger.info(
            `[LAVALINK] Player for guild ${guild.name} (${guild.id}) destroyed`
        );
    },
};

export default lavalinkEvent;
