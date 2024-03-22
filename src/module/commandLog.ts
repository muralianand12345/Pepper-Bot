import { EmbedBuilder, Client, Guild, User, TextChannel } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

const logFilePath: string = path.join(__dirname, '../../logs', 'bot-user-log.log');

const getCurrentTimestamp = (): string => {
    const now: Date = new Date();
    return `[${now.toISOString()}]`;
};

const writeToLogFile = (logMessage: string): void => {
    const logWithoutColor: string = logMessage.replace(/\x1b\[[0-9;]*m/g, '');
    fs.appendFileSync(logFilePath, logWithoutColor + '\n', 'utf8');
};

const log = (client: Client, commandName: string, guild: Guild | null, user: User | null, channel: TextChannel | null): void => {
    if (!user) {
        client.logger.error(`[COMMAND LOG] User is undefined! ${commandName}`);
    }

    const embed = new EmbedBuilder()
        .setColor('Green')
        .setAuthor({ name: 'Command Log' })
        .setTimestamp()
        .addFields(
            { name: 'User', value: user ? `${user.tag} (<@${user.id}>)` : 'N/A' },
            { name: 'Command', value: commandName || 'N/A' }
        );

    if (!guild) {
        embed.addFields({ name: 'Guild', value: 'DM' });
    } else {
        embed.addFields({ name: 'Guild', value: `${guild.name} (${guild.id})` });
    }

    if (!channel) {
        embed.addFields({ name: 'Channel', value: 'DM' });
    } else {
        embed.addFields({ name: 'Channel', value: `${channel.name} (<#${channel.id}>)` });
    }

    const logMessage: string = `${getCurrentTimestamp()} '[COMMAND]' ${user?.tag} (${user?.id}) used command ${commandName || 'N/A'} in ${guild ? guild.name : 'DM'} [#${channel ? channel.name : 'DM'}]`;
    writeToLogFile(logMessage);

    const logChannel = client.channels.cache.get(client.config.bot.logchan) as TextChannel;
    if (logChannel) {
        logChannel.send({ embeds: [embed] });
    }
};

export { log };