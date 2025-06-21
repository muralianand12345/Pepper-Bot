"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MusicPlayerValidator = exports.VoiceChannelValidator = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const locales_1 = require("../../locales");
const response_1 = require("./response");
class VoiceChannelValidator {
    constructor(client, interaction) {
        this.requiredPermissions = [discord_js_1.default.PermissionsBitField.Flags.Connect, discord_js_1.default.PermissionsBitField.Flags.Speak];
        this.getGuild = () => {
            return this.interaction.guild || null;
        };
        this.getUserId = () => {
            return this.interaction.user.id;
        };
        this.createErrorEmbed = async (messageKey, data) => {
            const locale = await this.localeDetector.detectLocale(this.interaction);
            const t = await this.localeDetector.getTranslator(this.interaction);
            return new response_1.MusicResponseHandler(this.client).createErrorEmbed(t(messageKey, data), locale);
        };
        this.getGuildMember = async () => {
            const guild = this.getGuild();
            const userId = this.getUserId();
            if (!guild)
                return undefined;
            try {
                return guild.members.cache.get(userId) || (await guild.members.fetch(userId));
            }
            catch (error) {
                this.client.logger.error(`[VALIDATOR] Failed to fetch guild member: ${error}`);
                return undefined;
            }
        };
        this.validateGuildMember = async () => {
            const member = await this.getGuildMember();
            if (!member)
                return [false, await this.createErrorEmbed('responses.errors.not_in_server')];
            return [true, await this.createErrorEmbed('')];
        };
        this.validateGuildContext = async () => {
            return !this.getGuild() ? [false, await this.createErrorEmbed('responses.errors.server_only')] : [true, await this.createErrorEmbed('')];
        };
        this.validateVoiceConnection = async () => {
            const [isValid, errorEmbed] = await this.validateGuildMember();
            if (!isValid)
                return [false, errorEmbed];
            const member = await this.getGuildMember();
            if (!member)
                return [false, await this.createErrorEmbed('responses.errors.not_in_server')];
            const voiceChannel = member.voice.channel;
            if (!voiceChannel)
                return [false, await this.createErrorEmbed('responses.errors.no_voice_channel')];
            const guild = this.getGuild();
            const botMember = guild.members.me;
            if (!botMember?.permissions.has(this.requiredPermissions))
                return [false, await this.createErrorEmbed('responses.errors.need_permissions', { channelName: voiceChannel.name })];
            return !voiceChannel.joinable ? [false, await this.createErrorEmbed('responses.errors.no_permission_join', { channelName: voiceChannel.name })] : [true, await this.createErrorEmbed('')];
        };
        this.validateVoiceSameChannel = async (player) => {
            const member = await this.getGuildMember();
            if (!member)
                return [false, await this.createErrorEmbed('responses.errors.not_in_server')];
            return member.voice.channelId !== player.voiceChannelId ? [false, await this.createErrorEmbed('responses.errors.not_same_voice')] : [true, await this.createErrorEmbed('')];
        };
        this.validatePlayerConnection = async (player) => {
            const [isValid, errorEmbed] = await this.validateGuildMember();
            if (!isValid)
                return [false, errorEmbed];
            const member = await this.getGuildMember();
            if (!member)
                return [false, await this.createErrorEmbed('responses.errors.not_in_server')];
            const guild = this.getGuild();
            const botMember = guild.members.me;
            const isPlayerActuallyConnected = botMember?.voice.channelId === player.voiceChannelId && player.state === 'CONNECTED';
            if (!isPlayerActuallyConnected && player.voiceChannelId) {
                this.client.logger.warn(`[VALIDATOR] Found stale player for guild ${guild.id}, destroying...`);
                player.destroy();
                return [true, await this.createErrorEmbed('')];
            }
            if (isPlayerActuallyConnected)
                return member.voice.channelId !== player.voiceChannelId ? [false, await this.createErrorEmbed('responses.errors.not_same_voice')] : [true, await this.createErrorEmbed('')];
            return [true, await this.createErrorEmbed('')];
        };
        this.validateMusicPlaying = async (player) => {
            return !player.queue.current ? [false, await this.createErrorEmbed('responses.errors.no_player')] : [true, await this.createErrorEmbed('')];
        };
        this.client = client;
        this.interaction = interaction;
        this.localeDetector = new locales_1.LocaleDetector();
    }
}
exports.VoiceChannelValidator = VoiceChannelValidator;
class MusicPlayerValidator {
    constructor(client, player) {
        this.ytRegex = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
        this.createErrorEmbed = async (messageKey, data, interaction) => {
            const locale = interaction ? await this.localeDetector.detectLocale(interaction) : 'en';
            const t = interaction ? await this.localeDetector.getTranslator(interaction) : (key) => key;
            return new response_1.MusicResponseHandler(this.client).createErrorEmbed(t(messageKey, data), locale);
        };
        this.validatePlayerState = async (interaction) => {
            if (!this.player?.queue?.current)
                return [false, await this.createErrorEmbed('responses.errors.no_player', {}, interaction)];
            return [true, null];
        };
        this.validateQueueSize = async (count = 1, interaction) => {
            const queueSize = this.player?.queue?.size;
            if (!queueSize)
                return [false, await this.createErrorEmbed('responses.errors.no_queue', {}, interaction)];
            if (queueSize < count)
                return [false, await this.createErrorEmbed('responses.errors.queue_too_small', { count: queueSize }, interaction)];
            return [true, null];
        };
        this.validatePauseState = async (interaction) => {
            if (this.player?.paused)
                return [false, await this.createErrorEmbed('responses.errors.already_paused', {}, interaction)];
            return [true, null];
        };
        this.validateResumeState = async (interaction) => {
            if (!this.player?.paused)
                return [false, await this.createErrorEmbed('responses.errors.already_playing', {}, interaction)];
            return [true, null];
        };
        this.validateMusicSource = async (query, interaction) => {
            if (this.ytRegex.test(query))
                return [false, await this.createErrorEmbed('responses.errors.youtube_not_supported', {}, interaction)];
            return [true, await this.createErrorEmbed('', {}, interaction)];
        };
        this.client = client;
        this.player = player;
        this.localeDetector = new locales_1.LocaleDetector();
    }
}
exports.MusicPlayerValidator = MusicPlayerValidator;
