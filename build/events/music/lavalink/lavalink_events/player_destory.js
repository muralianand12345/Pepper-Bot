"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const magmastream_1 = require("magmastream");
const locales_1 = require("../../../../core/locales");
const music_1 = require("../../../../core/music");
const localeDetector = new locales_1.LocaleDetector();
const lavalinkEvent = {
    name: magmastream_1.ManagerEventTypes.PlayerDestroy,
    execute: async (player, client) => {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild)
            return;
        try {
            if (player.textChannelId) {
                const channel = (await client.channels.fetch(player.textChannelId));
                if (channel?.isTextBased()) {
                    let guildLocale = 'en';
                    try {
                        guildLocale = await localeDetector.getGuildLanguage(player.guildId) || 'en';
                    }
                    catch (error) { }
                    const responseHandler = new music_1.MusicResponseHandler(client);
                    const disconnectEmbed = responseHandler.createInfoEmbed(client.localizationManager?.translate('responses.music.disconnected', guildLocale) || "🔌 Music player disconnected", guildLocale);
                    const disabledButtons = responseHandler.getMusicButton(true, guildLocale);
                    await channel.send({ embeds: [disconnectEmbed], components: [disabledButtons] });
                    client.logger.debug(`[PLAYER_DESTROY] Disconnect message sent with disabled buttons for guild ${player.guildId}`);
                }
            }
        }
        catch (messageError) {
            client.logger.warn(`[PLAYER_DESTROY] Failed to send disconnect message: ${messageError}`);
        }
        music_1.NowPlayingManager.removeInstance(player.guildId);
        music_1.Autoplay.removeInstance(player.guildId);
        client.logger.info(`[LAVALINK] Player for guild ${guild.name} (${guild.id}) destroyed`);
    },
};
exports.default = lavalinkEvent;
