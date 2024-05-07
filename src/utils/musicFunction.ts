import { Client, TextChannel } from "discord.js";
import { musicContent, musicrowdis, musicrow, musicEmbed, musicEmbedOff } from "./musicEmbed";
import { Readable } from 'stream';
import https from 'https';

const updateMusicDB = async (musicData: any, track: any) => {
    musicData.songsNo += 1;
    let song = musicData.songs.find((song: any) => song.name === track.title);
    if (song) {
        song.times += 1;
    } else {
        musicData.songs.push({
            name: track.title,
            url: track.uri,
            times: 1
        });
    }
    await musicData.save();
}

const updateMusicChannel = async (client: Client, musicData: any, player: any, track: any, off: boolean) => {
    const pannelId = musicData.musicPannelId;
    if (pannelId) {
        const pannelChan = client.channels.cache.get(musicData.musicChannel) as TextChannel | undefined;
        if (!pannelChan) return;

        const pannelMsg = await pannelChan.messages.fetch(pannelId);
        if (!pannelMsg) return;

        let embed;
        let embedRow;
        let msgContent;

        if (off) {
            embed = await musicEmbedOff(client);
            embedRow = musicrowdis.toJSON();
            msgContent = musicContent;
        } else {
            embed = await musicEmbed(client, track);
            embedRow = musicrow.toJSON();
            msgContent = `Song queue:\n\n${player.queue.map((track: any, i: number) => `**${i + 1}** - [${track.title}](${track.uri})`).slice(0, 5).join("\n")}\n\n${player.queue.length > 5 ? `And **${player.queue.length - 5}** more tracks...` : `In the playlist **${player.queue.length}** tracks...`}`;
        }

        await pannelMsg.edit({ content: msgContent, embeds: [embed], components: [embedRow] });
    }
}

const fetchAudioStream = (url: string): Promise<Readable> => {
    return new Promise<Readable>((resolve, reject) => {
        https.get(url, { rejectUnauthorized: false }, response => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to fetch audio stream: ${response.statusCode}`));
                return;
            }
            resolve(response);
        }).on('error', error => {
            reject(error);
        });
    });
}

export { updateMusicDB, updateMusicChannel, fetchAudioStream };