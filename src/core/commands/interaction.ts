import ms from 'ms';
import discord from 'discord.js';

import { Command } from '../../types';
import { LocaleDetector } from '../locales';
import { MusicResponseHandler } from '../music';
import { SurveyHandler } from '../../utils/survey';

export class CommandInteractionHandler {
	private static cooldown: discord.Collection<string, number> = new discord.Collection();
	private client: discord.Client;
	private interaction: discord.Interaction;
	private localeDetector: LocaleDetector;
	private surveyHandler: SurveyHandler;

	constructor(client: discord.Client, interaction: discord.Interaction) {
		this.client = client;
		this.interaction = interaction;
		this.localeDetector = new LocaleDetector();
		this.surveyHandler = SurveyHandler.getInstance();
	}

	public handle = async (): Promise<void> => {
		try {
			if (this.interaction.isModalSubmit()) return await this.handleModalSubmit();

			if (this.interaction.isAutocomplete()) {
				const command = this.client.commands.get(this.interaction.commandName);
				if (command?.autocomplete) {
					try {
						const timeoutPromise = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Autocomplete timeout')), 2000));
						const autocompletePromise = command.autocomplete(this.interaction, this.client);
						await Promise.race([autocompletePromise, timeoutPromise]);
					} catch (error) {
						this.client.logger.warn(`[INTERACTION_CREATE] Autocomplete error: ${error}`);
						if (!this.interaction.responded) {
							try {
								await this.interaction.respond([]);
							} catch (respondError) {
								if (!(respondError instanceof discord.DiscordAPIError && respondError.code === 10062)) this.client.logger.error(`[INTERACTION_CREATE] Failed to respond to autocomplete: ${respondError}`);
							}
						}
					}
				}
				return;
			}

			if (!this.validateInteraction()) return;
			if (!this.interaction.isChatInputCommand()) return;

			const command = this.client.commands.get(this.interaction.commandName);
			if (!command) return this.client.logger.warn(`[INTERACTION_CREATE] Command ${this.interaction.commandName} not found.`);

			if (await this.handleCommandPrerequisites(command)) {
				await this.executeCommand(command);
				await this.handleSurveyDelivery();
			}
		} catch (error) {
			this.client.logger.error(`[INTERACTION_CREATE] Error processing interaction command: ${error}`);
			if (this.interaction.isRepliable() && !this.interaction.replied && !this.interaction.deferred) {
				try {
					await this.sendErrorReply('responses.errors.general_error');
				} catch (replyError) {
					if (!(replyError instanceof discord.DiscordAPIError && replyError.code === 10062)) this.client.logger.error(`[INTERACTION_CREATE] Critical error reply failed: ${replyError}`);
				}
			}
		}
	};

	private validateInteraction = (): boolean => {
		if (!this.interaction) {
			this.client.logger.warn('[INTERACTION_CREATE] Interaction is undefined.');
			return false;
		}
		if (!this.interaction.isChatInputCommand()) return false;
		return true;
	};

	private sendErrorReply = async (messageKey: string, data?: Record<string, string | number>): Promise<void> => {
		if (!this.interaction.isRepliable() || this.interaction.replied || this.interaction.deferred) return;

		try {
			const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000));
			const replyPromise = (async () => {
				const locale = await this.localeDetector.detectLocale(this.interaction as any);
				const t = await this.localeDetector.getTranslator(this.interaction as any);
				const message = t(messageKey, data);
				if (this.interaction.isRepliable() && !this.interaction.replied && !this.interaction.deferred) await this.interaction.reply({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed(message, locale)], flags: discord.MessageFlags.Ephemeral });
			})();

			await Promise.race([replyPromise, timeoutPromise]);
		} catch (error) {
			if (error instanceof Error && error.message === 'Timeout') {
				this.client.logger.warn(`[INTERACTION_CREATE] Reply timeout for interaction ${this.interaction.id}`);
			} else if (error instanceof discord.DiscordAPIError && error.code === 10062) {
				this.client.logger.warn(`[INTERACTION_CREATE] Interaction expired: ${this.interaction.id}`);
			} else {
				this.client.logger.error(`[INTERACTION_CREATE] Error sending reply: ${error}`);
			}
		}
	};

	private handleCommandPrerequisites = async (command: Command): Promise<boolean> => {
		if (!this.interaction.isChatInputCommand()) return false;

		if (command.cooldown) {
			const cooldownKey = `${command.data.name}${this.interaction.user.id}`;
			if (CommandInteractionHandler.cooldown.has(cooldownKey)) {
				const cooldownTime = CommandInteractionHandler.cooldown.get(cooldownKey);
				const remainingTime = cooldownTime ? cooldownTime - Date.now() : 0;
				const coolMsg = this.client.config.bot.command.cooldown_message.replace('<duration>', ms(remainingTime));
				if (remainingTime > 0) {
					await this.sendErrorReply(coolMsg);
					return false;
				}
			}
		}

		if (command.owner && !this.client.config.bot.owners.includes(this.interaction.user.id)) {
			await this.sendErrorReply('responses.errors.no_permission', { user: this.interaction.user.toString() });
			return false;
		}

		if (command.userPerms && this.interaction.guild) {
			const member = await this.interaction.guild.members.fetch(this.interaction.user.id);
			if (!member.permissions.has(command.userPerms)) {
				await this.sendErrorReply('responses.errors.missing_user_perms', { permissions: command.userPerms.join(', ') });
				return false;
			}
		}

		if (command.botPerms && this.interaction.guild) {
			const botMember = await this.interaction.guild.members.fetch(this.client.user!.id);
			if (!botMember.permissions.has(command.botPerms)) {
				await this.sendErrorReply('responses.errors.missing_bot_perms', { permissions: command.botPerms.join(', ') });
				return false;
			}
		}

		return true;
	};

	private executeCommand = async (command: Command): Promise<void> => {
		if (!this.interaction.isChatInputCommand()) return;

		const startTime = Date.now();

		try {
			const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Command execution timeout')), 25000));
			const commandPromise = command.execute(this.interaction, this.client);
			await Promise.race([commandPromise, timeoutPromise]);

			const executionTime = Date.now() - startTime;
			this.client.logger.debug(`[INTERACTION_CREATE] Command ${command.data.name} executed in ${executionTime}ms`);

			await this.client.cmdLogger.log({
				client: this.client,
				commandName: `/${this.interaction.commandName}`,
				guild: this.interaction.guild,
				user: this.interaction.user,
				channel: this.interaction.channel as discord.TextChannel | null,
				locale: await this.localeDetector.detectLocale(this.interaction),
			});

			if (command.cooldown) {
				if (this.client.config.bot.owners.includes(this.interaction.user.id)) return;
				const cooldownKey = `${command.data.name}${this.interaction.user.id}`;
				const cooldownAmount = command.cooldown * 1000;

				CommandInteractionHandler.cooldown.set(cooldownKey, Date.now() + cooldownAmount);
				setTimeout(() => CommandInteractionHandler.cooldown.delete(cooldownKey), cooldownAmount);
			}
		} catch (error) {
			const executionTime = Date.now() - startTime;
			this.client.logger.error(`[INTERACTION_CREATE] Error executing command ${command.data.name} after ${executionTime}ms: ${error}`);

			if (error instanceof Error && error.message === 'Command execution timeout') this.client.logger.warn(`[INTERACTION_CREATE] Command ${command.data.name} timed out after 25 seconds`);

			try {
				if (!this.interaction.replied && !this.interaction.deferred) {
					await this.sendErrorReply('responses.errors.general_error');
				} else if (this.interaction.deferred && this.interaction.isChatInputCommand()) {
					const locale = await this.localeDetector.detectLocale(this.interaction);
					const t = await this.localeDetector.getTranslator(this.interaction);
					const message = t('responses.errors.general_error');
					const embed = new MusicResponseHandler(this.client).createErrorEmbed(message, locale, true);

					if (this.interaction.isRepliable()) {
						await this.interaction.editReply({ embeds: [embed] }).catch((editError) => {
							if (!(editError instanceof discord.DiscordAPIError && editError.code === 10062)) this.client.logger.error(`[INTERACTION_CREATE] Failed to edit reply: ${editError}`);
						});
					}
				}
			} catch (replyError) {
				if (!(replyError instanceof discord.DiscordAPIError && replyError.code === 10062)) this.client.logger.error(`[INTERACTION_CREATE] Failed to send error reply: ${replyError}`);
			}
		}
	};

	private handleSurveyDelivery = async (): Promise<void> => {
		if (!this.interaction.isChatInputCommand()) return;

		try {
			await this.surveyHandler.sendSurvey(this.client, this.interaction);
		} catch (error) {
			this.client.logger.error(`[INTERACTION_CREATE] Error sending survey: ${error}`);
		}
	};

	private handleModalSubmit = async (): Promise<void> => {
		if (!this.interaction.isModalSubmit()) return;

		try {
			if (this.interaction.customId === 'feedback_modal') {
				const feedbackCommand = this.client.commands.get('feedback');
				if (feedbackCommand?.modal) return await feedbackCommand.modal(this.interaction);
			}

			this.client.logger.warn(`[INTERACTION_CREATE] Unhandled modal interaction: ${this.interaction.customId}`);
		} catch (error) {
			this.client.logger.error(`[INTERACTION_CREATE] Error handling modal ${this.interaction.customId}: ${error}`);

			if (!this.interaction.replied && !this.interaction.deferred) {
				try {
					const t = await this.localeDetector.getTranslator(this.interaction);
					const message = t('responses.errors.general_error');
					if (this.interaction.isRepliable()) {
						await this.interaction.reply({ content: `❌ ${message}`, flags: discord.MessageFlags.Ephemeral }).catch((replyError) => {
							if (!(replyError instanceof discord.DiscordAPIError && replyError.code === 10062)) this.client.logger.error(`[INTERACTION_CREATE] Modal reply failed: ${replyError}`);
						});
					}
				} catch (localeError) {
					if (this.interaction.isRepliable()) {
						await this.interaction.reply({ content: '❌ An error occurred while processing your request.', flags: discord.MessageFlags.Ephemeral }).catch((replyError) => {
							if (!(replyError instanceof discord.DiscordAPIError && replyError.code === 10062)) this.client.logger.error(`[INTERACTION_CREATE] Modal fallback reply failed: ${replyError}`);
						});
					}
				}
			}
		}
	};
}
