import discord from "discord.js";
import magmastream, { ManagerEventTypes } from "magmastream";

import { LavalinkEvent } from "../../../../types";
import { Autoplay, NowPlayingManager, MusicResponseHandler } from "../../../../core/music";


const lavalinkEvent: LavalinkEvent = {
    name: ManagerEventTypes.PlayerDestroy,
    execute: async (player: magmastream.Player, client: discord.Client) => {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild) return;

        try {
            if (player.textChannelId) {
                const channel = (await client.channels.fetch(player.textChannelId)) as discord.TextChannel;
                if (channel?.isTextBased()) {
                    const disconnectEmbed = new MusicResponseHandler(client).createInfoEmbed("🔌 Music player disconnected");
                    const disabledButtons = new MusicResponseHandler(client).getMusicButton(true);

                    await channel.send({ embeds: [disconnectEmbed], components: [disabledButtons] });

                    client.logger.debug(`[PLAYER_DESTROY] Disconnect message sent with disabled buttons for guild ${player.guildId}`);
                }
            }
        } catch (messageError) {
            client.logger.warn(`[PLAYER_DESTROY] Failed to send disconnect message: ${messageError}`);
        }

        NowPlayingManager.removeInstance(player.guildId);
        Autoplay.removeInstance(player.guildId);

        client.logger.info(`[LAVALINK] Player for guild ${guild.name} (${guild.id}) destroyed`);
    },
};

export default lavalinkEvent;