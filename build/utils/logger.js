"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
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
exports.default = Logger;
