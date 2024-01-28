const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require('discord.js');

module.exports = {
    cooldown: 5000,
    owner: false,
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription("Filter Music with effects")
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('effects')
                .setDescription('Select the effect to apply')
                .setRequired(true)
                .addChoices(
                    { name: 'BassBoost', value: 'filter_bassboost' },
                    { name: '3D', value: 'filter_3d' },
                    { name: 'Pop', value: 'filter_pop' },
                    { name: 'Slowmotion', value: 'filter_slowmo' },
                    { name: 'Soft', value: 'filter_soft' },
                    { name: 'Reset', value: 'filter_reset' },
                )
        ),
    async execute(interaction, client) {

        const player = client.manager.get(interaction.guild.id);
        if (!player || !player?.queue?.current) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no music currently playing")],
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

        await interaction.deferReply({ ephemeral: false });

        var data = {};

        switch (interaction.options.getString('effects')) {
            case 'filter_bassboost':
                data = {
                    op: 'filters',
                    guildId: interaction.guild.id,
                    equalizer: [
                        { band: 0, gain: 0.10 },
                        { band: 1, gain: 0.10 },
                        { band: 2, gain: 0.05 },
                        { band: 3, gain: 0.05 },
                        { band: 4, gain: -0.05 },
                        { band: 5, gain: -0.05 },
                        { band: 6, gain: 0 },
                        { band: 7, gain: -0.05 },
                        { band: 8, gain: -0.05 },
                        { band: 9, gain: 0 },
                        { band: 10, gain: 0.05 },
                        { band: 11, gain: 0.05 },
                        { band: 12, gain: 0.10 },
                        { band: 13, gain: 0.10 },
                    ]
                };
                break;

            case 'filter_3d':
                data = {
                    op: 'filters',
                    guildId: interaction.guild.id,
                    rotation: { rotationHz: 0.2 }
                };
                break;

            case 'filter_pop':
                data = {
                    op: 'filters',
                    guildId: interaction.guild.id,
                    equalizer: [
                        { band: 0, gain: 0.65 },
                        { band: 1, gain: 0.45 },
                        { band: 2, gain: -0.45 },
                        { band: 3, gain: -0.65 },
                        { band: 4, gain: -0.35 },
                        { band: 5, gain: 0.45 },
                        { band: 6, gain: 0.55 },
                        { band: 7, gain: 0.6 },
                        { band: 8, gain: 0.6 },
                        { band: 9, gain: 0.6 },
                        { band: 10, gain: 0 },
                        { band: 11, gain: 0 },
                        { band: 12, gain: 0 },
                        { band: 13, gain: 0 },
                    ]
                };
                break;

            case 'filter_slowmo':
                data = {
                    op: 'filters',
                    guildId: interaction.guild.id,
                    timescale: {
                        speed: 0.5,
                        pitch: 1.0,
                        rate: 0.8
                    }
                };
                break;

            case 'filter_soft':
                data = {
                    op: 'filters',
                    guildId: interaction.guild.id,
                    equalizer: [
                        { band: 0, gain: 0 },
                        { band: 1, gain: 0 },
                        { band: 2, gain: 0 },
                        { band: 3, gain: 0 },
                        { band: 4, gain: 0 },
                        { band: 5, gain: 0 },
                        { band: 6, gain: 0 },
                        { band: 7, gain: 0 },
                        { band: 8, gain: -0.25 },
                        { band: 9, gain: -0.25 },
                        { band: 10, gain: -0.25 },
                        { band: 11, gain: -0.25 },
                        { band: 12, gain: -0.25 },
                        { band: 13, gain: -0.25 },
                    ]
                };
                break;

            case 'filter_reset':
                data = {
                    op: 'filters',
                    guildId: interaction.guild.id,
                    equalizer: []
                };
                break;

            default:
                data = {
                    op: 'filters',
                    guildId: interaction.guild.id,
                };
                break;
        }

        await player.node.send(data);

        return interaction.editReply({
            embeds: [new EmbedBuilder().setColor('Green').setDescription(`Applied filter \`${interaction.options.getString('effects')}\``).setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true })})]
        });
    }
}