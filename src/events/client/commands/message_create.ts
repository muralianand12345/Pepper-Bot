import ms from "ms";
import discord from "discord.js";
import block_users from "../../database/schema/block_users";
import music_guild from "../../database/schema/music_guild";
import premium_users from "../../database/schema/premium_users";
import { sendTempMessage } from "../../../utils/music/music_functions";
import { BotEvent, IMusicGuild } from "../../../types";

const cooldown: discord.Collection<string, number> = new discord.Collection();

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

const checkDJStatus = async (userId: string, music_guild: IMusicGuild | null): Promise<boolean> => {
    if (!music_guild) return false;
    if (!music_guild.dj.enabled) return false;
    return music_guild.dj.users?.currentDJ?.userId === userId;
};

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

    return true;
};

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

const handleCommandPrerequisites = async (
    command: any,
    message: discord.Message,
    client: discord.Client,
    music_guild: IMusicGuild | null
): Promise<boolean> => {
    const blockStatus = await checkBlockedStatus(message.author.id);
    if (blockStatus.blocked) {
        await sendErrorEmbed(
            message,
            `🚫 You are blocked from using bot commands.\nReason: ${blockStatus.reason}`
        );
        return false;
    }

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

    if (command.dj) {

        const isDJ = await checkDJStatus(
            message.author.id, music_guild
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

const event: BotEvent = {
    name: discord.Events.MessageCreate,
    execute: async (
        message: discord.Message,
        client: discord.Client
    ): Promise<void> => {
        try {
            if (!validateMessage(message, client)) return;

            let prefix;

            const guild_data = await music_guild.findOne({
                guildId: message.guild?.id,
            });

            if (guild_data) {
                prefix = guild_data.prefix || client.config.bot.command.prefix;
            } else {
                prefix = client.config.bot.command.prefix;
            }

            if (!message.content.startsWith(prefix)) return;

            const args = message.content
                .slice(prefix.length)
                .trim()
                .split(/ +/g);
            const commandName = args.shift()?.toLowerCase();

            if (!commandName || commandName.length === 0) return;
            let command = client.commands.get(commandName);
            if (!command && "aliases" in client) {
                const alias = (client as any).aliases?.get(commandName);
                if (alias) {
                    command = client.commands.get(alias);
                }
            }

            if (!command) return;
            if (await handleCommandPrerequisites(command, message, client, guild_data)) {
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
