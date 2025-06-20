"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionTracker = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const magmastream_1 = __importDefault(require("magmastream"));
const xp_manager_1 = require("./xp_manager");
const locales_1 = require("../../locales");
class ActionTracker {
    constructor(client) {
        this.activeListeners = new Map();
        this.setupEventListeners = () => {
            this.client.manager.on(magmastream_1.default.ManagerEventTypes.TrackStart, this.handleTrackStart);
            this.client.manager.on(magmastream_1.default.ManagerEventTypes.TrackEnd, this.handleTrackEnd);
        };
        this.handleTrackStart = async (player, track) => {
            try {
                if (!track.requester || !player.guildId)
                    return;
                const userId = typeof track.requester === 'string' ? track.requester : track.requester.id;
                await this.xpManager.startListeningSession(userId);
                this.activeListeners.set(userId, new Date());
                this.client.logger.debug(`[ACTION_TRACKER] Started listening session for user ${userId}`);
            }
            catch (error) {
                this.client.logger.error(`[ACTION_TRACKER] Error handling track start: ${error}`);
            }
        };
        this.handleTrackEnd = async (player, track) => {
            try {
                if (!track.requester || !player.guildId)
                    return;
                const userId = typeof track.requester === 'string' ? track.requester : track.requester.id;
                const startTime = this.activeListeners.get(userId);
                if (startTime) {
                    const result = await this.xpManager.endListeningSession(userId, player.guildId);
                    if (result.xpGained > 0)
                        this.client.logger.debug(`[ACTION_TRACKER] User ${userId} gained ${result.xpGained} XP for ${result.minutesListened} minutes`);
                    this.activeListeners.delete(userId);
                }
            }
            catch (error) {
                this.client.logger.error(`[ACTION_TRACKER] Error handling track end: ${error}`);
            }
        };
        this.handleTrackAdd = async (player, track) => {
            try {
                if (!player.guildId)
                    return;
                const tracks = Array.isArray(track) ? track : [track];
                const firstTrack = tracks[0];
                if (!firstTrack?.requester)
                    return;
                const userId = typeof firstTrack.requester === 'string' ? firstTrack.requester : firstTrack.requester.id;
                const isPlaylist = tracks.length > 1;
                const action = { type: isPlaylist ? 'playlist_add' : 'queue_add', xpGained: 0, timestamp: new Date(), details: isPlaylist ? `${tracks.length} tracks` : firstTrack.title };
                const result = await this.xpManager.awardXP(userId, player.guildId, action);
                if (result.levelUp && result.newLevel)
                    await this.sendLevelUpNotification(userId, player.guildId, result.newLevel, result.xpGained);
            }
            catch (error) {
                this.client.logger.error(`[ACTION_TRACKER] Error handling track add: ${error}`);
            }
        };
        this.trackCommandUsage = async (interaction, commandName) => {
            try {
                if (!interaction.guildId)
                    return;
                const musicCommands = ['play', 'skip', 'pause', 'resume', 'stop', 'loop', 'filter', 'autoplay'];
                const actionType = musicCommands.includes(commandName) ? 'command_music' : 'command';
                const action = { type: actionType, xpGained: 0, timestamp: new Date(), details: commandName };
                const result = await this.xpManager.awardXP(interaction.user.id, interaction.guildId, action);
                if (result.levelUp && result.newLevel)
                    await this.sendLevelUpNotification(interaction.user.id, interaction.guildId, result.newLevel, result.xpGained);
            }
            catch (error) {
                this.client.logger.error(`[ACTION_TRACKER] Error tracking command usage: ${error}`);
            }
        };
        this.trackShareAction = async (userId, guildId, songTitle) => {
            try {
                const action = { type: 'share', xpGained: 0, timestamp: new Date(), details: songTitle };
                const result = await this.xpManager.awardXP(userId, guildId, action);
                if (result.levelUp && result.newLevel)
                    await this.sendLevelUpNotification(userId, guildId, result.newLevel, result.xpGained);
            }
            catch (error) {
                this.client.logger.error(`[ACTION_TRACKER] Error tracking share action: ${error}`);
            }
        };
        this.sendLevelUpNotification = async (userId, guildId, newLevel, xpGained) => {
            try {
                const guild = this.client.guilds.cache.get(guildId);
                if (!guild)
                    return;
                const user = await this.client.users.fetch(userId).catch(() => null);
                if (!user)
                    return;
                let channel = null;
                const musicChannels = guild.channels.cache.filter((c) => c.type === discord_js_1.default.ChannelType.GuildText && (c.name.includes('music') || c.name.includes('bot') || c.name.includes('general')));
                if (musicChannels.size > 0) {
                    channel = musicChannels.first();
                }
                else {
                    const textChannels = guild.channels.cache.filter((c) => c.type === discord_js_1.default.ChannelType.GuildText);
                    if (textChannels.size > 0)
                        channel = textChannels.first();
                }
                if (!channel)
                    return;
                let locale = 'en';
                try {
                    locale = (await this.localeDetector.getGuildLanguage(guildId)) || 'en';
                }
                catch (error) { }
                const embed = new discord_js_1.default.EmbedBuilder()
                    .setColor('#ffd700')
                    .setTitle('🎉 Level Up!')
                    .setDescription(`Congratulations ${user.displayName}! You've reached **Level ${newLevel}**!`)
                    .addFields([
                    { name: '📈 XP Gained', value: `+${xpGained} XP`, inline: true },
                    { name: '🏆 New Level', value: `Level ${newLevel}`, inline: true },
                    { name: '⭐ Keep Going!', value: 'Keep listening to music to gain more XP!', inline: false },
                ])
                    .setThumbnail(user.displayAvatarURL())
                    .setFooter({ text: 'Pepper Music XP System', iconURL: this.client.user?.displayAvatarURL() })
                    .setTimestamp();
                await channel.send({ embeds: [embed] }).catch(() => { });
            }
            catch (error) {
                this.client.logger.error(`[ACTION_TRACKER] Error sending level up notification: ${error}`);
            }
        };
        this.getActiveListeners = () => {
            return this.activeListeners;
        };
        this.clearActiveListener = (userId) => {
            this.activeListeners.delete(userId);
        };
        this.client = client;
        this.xpManager = xp_manager_1.XPManager.getInstance(client);
        this.localeDetector = new locales_1.LocaleDetector();
        this.setupEventListeners();
    }
}
exports.ActionTracker = ActionTracker;
ActionTracker.getInstance = (client) => {
    if (!ActionTracker.instance)
        ActionTracker.instance = new ActionTracker(client);
    return ActionTracker.instance;
};
