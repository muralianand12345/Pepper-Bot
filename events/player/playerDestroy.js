const { white, red }= require("chalk");

module.exports = async (client, player) => {
	const guild = client.guilds.cache.get(player.guild).name;
	console.log(white('[') + red('DEBUG') + white('] ') + red('Player Destroyed from (') + white(`${player.guild} | ${guild}`) + red(')'));
}
