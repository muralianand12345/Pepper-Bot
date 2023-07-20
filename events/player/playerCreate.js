const { white, green }= require("chalk");

module.exports = async (client, player) => {
	const guild = client.guilds.cache.get(player.guild).name;
	console.log(white('[') + green('DEBUG') + white('] ') + green('Player Created from (') + white(`${player.guild} | ${guild}`) + green(')'));
}
