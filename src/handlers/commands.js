const fs = require('fs');
const path = require('path');
const {
    Collection,
    Events
} = require('discord.js');

const messageCommands = new Collection();
const slashCommands = new Collection();

module.exports = {
    name: Events.ClientReady,
    execute(client) {

        const messageCommandsDir = path.join(__dirname, '../commands/message');
        const messageCommandFiles = fs.readdirSync(messageCommandsDir).filter(file => file.endsWith('.js'));

        for (const file of messageCommandFiles) {
            const command = require(`../commands/message/${file}`);
            messageCommands.set(command.name, command);
        }

        const slashCommandsDir = path.join(__dirname, '../commands/slash');
        const slashCommandFiles = fs.readdirSync(slashCommandsDir).filter(file => file.endsWith('.js'));

        for (const file of slashCommandFiles) {
            const command = require(`../commands/slash/${file}`);
            slashCommands.set(command.data.name, command);
        }

        client.messageCommands = messageCommands;
        client.slashCommands = slashCommands;
    }
}