import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";

import { LavalinkEvent } from "../../../../types";
import { Autoplay, NowPlayingManager } from "../../../../core/music";


const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.PlayerDestroy,
    execute: async (player: magmastream.Player, client: discord.Client) => {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild) return;

        NowPlayingManager.removeInstance(player.guildId);
        Autoplay.removeInstance(player.guildId);

        client.logger.info(`[LAVALINK] Player for guild ${guild.name} (${guild.id}) destroyed`);
    },
};

export default lavalinkEvent;