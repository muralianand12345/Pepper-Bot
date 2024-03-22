import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { SlashCommand } from "../../types";

import musicUserModal from "../../events/database/schema/musicUser";
import musicServerModal from "../../events/database/schema/musicServerStats";
import { IMusicServerStats, IMusicUser } from "../../types";
import { hyperlink } from "../../utils/format";

const chartcommand: SlashCommand = {
    cooldown: 10000,
    owner: false,
    premium: false,
    data: new SlashCommandBuilder()
        .setName('chart')
        .setDescription("Guild or User music chart")
        .setDMPermission(true)
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Select the category of chart')
                .setRequired(true)
                .addChoices(
                    { name: 'User', value: 'chart_user' },
                    { name: 'Guild', value: 'chart_guild' },
                    { name: 'Global', value: 'chart_global' }
                )
        ),
    execute: async (interaction, client) => {

        if (!client.config.music.enabled) return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("Music is currently disabled")], ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        var musicData;

        if (interaction.options.getString("category") === "chart_user") {

            musicData = await musicUserModal.findOne({
                userId: interaction.user.id
            }) as IMusicUser;

            if (!musicData) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("You have no music stats")]
                });
            }

            const songs = musicData.songs;
            const songsNo = musicData.songsNo;

            songs.sort((a, b) => {
                return b.times - a.times;
            });

            songs.splice(5);

            const songsList = songs.map((song) => {
                return `**${hyperlink(song.name, song.url)}** - ${song.times} times`;
            });

            const songsListString = songsList.join("\n");

            const embed = new EmbedBuilder()
                .setColor(client.config.music.embedcolor)
                .setAuthor({ name: 'User Music Profile', iconURL: client.user?.displayAvatarURL() })
                .setThumbnail(interaction.user.displayAvatarURL())
                .setDescription(`\`${interaction.user.tag}\`'s **Music Profile**\n**Total Songs Played:** ${songsNo}\n\n${songsListString}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        }

        if (interaction.options.getString("category") === "chart_guild") {

            musicData = await musicServerModal.findOne({
                guildId: interaction.guild?.id
            }) as IMusicServerStats;

            if (!musicData) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("This server has no music stats")]
                });
            }

            const songs = musicData.songs;
            const songsNo = musicData.songsNo;

            songs.sort((a, b) => {
                return b.times - a.times;
            });

            songs.splice(5);

            const songsList = songs.map((song) => {
                return `**${hyperlink(song.name, song.url)}** - ${song.times} times`;
            });

            const songsListString = songsList.join("\n");

            const embed = new EmbedBuilder()
                .setColor(client.config.music.embedcolor)
                .setAuthor({ name: 'Guild Music Profile', iconURL: client.user?.displayAvatarURL() })
                .setThumbnail(interaction.guild?.iconURL() as string)
                .setDescription(`\`${interaction.guild?.name}\`'s **Music Profile**\n**Total Songs Played:** ${songsNo}\n\n${songsListString}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }

        if (interaction.options.getString("category") === "chart_global") {

            musicData = await musicServerModal.find() as IMusicServerStats[];

            if (!musicData || musicData.length === 0) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("No music stats found")]
                });
            }

            const songs: string[] = [];
            musicData.map((server: IMusicServerStats) => {
                if (!server.songs) return;
                server.songs.forEach((song) => {
                    songs.push(song);
                });
            });

            if (songs.length === 0) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('Red').setDescription("No music stats found")]
                });
            }

            const songsNo = songs.length;

            songs.sort((a: any, b: any) => {
                return b.times - a.times;
            });

            songs.splice(5);

            const songsList = songs.map((song: any) => {
                return `**${hyperlink(song.name, song.url)}** - ${song.times} times`;
            });

            const songsListString = songsList.join("\n");

            const embed = new EmbedBuilder()
                .setColor(client.config.music.embedcolor)
                .setAuthor({ name: 'Global Music Profile', iconURL: client.user?.displayAvatarURL() })
                .setDescription(`**Global Music Profile**\n**Total Songs Played:** ${songsNo}\n\n${songsListString}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }
}

export default chartcommand;