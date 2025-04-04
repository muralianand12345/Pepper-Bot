import discord from "discord.js";
import music_guild from "../../../events/database/schema/music_guild";
import MusicPanelManager from "../../../utils/music/panel_manager";
import { BotEvent } from "../../../types";

const event: BotEvent = {
    name: discord.Events.ClientReady,
    once: true,
    execute: async (client: discord.Client): Promise<void> => {
        if (!client.config.music.enabled) {
            return;
        }

        client.logger.info("[MUSIC_PANEL] Initializing music panels");

        try {
            // Find all guilds with music channels set up
            const guilds = await music_guild.find({
                songChannelId: { $exists: true, $ne: null },
                musicPannelId: { $exists: true, $ne: null }
            });

            if (!guilds || guilds.length === 0) {
                client.logger.info("[MUSIC_PANEL] No music panels to initialize");
                return;
            }

            // Initialize each guild's music panel
            for (const guild of guilds) {
                const panelManager = MusicPanelManager.getInstance(guild.guildId, client);
                await panelManager.init();
            }

            client.logger.success(`[MUSIC_PANEL] Initialized ${guilds.length} music panels`);
        } catch (error) {
            client.logger.error(`[MUSIC_PANEL] Error initializing music panels: ${error}`);
        }
    },
};

export default event;