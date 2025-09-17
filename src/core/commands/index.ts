import path from 'path';
import fs from 'fs/promises';
import discord from 'discord.js';

import { Command } from '../../types';
import { ConfigManager } from '../../utils/config';

export * from './interaction';

const configManager = ConfigManager.getInstance();

export class CommandManager {
	private client: discord.Client;
	private commands: (discord.SlashCommandBuilder | discord.SlashCommandSubcommandsOnlyBuilder | discord.SlashCommandOptionsOnlyBuilder)[] = [];

	constructor(client: discord.Client) {
		this.client = client;
	}

	private loadCommands = async (directory: string, fileFilter: (file: string) => boolean): Promise<Command[]> => {
		const files = await fs.readdir(directory);
		const commandFiles = files.filter(fileFilter);

		return await Promise.all(
			commandFiles.map(async (file) => {
				const { default: command } = await import(path.join(directory, file));
				return command;
			})
		);
	};

	private register = async () => {
		const rest = new discord.REST({ version: '10' }).setToken(configManager.getToken() ?? '');
		await rest.put(discord.Routes.applicationCommands(this.client.user?.id ?? ''), { body: this.commands.map((command) => command.toJSON()) });
		this.client.logger.success('[COMMAND] Successfully registered application commands.');
	};

	load = async (directory: string): Promise<void> => {
		const loadCommands = (await this.loadCommands(directory, (file) => file.endsWith('.js') || file.endsWith('.ts'))) as Command[];
		loadCommands.forEach((command) => {
			this.client.commands.set(command.data.name, command);
			this.commands.push(command.data);
		});
		
		this.client.logger.info(`[COMMAND] Loaded ${this.client.commands.size} commands.`);
		await this.register();
	};
}
