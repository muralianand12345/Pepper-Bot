import * as fs from 'fs';
import * as path from 'path';

import { Events, Client, Routes, SlashCommandBuilder, REST } from 'discord.js';
import { BotEvent, Command, SlashCommand } from '../types';

const event: BotEvent = {
    name: Events.ClientReady,
    execute: (client: Client) => {

        const slashCommands: SlashCommandBuilder[] = [];
        const commands: Command[] = [];

        const clientID: string | undefined = client.user?.id || "0";

        if (!client.config.bot.disableMessage) {
            const messageCommandsDir = path.join(__dirname, '../commands/message');
            const messageCommandFiles = fs.readdirSync(messageCommandsDir).filter(file => file.endsWith('.js'));
            for (const file of messageCommandFiles) {
                let command: Command = require(`../commands/message/${file}`).default;
                client.commands.set(command.name, command);
                commands.push(command);
            }
        }

        const slashCommandsDir = path.join(__dirname, '../commands/slash');
        const slashCommandFiles = fs.readdirSync(slashCommandsDir).filter(file => file.endsWith('.js'));
        for (const file of slashCommandFiles) {
            const command: SlashCommand = require(`../commands/slash/${file}`).default;
            client.slashCommands.set(command.data.name, command);
            slashCommands.push(command.data);
        }
        
        const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

        rest.put(Routes.applicationCommands(clientID), {
            body: slashCommands.map(command => command.toJSON())
        }).then(() => {
            client.logger.success('Successfully registered application commands.');
        }).catch((error) => {
            client.logger.error('Failed to register application commands.');
            client.logger.error(error);
        });
    }
}

export default event;