import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import discord from 'discord.js';

import { send } from './msg';
import { ConfigManager } from './config';
import { ILogger, ICommandLoggerOptions, ICommandLogger } from '../types';

type LogMessage = string | Error;

const configManager = ConfigManager.getInstance();

/**
 * Logger class for logging messages to console and file.
 * Supports different log levels: success, log, error, warn, info, debug.
 * Logs are stored in a structured directory based on date.
 */
export class Logger implements ILogger {
	private readonly logsBasePath: string;
	private readonly logFilePath: string;
	private readonly isDebugEnabled: boolean;

	constructor(baseDirPath: string = '../../logs') {
		this.logsBasePath = path.join(__dirname, baseDirPath);
		this.initializeLogDirectory();
		this.logFilePath = this.generateLogFilePath();
		this.isDebugEnabled = configManager.isDebugMode();
		if (this.isDebugEnabled) this.info('Debug mode is enabled');
	}

	private getCurrentTimestamp = (): string => {
		const date: Date = new Date();
		return `[${date.toISOString()}]`;
	};

	private formatMessage = (message: LogMessage): string => {
		if (message instanceof Error) return `${message.message}\nStack trace:\n${message.stack}`;
		return message;
	};

	private writeToLogFile = (logMessage: string): void => {
		const logWithoutColor: string = logMessage.replace(/\u001b\[\d+m/g, '');
		fs.appendFileSync(this.logFilePath, logWithoutColor + '\n', 'utf8');
	};

	private generateLogFilePath = (): string => {
		const now: Date = new Date();
		const year: number = now.getFullYear();
		const month: string = now.toLocaleDateString('default', { month: 'long' });
		const day: number = now.getDate();
		const formattedDate: string = `${year}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

		const yearFolderPath: string = path.join(this.logsBasePath, year.toString());
		const monthFolderPath: string = path.join(yearFolderPath, month);

		[yearFolderPath, monthFolderPath].forEach((dirPath) => {
			if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);
		});

		return path.join(monthFolderPath, `bot-log-${formattedDate}.log`);
	};

	private initializeLogDirectory = (): void => {
		if (!fs.existsSync(this.logsBasePath)) fs.mkdirSync(this.logsBasePath, { recursive: true });
	};

	private logWithLevel = (level: string, color: (text: string) => string, message: LogMessage, forceLog: boolean = true): void => {
		if (!forceLog && !this.isDebugEnabled) return;

		const timestamp = this.getCurrentTimestamp();
		const coloredLevel = color(`[${level}]`);
		const formattedMessage = this.formatMessage(message);
		const logMessage = `${timestamp} ${color(level)} ${formattedMessage}`;

		console.log(coloredLevel, formattedMessage);
		this.writeToLogFile(logMessage);
	};

	public success = (message: LogMessage): void => {
		this.logWithLevel('SUCCESS', chalk.green, message);
	};

	public log = (message: LogMessage): void => {
		this.logWithLevel('LOG', chalk.blue, message);
	};

	public error = (message: LogMessage): void => {
		this.logWithLevel('ERROR', chalk.red, message);
	};

	public warn = (message: LogMessage): void => {
		this.logWithLevel('WARN', chalk.yellow, message);
	};

	public info = (message: LogMessage): void => {
		this.logWithLevel('INFO', chalk.cyan, message);
	};

	public debug = (message: LogMessage): void => {
		this.logWithLevel('DEBUG', chalk.magenta, message, false);
	};
}

/**
 * Class responsible for logging Discord bot command executions.
 * Handles both file-based logging and Discord channel logging with embeds.
 */
export class CommandLogger implements ICommandLogger {
	private readonly logFilePath: string;

	constructor(logsPath: string = '../../logs') {
		this.logFilePath = path.join(__dirname, logsPath, 'bot-user-log.log');
		this.ensureLogDirectory();
	}

	private ensureLogDirectory(): void {
		const directory = path.dirname(this.logFilePath);
		if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
	}

	private getCurrentTimestamp(): string {
		const now: Date = new Date();
		return `[${now.toISOString()}]`;
	}

	private writeToLogFile(logMessage: string): void {
		const logWithoutColor: string = logMessage.replace(/\x1b\[[0-9;]*m/g, '');
		fs.appendFileSync(this.logFilePath, logWithoutColor + '\n', 'utf8');
	}

	private async createLogEmbed(options: ICommandLoggerOptions): Promise<discord.EmbedBuilder> {
		const { client, user, commandName, guild, channel, locale } = options;

		const embed = new discord.EmbedBuilder()
			.setColor('Green')
			.setAuthor({ name: 'Command Log' })
			.setTimestamp()
			.addFields({ name: 'User', value: user ? `${user.tag} (<@${user.id}>)` : 'N/A' }, { name: 'Command', value: commandName || 'N/A' });

		if (!guild) {
			embed.addFields({ name: 'Guild', value: 'DM' });
		} else {
			const botGuildNickname = await client.guilds.cache
				.get(guild.id)
				?.members.fetch(client.user!.id)
				.then((member: discord.GuildMember) => member.displayName)
				.catch(() => 'N/A');
			embed.addFields({ name: 'Guild', value: `${guild.name} (${guild.id})` }, { name: 'Bot Nickname', value: `${botGuildNickname}` });
		}

		if (!channel) {
			embed.addFields({ name: 'Channel', value: 'DM' });
		} else {
			embed.addFields({ name: 'Channel', value: `${channel.name} (<#${channel.id}>)` });
		}

		if (locale) {
			embed.setFooter({ text: `Locale: ${locale}` });
		}

		return embed;
	}

	private createLogMessage(options: ICommandLoggerOptions): string {
		const { user, commandName, guild, channel, locale } = options;
		return `${this.getCurrentTimestamp()} '[COMMAND]' ${user?.tag} (${user?.id}) used command ${commandName || 'N/A'} in ${guild ? guild.name : 'DM'} [#${channel ? channel.name : 'DM'}] ${locale ? `[${locale}]` : ''}`;
	}

	public async log(options: ICommandLoggerOptions): Promise<void> {
		const { client, user, commandName } = options;

		if (!client?.config?.bot?.log?.command) return client.logger.error('[COMMAND_LOG] Missing log channel configuration');
		if (!user) client.logger.error(`[COMMAND_LOG] User is undefined! ${commandName}`);

		const logChannel = client.channels.cache.get(client.config.bot.log.command.toString()) as discord.TextChannel | undefined;
		if (!logChannel || !(logChannel instanceof discord.TextChannel)) return client.logger.error(`[COMMAND_LOG] Invalid log channel: ${client.config.bot.log.command}`);

		const logMessage = this.createLogMessage(options);
		this.writeToLogFile(logMessage);
		const embed = await this.createLogEmbed(options);
		await send(client, logChannel.id, { embeds: [embed] }).catch((error) => client.logger.error(`[COMMAND_LOG] Send error: ${error}`));
	}
}
