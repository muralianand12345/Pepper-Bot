const { musicContent, musicrowdis, musicrow, musicEmbedOff, musicEmbed } = require("./musicEmbed.js");

async function updateMusicDB(musicData, track) {
    musicData.songsNo += 1;
    let song = musicData.songs.find((song) => song.name === track.title);
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

async function updateMusicChannel(client, musicData, player, track, off) {
    const pannelId = musicData.musicPannelId;
    if (pannelId) {
        const pannelChan = client.channels.cache.get(musicData.musicChannel);
        const pannelMsg = await pannelChan.messages.fetch(pannelId);
        if (!pannelMsg) return client.logger.error(`Music Pannel not found, setup again! | ${pannelId} `);
        
        if (off) {
            const embed = musicEmbedOff(client);
            pannelMsg.edit({ content: musicContent, embeds: [embed], components: [musicrowdis] });
        } else {
            const embed = musicEmbed(client, track);
            const musicContentQueue = `Song queue:\n\n${player.queue.map((track, i) => `**${i + 1}** - [${track.title}](${track.uri})`).slice(0, 5).join("\n")}\n\n${player.queue.length > 5 ? `And **${player.queue.length - 5}** more tracks...` : `In the playlist **${player.queue.length}** tracks...`}`;
            pannelMsg.edit({ content: musicContentQueue, embeds: [embed], components: [musicrow] });
        }
    }
}

module.exports = { updateMusicDB, updateMusicChannel };