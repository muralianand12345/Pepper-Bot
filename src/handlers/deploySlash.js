const fs = require('fs');
const path = require('path');
const {
    Events,
    REST,
    Routes
} = require('discord.js');
require("dotenv").config();

module.exports = {
    name: Events.ClientReady,
    execute(client) {
        if (client.config.bot.deployslash == true) {
            const clientID = client.user.id;
            const Token = process.env.TOKEN;

            const slashCommandsDir = path.join(__dirname, '../commands/slash');

            const slashcommands = [];

            if (!client.config.bot.deployslashRemove) {
                const slashcommandFiles = fs.readdirSync(slashCommandsDir).filter(file => file.endsWith('.js'));
                for (const file of slashcommandFiles) {
                    const command = require(`${slashCommandsDir}/${file}`);
                    slashcommands.push(command.data.toJSON());
                }
            }

            const rest = new REST({
                version: '10'
            }).setToken(Token);

            rest.put(Routes.applicationCommands(clientID), {
                body: slashcommands
            }).then(() => client.logger.success('Successfully registered application commands.'))
                .catch(err => {
                    client.logger.error(err);
                });
            slashcommands.forEach(eachcommands => {
                client.logger.info(`"${eachcommands.name}" has been loaded`);
            });
        } else {
            client.logger.success(`Deploy-Commands is set OFF`);
        }
    },
};