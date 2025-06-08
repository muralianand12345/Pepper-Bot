import ms from "ms";
import discord from "discord.js";

import { MusicResponseHandler } from "../../../core/music";
import music_guild from "../../database/schema/music_guild";
import { BotEvent, IMusicGuild, Command } from "../../../types";


const cooldown: discord.Collection<string, number> = new discord.Collection();

const validateInteraction = (interaction: discord.Interaction, client: discord.Client): boolean => {
    if (!interaction) {
        client.logger.warn("[INTERACTION_CREATE] Interaction is undefined.");
        return false;
    };
    if (!interaction.isChatInputCommand()) return false;
    return true;
};

const sendErrorReply = async (client: discord.Client, interaction: discord.Interaction, description: string): Promise<void> => {
    if (interaction.isRepliable() && !interaction.replied) await interaction.reply({ embeds: [new MusicResponseHandler(client).createErrorEmbed(description)], flags: discord.MessageFlags.Ephemeral });
};

const handleCommandPrerequisites = async (command: Command, interaction: discord.Interaction, client: discord.Client, music_guild: IMusicGuild | null): Promise<boolean> => {
    if (!interaction.isChatInputCommand()) return false;
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
        await sendErrorReply(client, interaction, `🚫 <@${interaction.user.id}>, You don't have permission to use this command!`);
        return false;
    };

    if (command.userPerms && interaction.guild) {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.permissions.has(command.userPerms)) {
            await sendErrorReply(client, interaction, `🚫 You don't have \`${command.userPerms.join(", ")}\` permissions to use this command!`);
            return false;
        };
    };

    if (command.botPerms && interaction.guild) {
        const botMember = await interaction.guild.members.fetch(client.user!.id);
        if (!botMember.permissions.has(command.botPerms)) {
            await sendErrorReply(client, interaction, `🚫 I need \`${command.botPerms.join(", ")}\` permissions to execute this command!`);
            return false;
        };
    };

    return true;
};

const executeCommand = async (command: Command, interaction: discord.Interaction, client: discord.Client): Promise<void> => {
    if (!interaction.isChatInputCommand()) return;

    try {
        await command.execute(interaction, client);
        await client.cmdLogger.log({ client, commandName: `/${interaction.commandName}`, guild: interaction.guild, user: interaction.user, channel: interaction.channel as discord.TextChannel | null });

        if (command.cooldown) {
            if (client.config.bot.owners.includes(interaction.user.id)) return;
            const cooldownKey = `${command.data.name}${interaction.user.id}`;
            const cooldownAmount = command.cooldown * 1000;

            cooldown.set(cooldownKey, Date.now() + cooldownAmount);
            setTimeout(() => cooldown.delete(cooldownKey), cooldownAmount);
        };
    } catch (error) {
        client.logger.error(`[INTERACTION_CREATE] Error executing command ${command.data.name}: ${error}`);
        await sendErrorReply(client, interaction, "An error occurred while executing this command.");
    }
};

const event: BotEvent = {
    name: discord.Events.InteractionCreate,
    execute: async (interaction: discord.Interaction, client: discord.Client): Promise<void> => {
        try {
            if (interaction.isAutocomplete()) {
                const command = client.commands.get(interaction.commandName);
                if (command?.autocomplete) {
                    try {
                        await command.autocomplete(interaction, client);
                    } catch (error) {
                        client.logger.warn(`[INTERACTION_CREATE] Autocomplete error: ${error}`);
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
            if (interaction.isRepliable() && !interaction.replied) await sendErrorReply(client, interaction, "An error occurred while executing this command.");
        }
    }
};

export default event;