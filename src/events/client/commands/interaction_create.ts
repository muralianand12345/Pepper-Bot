import ms from "ms";
import discord from "discord.js";

import { LocaleDetector } from "../../../core/locales";
import { MusicResponseHandler } from "../../../core/music";
import music_guild from "../../database/schema/music_guild";
import { BotEvent, IMusicGuild, Command } from "../../../types";


const cooldown: discord.Collection<string, number> = new discord.Collection();
const localeDetector = new LocaleDetector();

const validateInteraction = (interaction: discord.Interaction, client: discord.Client): boolean => {
    if (!interaction) {
        client.logger.warn("[INTERACTION_CREATE] Interaction is undefined.");
        return false;
    };
    if (!interaction.isChatInputCommand()) return false;
    return true;
};

const sendErrorReply = async (client: discord.Client, interaction: discord.Interaction, messageKey: string, data?: Record<string, string | number>): Promise<void> => {
    if (!interaction.isRepliable() || interaction.replied) return;

    try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500));
        const replyPromise = (async () => {
            const locale = await localeDetector.detectLocale(interaction as any);
            const t = await localeDetector.getTranslator(interaction as any);
            const message = t(messageKey, data);

            await interaction.reply({ embeds: [new MusicResponseHandler(client).createErrorEmbed(message, locale)], flags: discord.MessageFlags.Ephemeral });
        })();

        await Promise.race([replyPromise, timeoutPromise]);
    } catch (error) {
        if (error instanceof Error && error.message === 'Timeout') {
            client.logger.warn(`[INTERACTION_CREATE] Reply timeout for interaction ${interaction.id}`);
        } else {
            client.logger.error(`[INTERACTION_CREATE] Error sending reply: ${error}`);
        }

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [new MusicResponseHandler(client).createErrorEmbed(messageKey)],
                    flags: discord.MessageFlags.Ephemeral
                });
            }
        } catch (fallbackError) {
            client.logger.error(`[INTERACTION_CREATE] Fallback reply failed: ${fallbackError}`);
        }
    }
};

const handleCommandPrerequisites = async (command: Command, interaction: discord.Interaction, client: discord.Client, music_guild: IMusicGuild | null): Promise<boolean> => {
    if (!interaction.isChatInputCommand()) return false;

    const t = await localeDetector.getTranslator(interaction);

    if (command.cooldown) {
        const cooldownKey = `${command.data.name}${interaction.user.id}`;
        if (cooldown.has(cooldownKey)) {
            const cooldownTime = cooldown.get(cooldownKey);
            const remainingTime = cooldownTime ? cooldownTime - Date.now() : 0;
            const coolMsg = client.config.bot.command.cooldown_message.replace("<duration>", ms(remainingTime));
            if (remainingTime > 0) {
                await sendErrorReply(client, interaction, coolMsg);
                return false;
            };
        };
    };

    if (command.owner && !client.config.bot.owners.includes(interaction.user.id)) {
        await sendErrorReply(client, interaction, 'responses.errors.no_permission', { user: interaction.user.toString() });
        return false;
    };

    if (command.userPerms && interaction.guild) {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.permissions.has(command.userPerms)) {
            await sendErrorReply(client, interaction, 'responses.errors.missing_user_perms', { permissions: command.userPerms.join(", ") });
            return false;
        };
    };

    if (command.botPerms && interaction.guild) {
        const botMember = await interaction.guild.members.fetch(client.user!.id);
        if (!botMember.permissions.has(command.botPerms)) {
            await sendErrorReply(client, interaction, 'responses.errors.missing_bot_perms', { permissions: command.botPerms.join(", ") });
            return false;
        };
    };

    return true;
};

const executeCommand = async (command: Command, interaction: discord.Interaction, client: discord.Client): Promise<void> => {
    if (!interaction.isChatInputCommand()) return;

    const startTime = Date.now();

    try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Command execution timeout')), 25000));
        const commandPromise = command.execute(interaction, client);
        await Promise.race([commandPromise, timeoutPromise]);
        const executionTime = Date.now() - startTime;
        client.logger.debug(`[INTERACTION_CREATE] Command ${command.data.name} executed in ${executionTime}ms`);

        await client.cmdLogger.log({ client, commandName: `/${interaction.commandName}`, guild: interaction.guild, user: interaction.user, channel: interaction.channel as discord.TextChannel | null });

        if (command.cooldown) {
            if (client.config.bot.owners.includes(interaction.user.id)) return;
            const cooldownKey = `${command.data.name}${interaction.user.id}`;
            const cooldownAmount = command.cooldown * 1000;

            cooldown.set(cooldownKey, Date.now() + cooldownAmount);
            setTimeout(() => cooldown.delete(cooldownKey), cooldownAmount);
        };
    } catch (error) {
        const executionTime = Date.now() - startTime;
        client.logger.error(`[INTERACTION_CREATE] Error executing command ${command.data.name} after ${executionTime}ms: ${error}`);

        if (error instanceof Error && error.message === 'Command execution timeout') client.logger.warn(`[INTERACTION_CREATE] Command ${command.data.name} timed out after 25 seconds`);

        try {
            if (!interaction.replied && !interaction.deferred) {
                await sendErrorReply(client, interaction, 'responses.errors.general_error');
            } else if (interaction.deferred) {
                const locale = await localeDetector.detectLocale(interaction);
                const t = await localeDetector.getTranslator(interaction);
                const message = t('responses.errors.general_error');
                const embed = new MusicResponseHandler(client).createErrorEmbed(message, locale, true);
                await interaction.editReply({ embeds: [embed] }).catch((editError) => { client.logger.error(`[INTERACTION_CREATE] Failed to edit reply: ${editError}`); });
            }
        } catch (replyError) {
            client.logger.error(`[INTERACTION_CREATE] Failed to send error reply: ${replyError}`);
        }
    }
};

const handleModalSubmit = async (interaction: discord.ModalSubmitInteraction, client: discord.Client): Promise<void> => {
    try {
        if (interaction.customId === "feedback_modal") {
            const feedbackCommand = client.commands.get("feedback");
            if (feedbackCommand?.modal) return await feedbackCommand.modal(interaction);
        }

        client.logger.warn(`[INTERACTION_CREATE] Unhandled modal interaction: ${interaction.customId}`);
    } catch (error) {
        client.logger.error(`[INTERACTION_CREATE] Error handling modal ${interaction.customId}: ${error}`);

        if (!interaction.replied && !interaction.deferred) {
            try {
                const locale = await localeDetector.detectLocale(interaction);
                const t = await localeDetector.getTranslator(interaction);
                const message = t('responses.errors.general_error');
                await interaction.reply({ content: `❌ ${message}`, flags: discord.MessageFlags.Ephemeral }).catch(() => { });
            } catch (localeError) {
                await interaction.reply({ content: "❌ An error occurred while processing your request.", flags: discord.MessageFlags.Ephemeral }).catch(() => { });
            }
        }
    }
};

const event: BotEvent = {
    name: discord.Events.InteractionCreate,
    execute: async (interaction: discord.Interaction, client: discord.Client): Promise<void> => {
        try {
            if (interaction.isModalSubmit()) return await handleModalSubmit(interaction, client);

            if (interaction.isAutocomplete()) {
                const command = client.commands.get(interaction.commandName);
                if (command?.autocomplete) {
                    try {
                        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Autocomplete timeout')), 2500));
                        const autocompletePromise = command.autocomplete(interaction, client);
                        await Promise.race([autocompletePromise, timeoutPromise]);
                    } catch (error) {
                        client.logger.warn(`[INTERACTION_CREATE] Autocomplete error: ${error}`);
                        try {
                            await interaction.respond([]);
                        } catch (respondError) {
                            client.logger.error(`[INTERACTION_CREATE] Failed to respond to autocomplete: ${respondError}`);
                        }
                    }
                }
                return;
            };

            if (!validateInteraction(interaction, client)) return;
            if (!interaction.isChatInputCommand()) return;

            const command = client.commands.get(interaction.commandName);
            if (!command) return client.logger.warn(`[INTERACTION_CREATE] Command ${interaction.commandName} not found.`);

            const guild_data = await music_guild.findOne({ guildId: interaction.guild?.id });
            if (await handleCommandPrerequisites(command, interaction, client, guild_data)) await executeCommand(command, interaction, client);
        } catch (error) {
            client.logger.error(`[INTERACTION_CREATE] Error processing interaction command: ${error}`);
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) await sendErrorReply(client, interaction, 'responses.errors.general_error');
        }
    }
};

export default event;