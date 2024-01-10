const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '../../logs', 'bot-user-log.log');

module.exports = {
    log: (client, commandName, guild, user, channel) => {

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

        const logMessage = `${getCurrentTimestamp()} '[COMMAND]' ${user.tag} (${user.id}) used command ${commandName || 'N/A'} in ${guild ? guild.name : 'DM'} [#${channel ? channel.name : 'DM'}]`;
        writeToLogFile(logMessage);
        client.channels.cache.get(client.config.bot.logchan).send({ embeds: [embed] });
    },
};

function getCurrentTimestamp() {
    const now = new Date();
    return `[${now.toISOString()}]`;
}

function writeToLogFile(logMessage) {
    const logWithoutColor = logMessage.replace(/\x1b\[[0-9;]*m/g, '');
    fs.appendFileSync(logFilePath, logWithoutColor + '\n', 'utf8');
}