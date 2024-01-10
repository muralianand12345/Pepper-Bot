const {
    EmbedBuilder
} = require('discord.js');

const musicModel = require("../../events/database/modals/musicGuild.js");
const { musicContent, musicrowdis, musicEmbedOff } = require("../../events/client/music/musicUtls/musicEmbed.js");

module.exports = {
    name: "stop",
    description: "Stop Music | stop",
    cooldown: 5000,
    owner: false,
    premium: false,
    userPerms: [],
    botPerms: [],

    async execute(client, message, args) {

        if (!client.config.music.enabled) return message.channel.send({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")] });

        const player = client.manager.get(message.guild.id);

        if (!player || !player?.queue?.current) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
                ephemeral: true,
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        if (!message.member.voice.channel) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")],
                ephemeral: true,
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        if (message.member.voice.channel?.id !== player.voiceChannel) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me")],
                ephemeral: true,
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        var musicData = await musicModel.findOne({
            guildID: message.guild.id
        });

        if (musicData) {
            const pannelId = musicData.musicPannelId;
            if (pannelId) {
                const pannelChan = client.channels.cache.get(musicData.musicChannel);
                const pannelMsg = await pannelChan.messages.fetch(pannelId);
                if (!pannelMsg) return client.logger.error(`Music Pannel not found, setup again! | ${pannelId} `);
                const embed = musicEmbedOff(client);
                pannelMsg.edit({ content: musicContent, embeds: [embed], components: [musicrowdis] });
            }
        }

        player.destroy();
        await message.reply({
            embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription("I stopped the music!")],
        });

    }
}