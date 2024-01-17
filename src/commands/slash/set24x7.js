const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require('discord.js');

const musicModel = require("../../events/database/modals/musicGuild.js");

module.exports = {
    cooldown: 5000,
    owner: false,
    premium: true,
    data: new SlashCommandBuilder()
        .setName('set24x7')
        .setDescription("Sets 24 X 7 in VC Mode")
        .setDMPermission(false)
        .addBooleanOption(option => option
            .setName('status')
            .setDescription('Status of 24 X 7')
            .setRequired(true)
        ),
    async execute(interaction, client) {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        const status = interaction.options.getBoolean("status");

        if (!interaction.member.voice.channel) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Please connect to a voice channel first")],
                ephemeral: true,
            });
        }

        const musicData = await musicModel.findOne({
            guildID: interaction.guild.id,
        });

        if (!musicData) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("Use `/premium setup` first to use this command!")],
                ephemeral: true,
            });
        }

        if (status === true) {
            musicData.status247 = true;
            await musicData.save();
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Green').setDescription("24 X 7 Mode is now enabled")],
                ephemeral: true,
            });
        } else if (status === false) {
            musicData.status247 = false;
            await musicData.save();
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Green').setDescription("24 X 7 Mode is now disabled")],
                ephemeral: true,
            });
        }

    }
}