import discord from 'discord.js';
import { Track } from "magmastream";
import Formatter from "../format";
import { IConfig } from '../../types';

/**
 * Creates an embed for when no music is playing
 * @param client Discord client with configuration
 * @returns Promise<EmbedBuilder>
 */
const noMusicEmbed = async (client: discord.Client & { config: IConfig }) => {
    const prefixText = client.config.bot.command.disable_message ? '/' : client.config.bot.command.prefix;
    const defaultColor: discord.ColorResolvable = '#FF0000'; // Default red color

    return new discord.EmbedBuilder()
        .setColor((client.config.content.embed.no_music_playing.color ?? defaultColor) as discord.ColorResolvable)
        .setImage(client.config.content.embed.no_music_playing.image)
        .setAuthor({
            name: client.config.content.embed.no_music_playing.author.name,
            iconURL: client.config.content.embed.no_music_playing.author.icon_url
        })
        .setDescription(`> **${Formatter.hyperlink(`${client.user?.username}`, 'https://discord.gg/XzE9hSbsNb')}** | **Music Search Channel**`)
        .setFooter({ text: `Prefix is: ${prefixText}` });
};

/**
 * Creates an embed for the currently playing music
 * @param client Discord client with configuration
 * @param track Currently playing track
 * @returns Promise<EmbedBuilder>
 */
const musicEmbed = async (client: discord.Client & { config: IConfig }, track: Track) => {
    const trackImg = track.displayThumbnail('maxresdefault') || track.artworkUrl || client.config.music.image;
    const trackAuthor = track.author || 'Unknown';
    const trackTitle = track.title.length > 250 ? track.title.substring(0, 250) : track.title;
    const defaultColor: discord.ColorResolvable = '#00FF00'; // Default green color

    return new discord.EmbedBuilder()
        .setColor((client.config.content.embed.music_playing.color ?? defaultColor) as discord.ColorResolvable)
        .setAuthor({
            name: `${trackTitle} By - ${trackAuthor}`,
            iconURL: client.user?.displayAvatarURL()
        })
        .setImage(trackImg)
        .setFooter({ text: `Requested by ${track.requester?.tag}` })
        .setDescription(`> **Song Link: ${Formatter.hyperlink('Click Me', `${track.uri}`)}** | **${Formatter.hyperlink(`${client.user?.username}`, 'https://discord.gg/XzE9hSbsNb')}**`);
};

// Button configurations remain the same
const buttonConfig = [
    { id: 'pause-music', label: 'Pause', emoji: '▶️' },
    { id: 'resume-music', label: 'Resume', emoji: '⏸️' },
    { id: 'skip-music', label: 'Skip', emoji: '⏭️' },
    { id: 'stop-music', label: 'Stop', emoji: '⏹️' },
    { id: 'loop-music', label: 'Loop', emoji: '🔁' }
];

/**
 * Creates a row of music control buttons
 * @param disabled Whether the buttons should be disabled
 * @returns ActionRowBuilder with button components
 */
const createMusicButtons = (disabled: boolean) => {
    const row = new discord.ActionRowBuilder<discord.ButtonBuilder>();

    buttonConfig.forEach(({ id, label, emoji }) => {
        row.addComponents(
            new discord.ButtonBuilder()
                .setCustomId(id)
                .setLabel(label)
                .setStyle(discord.ButtonStyle.Secondary)
                .setEmoji(emoji)
                .setDisabled(disabled)
        );
    });

    return row;
};

/**
 * Creates an error embed with the specified message
 * @param message Error message
 * @returns EmbedBuilder
 */

const createErrorEmbed = (message: string): discord.EmbedBuilder =>
    new discord.EmbedBuilder().setColor('Red').setDescription(message);

const disabldMusicButton = createMusicButtons(true);
const musicButton = createMusicButtons(false);

export {
    disabldMusicButton,
    musicButton,
    noMusicEmbed,
    musicEmbed,
    createErrorEmbed
};