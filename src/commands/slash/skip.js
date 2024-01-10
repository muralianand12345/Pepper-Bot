const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require('discord.js');

const musicModel = require("../../events/database/modals/musicGuild.js");
const { musicContent, musicrowdis, musicEmbedOff } = require("../../events/client/music/musicUtls/musicEmbed.js");

module.exports = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription("Skip Music")
        .setDMPermission(false)
        .addIntegerOption(option => option
            .setName('amount')
            .setDescription('Amount of songs to skip')
            .setRequired(false)
        ),
    async execute(interaction, client) {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        const player = client.manager.get(interaction.guild.id);
        const count = interaction.options.getInteger("amount") || 1;

        if (!player || !player?.queue?.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music playing")],
                ephemeral: true,
            });
        }

        if (!interaction.member.voice.channel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")],
                ephemeral: true,
            });
        }

        if (interaction.member.voice.channel?.id !== player.voiceChannel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("It seems like you are not in the same voice channel as me")],
                ephemeral: true,
            });
        }

        if (player.queue.size < count) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription(`There are only ${player.queue.size} songs in the queue`)],
                ephemeral: true,
            });
        }

        player.stop(count);

        //check if song is the last
        if (player.queue.size === 0) {
            var musicData = await musicModel.findOne({
                guildID: interaction.guild.id
            });

            if (musicData) {
                const pannelId = musicData.musicPannelId;
                if (pannelId) {
                    const pannelChan = client.channels.cache.get(musicData.musicChannel);
                    const pannelMsg = await pannelChan.messages.fetch(pannelId);
                    if (!pannelMsg) return client.logger.error(`Music Pannel not found, setup again! | ${pannelId} `);
                    const embed = musicEmbedOff(client);
                    pannelMsg.edit({ content: musicContent , embeds: [embed], components: [musicrowdis] });
                }
            }

            player.destroy();
        }

        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription(`I skipped ${count} songs!`)],
        });
    }
}