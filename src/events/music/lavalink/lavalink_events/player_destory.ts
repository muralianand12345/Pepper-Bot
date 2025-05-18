import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";
import music_guild from "../../../database/schema/music_guild";
import AutoplayManager from "../../../../utils/music/autoplay_manager";
import { MusicChannelManager } from "../../../../utils/music/embed_template";
import { NowPlayingManager } from "../../../../utils/music/now_playing_manager";
import { LavalinkEvent } from "../../../../types";

const resetMusicChannelEmbed = async (
    guildId: string,
    client: discord.Client
): Promise<void> => {
    try {
        const guildData = await music_guild.findOne({ guildId });
        if (!guildData?.songChannelId || !guildData?.musicPannelId) return;

        const channel = await client.channels.fetch(guildData.songChannelId);
        if (!channel || !channel.isTextBased()) return;

        const musicChannelManager = new MusicChannelManager(client);
        await musicChannelManager.resetEmbed(guildData.musicPannelId, channel as discord.TextChannel);

        client.logger.debug(`[PLAYER_DESTROY] Reset music channel embed in guild ${guildId}`);
    } catch (error) {
        client.logger.error(`[PLAYER_DESTROY] Error resetting music channel embed: ${error}`);
    }
};

const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.PlayerDestroy,
    execute: async (player: magmastream.Player, client: discord.Client) => {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild) return;

        NowPlayingManager.removeInstance(player.guildId);
        AutoplayManager.removeInstance(player.guildId);
        await resetMusicChannelEmbed(player.guildId, client);

        client.logger.info(
            `[LAVALINK] Player for guild ${guild.name} (${guild.id}) destroyed`
        );
    },
};

export default lavalinkEvent;