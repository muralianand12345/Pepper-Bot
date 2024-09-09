import { EmbedBuilder } from "discord.js";

import musicModel from "../../events/database/schema/musicGuild";
import { updateMusicChannel } from "../../utils/musicFunction";
import { Command } from "../../types";

const stopcommand: Command = {
    name: "stop",
    description: "Stop Music | stop",
    cooldown: 5000,
    owner: false,
    premium: false,
    userPerms: [],
    botPerms: [],
    execute: async (client, message, args) => {

        const chan = message.channel as any;
        if (!chan) return;

        if (!client.config.music.enabled) return chan.send({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")] });

        if (!message.guild) {
            return message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("This command can only be used in server")]
            });
        }

        const player = client.manager.get(message.guild.id);

        if (!player || !player?.queue?.current) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")]
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        const guildMember = message.guild.members.cache.get(message.author.id);
        if (!guildMember) {
            return message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Member not found")]
            });
        }

        if (!guildMember.voice.channel) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")]
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        if (guildMember.voice.channel?.id !== player.voiceChannel) {
            return await message.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me").setFooter({text: 'If you think there is an issue, kindly contact the server admin to use \`/dcbot\` command.'})]
            }).then(m => setTimeout(async () => await m.delete(), 5000));
        }

        var musicData = await musicModel.findOne({
            guildId: message.guild.id
        });

        if (musicData) {
            await updateMusicChannel(client, musicData, player, null, true);
        }

        player.destroy();
        await message.reply({
            embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription("I stopped the music!")],
        });
    }
}

export default stopcommand;