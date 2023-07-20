const chalk = require('chalk');
module.exports = async (client, guild) => {
	console.log(chalk.bgRed(`[SERVER] Server Kicked ${guild.name} (${guild.id})`));
}
