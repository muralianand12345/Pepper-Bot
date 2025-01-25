import ms from "ms";
import discord from "discord.js";
import { BotEvent } from "../../../types";
import block_users from "../../database/schema/block_users";
import premium_users from "../../database/schema/premium_users";

/**
 * Collection to store active command cooldowns
 * Key format: `${commandName}${userId}`
 * Value: Timestamp when cooldown expires
 * @type {discord.Collection<string, number>}
 */
const cooldown: discord.Collection<string, number> = new discord.Collection();

/**
 * Checks if a user is blocked from using bot commands
 * @param {string} userId - Discord user ID
 * @returns {Promise<{blocked: boolean, reason?: string}>}
 */
const checkBlockedStatus = async (userId: string): Promise<{ blocked: boolean, reason?: string }> => {
    const blockedUser = await block_users.findOne({ userId: userId, status: true });
    if (blockedUser && blockedUser.data.length > 0) {
        return {
            blocked: true,
            reason: blockedUser.data[blockedUser.data.length - 1].reason
        };
    }
    return { blocked: false };
};

/**
 * Checks if a user has premium access
 * @param {string} userId - Discord user ID
 * @returns {Promise<boolean>}
 */
const checkPremiumStatus = async (userId: string): Promise<boolean> => {
    const premiumUser = await premium_users.findOne({ userId: userId });
    if (!premiumUser) return false;

    const now = new Date();
    return premiumUser.isPremium &&
        premiumUser.premium.expiresAt !== null &&
        premiumUser.premium.expiresAt > now;
};

/**
 * Validates incoming interaction for command processing
 * @param {discord.Interaction} interaction - Discord interaction object
 * @param {discord.Client} client - Discord client instance
 * @returns {boolean} Whether interaction passes validation
 */
const validateInteraction = (interaction: discord.Interaction, client: discord.Client): boolean => {
    if (!interaction) {
        client.logger.warn("[INTERACTION_CREATE] Interaction is undefined.");
        return false;
    }

    if (!interaction.isChatInputCommand()) return false;

    return true;
}

/**
 * Sends an error reply to the interaction
 * @param {discord.Interaction} interaction - Discord interaction object
 * @param {string} description - Error description
 * @returns {Promise<void>}
 */
const sendErrorReply = async (interaction: discord.Interaction, description: string): Promise<void> => {
    if (interaction.isRepliable() && !interaction.replied) {
        await interaction.reply({
            content: description,
            flags: discord.MessageFlags.Ephemeral
        });
    }
}

/**
 * Checks command prerequisites including permissions, cooldowns, blocked status, and premium access
 * @param {any} command - Command object
 * @param {discord.Interaction} interaction - Discord interaction object
 * @param {discord.Client} client - Discord client instance
 * @returns {Promise<boolean>} Whether prerequisites are met
 */
const handleCommandPrerequisites = async (command: any, interaction: discord.Interaction, client: discord.Client): Promise<boolean> => {
    if (!interaction.isChatInputCommand()) return false;

    // Check if user is blocked
    const blockStatus = await checkBlockedStatus(interaction.user.id);
    if (blockStatus.blocked) {
        await sendErrorReply(interaction,
            `🚫 You are blocked from using bot commands.\nReason: ${blockStatus.reason}`
        );
        return false;
    }

    // Check premium requirements
    if (command.premium) {
        const isPremium = await checkPremiumStatus(interaction.user.id);
        if (!isPremium) {
            await sendErrorReply(interaction,
                "⭐ This command requires premium access. Please upgrade to use this feature!"
            );
            return false;
        }
    }

    // Check cooldown
    if (command.cooldown) {
        const cooldownKey = `${command.data.name}${interaction.user.id}`;
        if (cooldown.has(cooldownKey)) {
            const cooldownTime = cooldown.get(cooldownKey);
            const remainingTime = cooldownTime ? cooldownTime - Date.now() : 0;

            if (remainingTime > 0) {
                await sendErrorReply(interaction,
                    `Please wait \`${ms(remainingTime)}\` before using this command again.`
                );
                return false;
            }
        }
    }

    // Check owner permission
    if (command.owner && !client.config.bot.owners.includes(interaction.user.id)) {
        await sendErrorReply(interaction,
            `🚫 <@${interaction.user.id}>, You don't have permission to use this command!`
        );
        return false;
    }

    // Check user permissions
    if (command.userPerms && interaction.guild) {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.permissions.has(command.userPerms)) {
            await sendErrorReply(interaction,
                `🚫 You don't have \`${command.userPerms.join(", ")}\` permissions to use this command!`
            );
            return false;
        }
    }

    // Check bot permissions
    if (command.botPerms && interaction.guild) {
        const botMember = await interaction.guild.members.fetch(client.user!.id);
        if (!botMember.permissions.has(command.botPerms)) {
            await sendErrorReply(interaction,
                `🚫 I need \`${command.botPerms.join(", ")}\` permissions to execute this command!`
            );
            return false;
        }
    }

    return true;
}

/**
 * Executes command and manages cooldown
 * @param {any} command - Command object
 * @param {discord.Interaction} interaction - Discord interaction object
 * @param {discord.Client} client - Discord client instance
 */
const executeCommand = async (command: any, interaction: discord.Interaction, client: discord.Client): Promise<void> => {
    if (!interaction.isChatInputCommand()) return;

    try {
        await command.execute(interaction, client);

        await client.cmdLogger.log({
            client,
            commandName: `/${interaction.commandName}`,
            guild: interaction.guild,
            user: interaction.user,
            channel: interaction.channel
        });

        if (command.cooldown) {
            const cooldownKey = `${command.data.name}${interaction.user.id}`;
            const cooldownAmount = command.cooldown * 1000;

            cooldown.set(cooldownKey, Date.now() + cooldownAmount);
            setTimeout(() => cooldown.delete(cooldownKey), cooldownAmount);
        }
    } catch (error) {
        client.logger.error(`[INTERACTION_CREATE] Error executing command ${command.data.name}: ${error}`);
        await sendErrorReply(interaction, "An error occurred while executing this command.");
    }
}

/**
 * Interaction Create Event Handler
 * Processes all incoming Discord interactions and handles slash commands
 * 
 * Features:
 * - Interaction validation and command verification
 * - Permission management (user and bot)
 * - Cooldown system implementation
 * - Owner-only command handling
 * - Blocked user handling
 * - Premium user access
 * - Error management and logging
 * 
 * @implements {BotEvent}
 */
const event: BotEvent = {
    name: discord.Events.InteractionCreate,
    execute: async (interaction: discord.Interaction, client: discord.Client): Promise<void> => {
        try {
            if (interaction.isAutocomplete()) {
                const command = client.slashCommands.get(interaction.commandName);
                if (command?.autocomplete) {
                    try {
                        await command.autocomplete(interaction, client);
                    } catch (error) {
                        client.logger.warn(`[INTERACTION_CREATE] Autocomplete error: ${error}`);
                    }
                }
                return;
            }

            // Early validation checks
            if (!validateInteraction(interaction, client)) return;

            if (!interaction.isChatInputCommand()) return;
            const command = client.slashCommands.get(interaction.commandName);
            if (!command) {
                client.logger.warn(`[INTERACTION_CREATE] Command ${interaction.commandName} not found.`);
                return;
            }

            // Handle permissions and execution
            if (await handleCommandPrerequisites(command, interaction, client)) {
                await executeCommand(command, interaction, client);
            }

        } catch (error) {
            client.logger.error(`[INTERACTION_CREATE] Error processing interaction command: ${error}`);

            if (interaction.isRepliable() && !interaction.replied) {
                await sendErrorReply(interaction, "An error occurred while executing this command.");
            }
        }
    }
};

export default event;