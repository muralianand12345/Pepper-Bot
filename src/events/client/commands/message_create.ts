import ms from "ms";
import discord from "discord.js";
import { BotEvent } from "../../../types";
import { sendTempMessage } from "../../../utils/music/music_functions";
import block_users from "../../database/schema/block_users";
import music_guild from "../../database/schema/music_guild";
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
const checkBlockedStatus = async (
    userId: string
): Promise<{ blocked: boolean; reason?: string }> => {
    const blockedUser = await block_users.findOne({
        userId: userId,
        status: true,
    });
    if (blockedUser && blockedUser.data.length > 0) {
        return {
            blocked: true,
            reason: blockedUser.data[blockedUser.data.length - 1].reason,
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
    return (
        premiumUser.isPremium &&
        premiumUser.premium.expiresAt !== null &&
        premiumUser.premium.expiresAt > now
    );
};

/**
 * Checks if a user is a DJ
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<boolean>}
 */
const checkDJStatus = async (userId: string, guildId: string): Promise<boolean> => {
    const djGuild = await music_guild.findOne({ guildId: guildId });
    if (!djGuild) return false;
    if (!djGuild.dj.enabled) return false;
    return djGuild.dj.users?.currentDJ?.userId === userId;
};

/**
 * Validates incoming message for command processing
 * @param {discord.Message} message - Discord message object
 * @param {discord.Client} client - Discord client instance
 * @returns {boolean} Whether message passes validation
 */
const validateMessage = (
    message: discord.Message,
    client: discord.Client
): boolean => {
    if (!message) {
        client.logger.warn("[MESSAGE_CREATE] Message is undefined.");
        return false;
    }

    if (client.config.bot.command.disable_message) return false;
    if (message.author.bot) return false;
    if (!message.content.startsWith(client.config.bot.command.prefix))
        return false;

    return true;
};

/**
 * Creates and sends an error embed message
 * @param {discord.Message} message - Discord message object
 * @param {string} description - Error description
 * @returns {Promise<discord.Message | undefined>} Sent message or undefined if channel type is not supported
 */
const sendErrorEmbed = async (
    message: discord.Message,
    description: string
) => {
    const errorEmbed = new discord.EmbedBuilder()
        .setDescription(description)
        .setColor("#ED4245");

    const chan = message.channel;
    if (chan instanceof discord.TextChannel) {
        sendTempMessage(chan, errorEmbed);
    }
};

/**
 * Checks command prerequisites including permissions, cooldowns, blocked status, and premium access
 * @param {any} command - Command object
 * @param {discord.Message} message - Discord message object
 * @param {discord.Client} client - Discord client instance
 * @returns {Promise<boolean>} Whether prerequisites are met
 */
const handleCommandPrerequisites = async (
    command: any,
    message: discord.Message,
    client: discord.Client
): Promise<boolean> => {
    // Check if user is blocked
    const blockStatus = await checkBlockedStatus(message.author.id);
    if (blockStatus.blocked) {
        await sendErrorEmbed(
            message,
            `🚫 You are blocked from using bot commands.\nReason: ${blockStatus.reason}`
        );
        return false;
    }

    // Check premium requirements
    if (command.premium) {
        const isPremium = await checkPremiumStatus(message.author.id);
        if (!isPremium) {
            await sendErrorEmbed(
                message,
                "⭐ This command requires premium access. Please upgrade to use this feature!"
            );
            return false;
        }
    }

    // Check cooldown
    if (command.cooldown) {
        const cooldownKey = `${command.name}${message.author.id}`;
        if (cooldown.has(cooldownKey)) {
            const cooldownTime = cooldown.get(cooldownKey);
            const remainingTime = cooldownTime ? cooldownTime - Date.now() : 0;

            const coolMsg = client.config.bot.command.cooldown_message.replace(
                "<duration>",
                ms(remainingTime)
            );

            if (remainingTime > 0) {
                await sendErrorEmbed(message, coolMsg);
                return false;
            }
        }
    }

    // Check if user is a DJ
    if (command.dj) {
        const isDJ = await checkDJStatus(
            message.author.id,
            message.guild?.id || ""
        );
        if (!isDJ) {
            const member = await message.guild?.members.fetch(
                message.author.id
            );

            if (!member) {
                return false;
            }

            if (!member.permissions.has(discord.PermissionsBitField.Flags.Administrator)) {
                await sendErrorEmbed(
                    message,
                    "🚫 You need to be a DJ or have admin permissions to use this command!"
                );
                return false;
            }
        }
    }

    // Check owner permission
    if (
        command.owner &&
        !client.config.bot.owners.includes(message.author.id)
    ) {
        await sendErrorEmbed(
            message,
            `🚫 <@${message.author.id}>, You don't have permission to use this command!`
        );
        return false;
    }

    // Check user permissions
    if (
        command.userPerms &&
        !message.member?.permissions.has(
            discord.PermissionsBitField.resolve(command.userPerms)
        )
    ) {
        await sendErrorEmbed(
            message,
            `🚫 ${message.author}, You don't have \`${command.userPerms}\` permissions to use this command!`
        );
        return false;
    }

    // Check bot permissions
    if (
        command.botPerms &&
        !message.guild?.members.cache
            .get(client.user?.id || "")
            ?.permissions.has(
                discord.PermissionsBitField.resolve(command.botPerms)
            )
    ) {
        await sendErrorEmbed(
            message,
            `🚫 ${message.author}, I don't have \`${command.botPerms}\` permissions to use this command!`
        );
        return false;
    }

    return true;
};

/**
 * Executes command and manages cooldown
 * @param {any} command - Command object
 * @param {Message} message - Discord message object
 * @param {string[]} args - Command arguments
 * @param {discord.Client} client - Discord client instance
 */
const executeCommand = async (
    command: any,
    message: discord.Message,
    args: string[],
    client: discord.Client
): Promise<void> => {
    try {
        await command.execute(client, message, args);

        await client.cmdLogger.log({
            client,
            commandName: `${client.config.bot.command.prefix}${command.name}`,
            guild: message.guild,
            user: message.author,
            channel: message.channel,
        });

        if (command.cooldown) {
            if (client.config.bot.owners.includes(message.author.id)) return;
            const cooldownKey = `${command.name}${message.author.id}`;
            const cooldownAmount = command.cooldown * 1000;

            cooldown.set(cooldownKey, Date.now() + cooldownAmount);
            setTimeout(() => cooldown.delete(cooldownKey), cooldownAmount);
        }
    } catch (error) {
        client.logger.error(
            `[MESSAGE_CREATE] Error executing command ${command.name}: ${error}`
        );
        await sendErrorEmbed(
            message,
            "An error occurred while executing this command."
        );
    }
};

/**
 * Message Create Event Handler
 * Processes all incoming Discord messages and handles message-based commands
 *
 * Features:
 * - Message validation and prefix checking
 * - Command existence verification
 * - Permission management (user and bot)
 * - Cooldown system implementation
 * - Owner-only command handling
 * - Blocked user handling
 * - Premium user handling
 * - Error management and logging
 *
 * @implements {BotEvent}
 */
const event: BotEvent = {
    name: discord.Events.MessageCreate,
    execute: async (
        message: discord.Message,
        client: discord.Client
    ): Promise<void> => {
        try {
            // Early validation checks
            if (!validateMessage(message, client)) return;

            const prefix = client.config.bot.command.prefix;
            const args = message.content
                .slice(prefix.length)
                .trim()
                .split(/ +/g);
            const commandName = args.shift()?.toLowerCase();

            if (!commandName || commandName.length === 0) return;

            // Get command from commands collection
            let command = client.commands.get(commandName);

            // If command not found directly, check aliases (if they exist)
            if (!command && "aliases" in client) {
                const alias = (client as any).aliases?.get(commandName);
                if (alias) {
                    command = client.commands.get(alias);
                }
            }

            if (!command) return;

            // Handle permissions and execution
            if (await handleCommandPrerequisites(command, message, client)) {
                await executeCommand(command, message, args, client);
            }
        } catch (error) {
            client.logger.error(
                `[MESSAGE_CREATE] Error processing message command: ${error}`
            );
        }
    },
};

export default event;
