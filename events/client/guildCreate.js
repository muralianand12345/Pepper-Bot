const chalk = require('chalk');
module.exports = async (client, guild) => {
	console.log(chalk.bgRed(`[SERVER] Server Add ${guild.name} (${guild.id})`));
}
