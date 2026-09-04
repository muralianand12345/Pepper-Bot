"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandLogger = exports.Logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const webhook_1 = require("./webhook");
const config_1 = require("./config");
const v2_1 = require("./v2");
const configManager = config_1.ConfigManager.getInstance();
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
    async createLogContainer(options) {
        const { client, user, commandName, guild, channel, locale } = options;
        const entries = [
            ['User', user ? `${user.tag} (<@${user.id}>)` : 'N/A'],
            ['Command', commandName || 'N/A'],
        ];
        if (!guild) {
            entries.push(['Guild', 'DM']);
        }
        else {
            const botGuildNickname = (await client.guilds.cache
                .get(guild.id)
                ?.members.fetch(client.user.id)
                .then((member) => member.displayName)
                .catch(() => 'N/A')) ?? 'N/A';
            entries.push(['Guild', `${guild.name} (${guild.id})`], ['Bot Nickname', `${botGuildNickname}`]);
        }
        entries.push(['Channel', channel ? `${channel.name} (<#${channel.id}>)` : 'DM']);
        return (0, v2_1.panel)(0x57f287, { title: 'Command Log', body: (0, v2_1.fields)(entries), footer: locale ? `Locale: ${locale}` : undefined, timestamp: true });
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
        const logChannelId = client.config.bot.log.command.toString();
        const logMessage = this.createLogMessage(options);
        this.writeToLogFile(logMessage);
        const container = await this.createLogContainer(options);
        await (0, webhook_1.sendChannelWebhook)(client, logChannelId, { ...(0, v2_1.v2Webhook)(container), username: `${client.user?.username || 'Pepper'} Logs`, avatarURL: client.user?.displayAvatarURL() }).catch((error) => client.logger.error(`[COMMAND_LOG] Send error: ${error}`));
    }
}
exports.CommandLogger = CommandLogger;
