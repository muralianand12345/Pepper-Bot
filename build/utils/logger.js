"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandLogger = exports.Logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const discord_js_1 = __importDefault(require("discord.js"));
const msg_1 = require("./msg");
const config_1 = require("./config");
const configManager = config_1.ConfigManager.getInstance();
/**
 * Logger class for logging messages to console and file.
 * Supports different log levels: success, log, error, warn, info, debug.
 * Logs are stored in a structured directory based on date.
 */
class Logger {
    constructor(baseDirPath = '../../logs') {
        this.getCurrentTimestamp = () => {
            const date = new Date();
            return `[${date.toISOString()}]`;
        };
        this.formatMessage = (message) => {
            if (message instanceof Error)
                return `${message.message}\nStack trace:\n${message.stack}`;
            return message;
        };
        this.writeToLogFile = (logMessage) => {
            const logWithoutColor = logMessage.replace(/\u001b\[\d+m/g, '');
            fs_1.default.appendFileSync(this.logFilePath, logWithoutColor + '\n', 'utf8');
        };
        this.generateLogFilePath = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.toLocaleDateString('default', { month: 'long' });
            const day = now.getDate();
            const formattedDate = `${year}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const yearFolderPath = path_1.default.join(this.logsBasePath, year.toString());
            const monthFolderPath = path_1.default.join(yearFolderPath, month);
            [yearFolderPath, monthFolderPath].forEach((dirPath) => {
                if (!fs_1.default.existsSync(dirPath))
                    fs_1.default.mkdirSync(dirPath);
            });
            return path_1.default.join(monthFolderPath, `bot-log-${formattedDate}.log`);
        };
        this.initializeLogDirectory = () => {
            if (!fs_1.default.existsSync(this.logsBasePath))
                fs_1.default.mkdirSync(this.logsBasePath, { recursive: true });
        };
        this.logWithLevel = (level, color, message, forceLog = true) => {
            if (!forceLog && !this.isDebugEnabled)
                return;
            const timestamp = this.getCurrentTimestamp();
            const coloredLevel = color(`[${level}]`);
            const formattedMessage = this.formatMessage(message);
            const logMessage = `${timestamp} ${color(level)} ${formattedMessage}`;
            console.log(coloredLevel, formattedMessage);
            this.writeToLogFile(logMessage);
        };
        this.success = (message) => {
            this.logWithLevel('SUCCESS', chalk_1.default.green, message);
        };
        this.log = (message) => {
            this.logWithLevel('LOG', chalk_1.default.blue, message);
        };
        this.error = (message) => {
            this.logWithLevel('ERROR', chalk_1.default.red, message);
        };
        this.warn = (message) => {
            this.logWithLevel('WARN', chalk_1.default.yellow, message);
        };
        this.info = (message) => {
            this.logWithLevel('INFO', chalk_1.default.cyan, message);
        };
        this.debug = (message) => {
            this.logWithLevel('DEBUG', chalk_1.default.magenta, message, false);
        };
        this.logsBasePath = path_1.default.join(__dirname, baseDirPath);
        this.initializeLogDirectory();
        this.logFilePath = this.generateLogFilePath();
        this.isDebugEnabled = configManager.isDebugMode();
        if (this.isDebugEnabled)
            this.info('Debug mode is enabled');
    }
}
exports.Logger = Logger;
/**
 * Class responsible for logging Discord bot command executions.
 * Handles both file-based logging and Discord channel logging with embeds.
 */
class CommandLogger {
    constructor(logsPath = '../../logs') {
        this.logFilePath = path_1.default.join(__dirname, logsPath, 'bot-user-log.log');
        this.ensureLogDirectory();
    }
    ensureLogDirectory() {
        const directory = path_1.default.dirname(this.logFilePath);
        if (!fs_1.default.existsSync(directory))
            fs_1.default.mkdirSync(directory, { recursive: true });
    }
    getCurrentTimestamp() {
        const now = new Date();
        return `[${now.toISOString()}]`;
    }
    writeToLogFile(logMessage) {
        const logWithoutColor = logMessage.replace(/\x1b\[[0-9;]*m/g, '');
        fs_1.default.appendFileSync(this.logFilePath, logWithoutColor + '\n', 'utf8');
    }
    async createLogEmbed(options) {
        const { client, user, commandName, guild, channel, locale } = options;
        const embed = new discord_js_1.default.EmbedBuilder()
            .setColor('Green')
            .setAuthor({ name: 'Command Log' })
            .setTimestamp()
            .addFields({ name: 'User', value: user ? `${user.tag} (<@${user.id}>)` : 'N/A' }, { name: 'Command', value: commandName || 'N/A' });
        if (!guild) {
            embed.addFields({ name: 'Guild', value: 'DM' });
        }
        else {
            const botGuildNickname = await client.guilds.cache
                .get(guild.id)
                ?.members.fetch(client.user.id)
                .then((member) => member.displayName)
                .catch(() => 'N/A');
            embed.addFields({ name: 'Guild', value: `${guild.name} (${guild.id})` }, { name: 'Bot Nickname', value: `${botGuildNickname}` });
        }
        if (!channel) {
            embed.addFields({ name: 'Channel', value: 'DM' });
        }
        else {
            embed.addFields({ name: 'Channel', value: `${channel.name} (<#${channel.id}>)` });
        }
        if (locale) {
            embed.setFooter({ text: `Locale: ${locale}` });
        }
        return embed;
    }
    createLogMessage(options) {
        const { user, commandName, guild, channel, locale } = options;
        return `${this.getCurrentTimestamp()} '[COMMAND]' ${user?.tag} (${user?.id}) used command ${commandName || 'N/A'} in ${guild ? guild.name : 'DM'} [#${channel ? channel.name : 'DM'}] ${locale ? `[${locale}]` : ''}`;
    }
    async log(options) {
        const { client, user, commandName } = options;
        if (!client?.config?.bot?.log?.command)
            return client.logger.error('[COMMAND_LOG] Missing log channel configuration');
        if (!user)
            client.logger.error(`[COMMAND_LOG] User is undefined! ${commandName}`);
        const logChannel = client.channels.cache.get(client.config.bot.log.command.toString());
        if (!logChannel || !(logChannel instanceof discord_js_1.default.TextChannel))
            return client.logger.error(`[COMMAND_LOG] Invalid log channel: ${client.config.bot.log.command}`);
        const logMessage = this.createLogMessage(options);
        this.writeToLogFile(logMessage);
        const embed = await this.createLogEmbed(options);
        await (0, msg_1.send)(client, logChannel.id, { embeds: [embed] }).catch((error) => client.logger.error(`[COMMAND_LOG] Send error: ${error}`));
    }
}
exports.CommandLogger = CommandLogger;
