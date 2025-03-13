import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import { NowPlayingManager } from "../../../../utils/music/now_playing_manager";
import { LavalinkEvent } from "../../../../types";

/**
 * Lavalink player destroy event handler
 */
const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.PlayerDestroy,
    execute: async (player: magmastream.Player, client: discord.Client) => {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild) return;

        // Clean up the now playing manager when player is destroyed
        NowPlayingManager.removeInstance(player.guildId);

        client.logger.info(
            `[LAVALINK] Player for guild ${guild.name} (${guild.id}) destroyed`
        );
    },
};

export default lavalinkEvent;