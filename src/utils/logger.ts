import fs from "fs";
import path from "path";
import chalk from "chalk";

import { ILogger } from "../types";
import { ConfigManager } from "./config";


const configManager = ConfigManager.getInstance();

type LogMessage = string | Error;

/**
 * Logger class for logging messages to console and file.
 * Supports different log levels: success, log, error, warn, info, debug.
 * Logs are stored in a structured directory based on date.
 */
class Logger implements ILogger {
    private readonly logsBasePath: string;
    private readonly logFilePath: string;
    private readonly isDebugEnabled: boolean;

    constructor(baseDirPath: string = "../../logs") {
        this.logsBasePath = path.join(__dirname, baseDirPath);
        this.initializeLogDirectory();
        this.logFilePath = this.generateLogFilePath();
        this.isDebugEnabled = configManager.isDebugMode();
        if (this.isDebugEnabled) {
            this.info("Debug mode is enabled");
        }
    }

    private getCurrentTimestamp = (): string => {
        const date: Date = new Date();
        return `[${date.toISOString()}]`;
    }

    private formatMessage = (message: LogMessage): string => {
        if (message instanceof Error) {
            return `${message.message}\nStack trace:\n${message.stack}`;
        }
        return message;
    }

    private writeToLogFile = (logMessage: string): void => {
        const logWithoutColor: string = logMessage.replace(/\u001b\[\d+m/g, "");
        fs.appendFileSync(this.logFilePath, logWithoutColor + "\n", "utf8");
    }

    private generateLogFilePath = (): string => {
        const now: Date = new Date();
        const year: number = now.getFullYear();
        const month: string = now.toLocaleDateString("default", {
            month: "long",
        });
        const day: number = now.getDate();
        const formattedDate: string = `${year}-${(now.getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

        const yearFolderPath: string = path.join(
            this.logsBasePath,
            year.toString()
        );
        const monthFolderPath: string = path.join(yearFolderPath, month);

        [yearFolderPath, monthFolderPath].forEach((dirPath) => {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath);
            }
        });

        return path.join(monthFolderPath, `bot-log-${formattedDate}.log`);
    }

    private initializeLogDirectory = (): void => {
        if (!fs.existsSync(this.logsBasePath)) {
            fs.mkdirSync(this.logsBasePath, { recursive: true });
        }
    }

    private logWithLevel = (
        level: string,
        color: (text: string) => string,
        message: LogMessage,
        forceLog: boolean = true
    ): void => {
        if (!forceLog && !this.isDebugEnabled) {
            return;
        }

        const timestamp = this.getCurrentTimestamp();
        const coloredLevel = color(`[${level}]`);
        const formattedMessage = this.formatMessage(message);
        const logMessage = `${timestamp} ${color(level)} ${formattedMessage}`;

        console.log(coloredLevel, formattedMessage);
        this.writeToLogFile(logMessage);
    }

    public success = (message: LogMessage): void => {
        this.logWithLevel("SUCCESS", chalk.green, message);
    }

    public log = (message: LogMessage): void => {
        this.logWithLevel("LOG", chalk.blue, message);
    }

    public error = (message: LogMessage): void => {
        this.logWithLevel("ERROR", chalk.red, message);
    }

    public warn = (message: LogMessage): void => {
        this.logWithLevel("WARN", chalk.yellow, message);
    }

    public info = (message: LogMessage): void => {
        this.logWithLevel("INFO", chalk.cyan, message);
    }

    public debug = (message: LogMessage): void => {
        this.logWithLevel("DEBUG", chalk.magenta, message, false);
    }
}

export default Logger;
