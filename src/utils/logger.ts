import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { ILogger } from '../types';
import { ConfigManager } from './config';

// Load environment variables
const configManager = ConfigManager.getInstance();

/**
 * Type for log message that can be either a string or an Error object
 */
type LogMessage = string | Error;

/**
 * A comprehensive logging utility class that provides colored console output
 * and file-based logging with automatic date-based directory organization.
 * Debug messages are only logged when DEBUG_MODE is enabled.
 * 
 * @example
 * ```typescript
 * const logger = new Logger();
 * logger.info('Application started');
 * logger.debug('Debug info - only shown if DEBUG_MODE is true');
 * ```
 */
class Logger implements ILogger {
    private readonly logsBasePath: string;
    private readonly logFilePath: string;
    private readonly isDebugEnabled: boolean;

    /**
     * Creates a new Logger instance.
     * 
     * @param baseDirPath - The base directory path for log files. Defaults to '../../logs'
     * @throws {Error} If unable to create required directories
     */
    constructor(baseDirPath: string = '../../logs') {
        this.logsBasePath = path.join(__dirname, baseDirPath);
        this.initializeLogDirectory();
        this.logFilePath = this.generateLogFilePath();
        this.isDebugEnabled = configManager.isDebugMode();

        // Log debug mode status on initialization
        if (this.isDebugEnabled) {
            this.info('Debug mode is enabled');
        }
    }

    /**
     * Generates an ISO timestamp string for the current time.
     * 
     * @returns A formatted timestamp string in ISO format, wrapped in square brackets
     * @private
     */
    private getCurrentTimestamp(): string {
        const date: Date = new Date();
        return `[${date.toISOString()}]`;
    }

    /**
     * Formats a log message, handling both string and Error objects.
     * 
     * @param message - The message to format
     * @returns Formatted string representation of the message
     * @private
     */
    private formatMessage(message: LogMessage): string {
        if (message instanceof Error) {
            return `${message.message}\nStack trace:\n${message.stack}`;
        }
        return message;
    }

    /**
     * Writes a log message to the log file after stripping ANSI color codes.
     * 
     * @param logMessage - The message to write to the log file
     * @private
     * @throws {Error} If unable to write to the log file
     */
    private writeToLogFile(logMessage: string): void {
        const logWithoutColor: string = logMessage.replace(/\u001b\[\d+m/g, '');
        fs.appendFileSync(this.logFilePath, logWithoutColor + '\n', 'utf8');
    }

    /**
     * Generates the appropriate log file path based on the current date.
     * Creates a directory structure organized by year and month.
     * 
     * @returns The complete path to the log file
     * @private
     * @throws {Error} If unable to create required directories
     */
    private generateLogFilePath(): string {
        const now: Date = new Date();
        const year: number = now.getFullYear();
        const month: string = now.toLocaleDateString('default', { month: 'long' });
        const day: number = now.getDate();
        const formattedDate: string = `${year}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        const yearFolderPath: string = path.join(this.logsBasePath, year.toString());
        const monthFolderPath: string = path.join(yearFolderPath, month);

        // Create directory structure if it doesn't exist
        [yearFolderPath, monthFolderPath].forEach(dirPath => {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath);
            }
        });

        return path.join(monthFolderPath, `bot-log-${formattedDate}.log`);
    }

    /**
     * Initializes the base log directory if it doesn't exist.
     * 
     * @private
     * @throws {Error} If unable to create the base directory
     */
    private initializeLogDirectory(): void {
        if (!fs.existsSync(this.logsBasePath)) {
            fs.mkdirSync(this.logsBasePath, { recursive: true });
        }
    }

    /**
     * Internal method to handle logging with different levels and colors.
     * 
     * @param level - The log level (e.g., 'ERROR', 'INFO')
     * @param color - The chalk color function to use
     * @param message - The message to log
     * @param forceLog - Whether to log regardless of debug mode
     * @private
     */
    private logWithLevel(
        level: string, 
        color: chalk.ChalkFunction, 
        message: LogMessage, 
        forceLog: boolean = true
    ): void {
        // Skip debug messages if debug mode is disabled
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

    /**
     * Logs a success message with green color.
     * 
     * @param message - The success message to log
     */
    public success(message: LogMessage): void {
        this.logWithLevel('SUCCESS', chalk.green, message);
    }

    /**
     * Logs a regular message with blue color.
     * 
     * @param message - The message to log
     */
    public log(message: LogMessage): void {
        this.logWithLevel('LOG', chalk.blue, message);
    }

    /**
     * Logs an error message with red color.
     * 
     * @param message - The error message to log
     */
    public error(message: LogMessage): void {
        this.logWithLevel('ERROR', chalk.red, message);
    }

    /**
     * Logs a warning message with yellow color.
     * 
     * @param message - The warning message to log
     */
    public warn(message: LogMessage): void {
        this.logWithLevel('WARN', chalk.yellow, message);
    }

    /**
     * Logs an info message with cyan color.
     * 
     * @param message - The info message to log
     */
    public info(message: LogMessage): void {
        this.logWithLevel('INFO', chalk.cyan, message);
    }

    /**
     * Logs a debug message with magenta color.
     * Only logs if DEBUG_MODE is enabled in the configuration.
     * 
     * @param message - The debug message to log
     * @example
     * ```typescript
     * logger.debug('Variable state: ' + JSON.stringify(data));
     * // Only appears if DEBUG_MODE is true in .env
     * ```
     */
    public debug(message: LogMessage): void {
        this.logWithLevel('DEBUG', chalk.magenta, message, false);
    }
}

export default Logger;