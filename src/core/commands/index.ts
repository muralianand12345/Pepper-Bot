import path from 'path';
import fs from 'fs/promises';
import discord from 'discord.js';

import { Command } from '../../types';
import { isPrimaryShard } from '../../utils/shard';
import { ConfigManager } from '../../utils/config';

export * from './ban';
export * from './premium';
export * from './interaction';
export * from './autocomplete';

const configManager = ConfigManager.getInstance();

export class CommandManager {
	private client: discord.Client;
	private commands: Command[] = [];

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
			}),
		);
	};

	private register = async () => {
		if (!isPrimaryShard(this.client)) return this.client.logger.debug(`[COMMAND] Skipping global command registration on shard ${this.client.shard?.ids[0]} (primary shard only).`);

		const rest = new discord.REST({ version: '10' }).setToken(configManager.getToken() ?? '');
		const applicationId = this.client.user?.id ?? '';
		await rest.put(discord.Routes.applicationCommands(applicationId), { body: this.commands.filter((command) => !command.owner).map((command) => command.data.toJSON()) });
		this.client.logger.success('[COMMAND] Successfully registered application commands.');

		const supportGuildId = this.client.config.bot.support_server.id;
		if (!supportGuildId) return this.client.logger.warn('[COMMAND] No support server configured, skipping owner command registration.');
		await rest.put(discord.Routes.applicationGuildCommands(applicationId, supportGuildId), { body: this.commands.filter((command) => command.owner).map((command) => command.data.toJSON()) });
		this.client.logger.success('[COMMAND] Successfully registered owner commands in the support server.');
	};

	load = async (directory: string): Promise<void> => {
		const loadCommands = (await this.loadCommands(directory, (file) => file.endsWith('.js') || file.endsWith('.ts'))) as Command[];
		loadCommands.forEach((command) => {
			this.client.commands.set(command.data.name, command);
			this.commands.push(command);
		});

		this.client.logger.info(`[COMMAND] Loaded ${this.client.commands.size} commands.`);
		await this.register();
	};
}
