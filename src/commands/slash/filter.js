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
                    { name: 'Distort', value: 'filter_distort' },
                    { name: '8D', value: 'filter_8d' },
                    { name: 'Karaoke', value: 'filter_karaoke' },
                    { name: 'Nightcore', value: 'filter_nightcore' },
                    { name: 'Slowmo', value: 'filter_slowmo' },
                    { name: 'Soft', value: 'filter_soft' },
                    { name: 'Treble Bass', value: 'filter_trebleBass' },
                    { name: 'TV', value: 'filter_tv' },
                    { name: 'Vaporwave', value: 'filter_vaporwave' },
                    { name: 'Reset', value: 'filter_reset' },
                    { name: 'Status', value: 'filter_status' }
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

        switch (interaction.options.getString('effects')) {

            case 'filter_bassboost':
                player.filters.bassBoost();
                break;

            case 'filter_distort':
                player.filters.distort();
                break;

            case 'filter_8d':
                player.filters.eightD();
                break;

            case 'filter_karaoke':
                player.filters.karaoke();
                break;

            case 'filter_nightcore':
                player.filters.nightcore();
                break;

            case 'filter_slowmo':
                player.filters.slowMo();
                break;

            case 'filter_soft':
                player.filters.soft();
                break;

            case 'filter_trebleBass':
                player.filters.trebleBass();
                break;

            case 'filter_tv':
                player.filters.tv();
                break;

            case 'filter_vaporwave':
                player.filters.vaporwave();
                break;

            case 'filter_reset':
                player.filters.clearFilters();
                break;

            case 'filter_status':
                var filterStat = player.filters.filterStatus;
                var trueFilters = [];
                for (const [key, value] of Object.entries(filterStat)) {
                    if (value) {
                        trueFilters.push(key);
                    }
                }

                if (trueFilters.length === 0) {
                    return interaction.editReply({
                        embeds: [new EmbedBuilder().setColor('Blue').setDescription(`No Filters Applied`)],
                        ephemeral: true,
                    });
                }

                var embed = new EmbedBuilder()
                    .setColor('Blue')
                    .setDescription(`Current Filters: \`${trueFilters.join(', ')}\``);
                return interaction.editReply({
                    embeds: [embed],
                    ephemeral: true,
                });

            default:
                break;
        }

        return interaction.editReply({
            embeds: [new EmbedBuilder().setColor('Blue').setDescription(`Applied the effect \`${interaction.options.getString('effects')}\``)],
            ephemeral: true,
        });
    }
}