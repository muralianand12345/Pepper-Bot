import { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { hyperlink } from "./format";
import { Track } from "magmastream";

const musicContent: string = 'No Music Playing Right Now 😔';

const musicrowdis = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('pause-music')
            .setLabel('Pause')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('▶️')
            .setDisabled(true)
    )
    .addComponents(
        new ButtonBuilder()
            .setCustomId('resume-music')
            .setLabel('Resume')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏸️')
            .setDisabled(true)
    )
    .addComponents(
        new ButtonBuilder()
            .setCustomId('skip-music')
            .setLabel('Skip')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏭️')
            .setDisabled(true)
    )
    .addComponents(
        new ButtonBuilder()
            .setCustomId('stop-music')
            .setLabel('Stop')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏹️')
            .setDisabled(true)
    )
    .addComponents(
        new ButtonBuilder()
            .setCustomId('loop-music')
            .setLabel('Loop')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔁')
            .setDisabled(true)
    );

const musicrow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('pause-music')
            .setLabel('Pause')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('▶️')
            .setDisabled(false)
    )
    .addComponents(
        new ButtonBuilder()
            .setCustomId('resume-music')
            .setLabel('Resume')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏸️')
            .setDisabled(false)
    )
    .addComponents(
        new ButtonBuilder()
            .setCustomId('skip-music')
            .setLabel('Skip')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏭️')
            .setDisabled(false)
    )
    .addComponents(
        new ButtonBuilder()
            .setCustomId('stop-music')
            .setLabel('Stop')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏹️')
            .setDisabled(false)
    )
    .addComponents(
        new ButtonBuilder()
            .setCustomId('loop-music')
            .setLabel('Loop')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔁')
            .setDisabled(false)
    );


const musicEmbedOff = async (client: Client) => {
    var prefixText = client.config.bot.prefix;

    if (client.config.bot.disableMessage) {
        prefixText = '/';
    }

    return new EmbedBuilder()
        .setColor(client.config.music.embedcolor)
        .setImage(client.config.music.image)
        .setAuthor({ name: 'No song playing currently', iconURL: client.user?.displayAvatarURL() })
        .setDescription(`> **${hyperlink(`${client.user?.username}`, 'https://discord.gg/XzE9hSbsNb')}** | **Music Search Channel**`)
        .setFooter({ text: `Prefix is: ${prefixText}` });
}

const musicEmbed = async (client: Client, track: Track) => {
    let trackImg = track.displayThumbnail('maxresdefault') || track.artworkUrl || client.config.music.image;
    let trackAuthor = track.author || 'Unknown';
    let trackTitle = track.title;
    if (trackTitle.length > 250) {
        trackTitle = trackTitle.substring(0, 250);
    }
    return new EmbedBuilder()
        .setColor(client.config.music.embedcolor)
        .setAuthor({ name: `${trackTitle} By - ${trackAuthor}`, iconURL: client.user?.displayAvatarURL() })
        .setImage(trackImg)
        .setFooter({ text: `Requested by ${track.requester?.tag}` })
        .setDescription(`> **Song Link: ${hyperlink('Click Me', `${track.uri}`)}** | **${hyperlink(`${client.user?.username}`, 'https://discord.gg/XzE9hSbsNb')}**`);
}

export { musicContent, musicrowdis, musicrow, musicEmbed, musicEmbedOff };