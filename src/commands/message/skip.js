const {
    EmbedBuilder
} = require('discord.js');

const musicModel = require("../../events/database/modals/musicGuild.js");
const { updateMusicChannel } = require("../../events/client/music/musicUtls/musicFunctions.js");

module.exports = {
    name: "skip",
    description: "Skip Music | skip <amount>",
    cooldown: 5000,
    owner: false,
    premium: false,
    userPerms: [],
    botPerms: [],

    async execute(client, message, args) {

        if (!client.config.music.enabled)  return await message.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")] });

        const player = client.manager.get(message.guild.id);
        var count = args.join(" ") || 1;

        if (isNaN(count)) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please enter a valid number")],
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        count = Number(count);
        
        if (!player || !player?.queue?.current) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")]
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        if (!message.member.voice.channel) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")]
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        if (message.member.voice.channel?.id !== player.voiceChannel) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me")]
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        if (player.queue.size < count) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`There are only ${player.queue.size} songs in the queue`)]
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        player.stop(count);

        if (player.queue.size === 0) {
            var musicData = await musicModel.findOne({
                guildID: message.guild.id
            });

            if (musicData) {
                await updateMusicChannel(client, musicData, player, null, true);
            }

            player.destroy();
        }

        await message.reply({
            embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription(`I skipped ${count} songs!`)],
        });
        
    }
}