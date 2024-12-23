import fs from 'fs';
import path from 'path';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { ICommandLogger } from '../types';

/**
 * Class responsible for logging Discord bot command executions.
 * Handles both file-based logging and Discord channel logging with embeds.
 * 
 * @example
 * ```typescript
 * const commandLogger = new CommandLogger('../../logs');
 * commandLogger.log({
 *     client,
 *     commandName: '!help',
 *     guild,
 *     user,
 *     channel
 * });
 * ```
 */
class CommandLogger {
    private readonly logFilePath: string;

    /**
     * Creates a new CommandLogger instance.
     * 
     * @param logsPath - The base directory path for log files. Defaults to '../../logs'
     * @throws {Error} If unable to create log directory or file
     */
    constructor(logsPath: string = '../../logs') {
        this.logFilePath = path.join(__dirname, logsPath, 'bot-user-log.log');
        this.ensureLogDirectory();
    }

    /**
     * Ensures the log directory exists.
     * 
     * @private
     * @throws {Error} If unable to create directory
     */
    private ensureLogDirectory(): void {
        const directory = path.dirname(this.logFilePath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
    }

    /**
     * Generates an ISO timestamp string for the current time.
     * 
     * @returns A formatted timestamp string in ISO format, wrapped in square brackets
     * @private
     */
    private getCurrentTimestamp(): string {
        const now: Date = new Date();
        return `[${now.toISOString()}]`;
    }

    /**
     * Writes a log message to the log file after stripping ANSI color codes.
     * 
     * @param logMessage - The message to write to the log file
     * @private
     * @throws {Error} If unable to write to the log file
     */
    private writeToLogFile(logMessage: string): void {
        const logWithoutColor: string = logMessage.replace(/\x1b\[[0-9;]*m/g, '');
        fs.appendFileSync(this.logFilePath, logWithoutColor + '\n', 'utf8');
    }

    /**
     * Creates an embed for Discord channel logging.
     * 
     * @param options - The command logging options
     * @returns An EmbedBuilder instance with command execution details
     * @private
     */
    private createLogEmbed(options: ICommandLogger): EmbedBuilder {
        const { user, commandName, guild, channel } = options;

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setAuthor({ name: 'Command Log' })
            .setTimestamp()
            .addFields(
                { name: 'User', value: user ? `${user.tag} (<@${user.id}>)` : 'N/A' },
                { name: 'Command', value: commandName || 'N/A' }
            );

        // Add guild information
        if (!guild) {
            embed.addFields({ name: 'Guild', value: 'DM' });
        } else {
            embed.addFields({ name: 'Guild', value: `${guild.name} (${guild.id})` });
        }

        // Add channel information
        if (!channel) {
            embed.addFields({ name: 'Channel', value: 'DM' });
        } else {
            embed.addFields({ name: 'Channel', value: `${channel.name} (<#${channel.id}>)` });
        }

        return embed;
    }

    /**
     * Generates a formatted log message string.
     * 
     * @param options - The command logging options
     * @returns Formatted log message string
     * @private
     */
    private createLogMessage(options: ICommandLogger): string {
        const { user, commandName, guild, channel } = options;
        return `${this.getCurrentTimestamp()} '[COMMAND]' ${user?.tag} (${user?.id}) used command ${commandName || 'N/A'} in ${guild ? guild.name : 'DM'} [#${channel ? channel.name : 'DM'}]`;
    }

    /**
     * Logs a command execution to both file and Discord channel.
     * 
     * @param options - The command logging options
     * @throws {Error} If unable to write to log file
     * @example
     * ```typescript
     * commandLogger.log({
     *     client,
     *     commandName: '!ping',
     *     guild: message.guild,
     *     user: message.author,
     *     channel: message.channel
     * });
     * ```
     */
    public log(options: ICommandLogger): void {
        const { client, user, commandName } = options;

        // Check for undefined user
        if (!user) {
            client.logger.error(`[COMMAND_LOG] User is undefined! ${commandName}`);
        }

        // Create and write log message to file
        const logMessage = this.createLogMessage(options);
        this.writeToLogFile(logMessage);

        // Send embed to log channel
        const logChannel = client.channels.cache.get(client.config.bot.log.command) as TextChannel;
        if (logChannel) {
            const embed = this.createLogEmbed(options);
            logChannel.send({ embeds: [embed] }).catch((error: Error) => {
                client.logger.error(`[COMMAND_LOG] Failed to send log message to channel: ${error}`);
            });
        }
    }
}

export default CommandLogger;