import discord from 'discord.js';
import { VoiceChannelValidator } from "../../../utils/music/music_validations";
import music_guild from '../../database/schema/music_guild';
import { BotEvent } from '../../../types';

const tempMessage = async (
    message_1: discord.Message,
    message_2: discord.Message,
    timeout: number = 5000
): Promise<void> => {
    setTimeout(() => {
        message_1.delete().catch(() => { });
        message_2.delete().catch(() => { });
    }, timeout);
}


const event: BotEvent = {
    name: discord.Events.MessageCreate,
    execute: async (message: discord.Message, client: discord.Client) => {
        if (!client.config.music.enabled) return;
        if (message.author.bot) return;
        if (!message.guild) return;

        const guild_data = await music_guild.findOne({
            guildId: message.guild.id,
        });
        if (!guild_data) return;
        if (message.channel.id !== guild_data.songChannelId) return;

        const query = message.content;
        if (!query) {
            const embed = new discord.EmbedBuilder()
                .setColor('Red')
                .setDescription('Please provide a song name or URL.');
            const msg = await message.reply({
                embeds: [embed]
            });
            return tempMessage(message, msg);
        }

        const validator = new VoiceChannelValidator(client, message);
        for (const check of [
            validator.validateMusicSource(query),
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) {
                const msg = await message.reply({
                    embeds: [embed]
                });
                return tempMessage(message, msg);
            }
        }

        const guildMember = message.guild.members.cache.get(
            message.author.id
        );

        const player = client.manager.create({
            guildId: message.guild.id || "",
            voiceChannelId: guildMember?.voice.channelId || "",
            textChannelId: guild_data.songChannelId,
            volume: 50,
            selfDeafen: true,
        });

        const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
        if (!playerValid) {
            const msg = await message.reply({
                embeds: [playerEmbed]
            });
            return tempMessage(message, msg);
        }

        if (!["CONNECTING", "CONNECTED"].includes(player.state)) {
            player.connect();
            const embed = new discord.EmbedBuilder()
                .setColor('Green')
                .setDescription(`Connected to ${guildMember?.voice.channel?.name}`);
            const msg = await message.reply({
                embeds: [embed]
            });
            tempMessage(message, msg);
        }

        try {
            const res = await client.manager.search(query, message.author);
            if (res.loadType === "error") throw new Error("No results found | loadType: error");

            switch (res.loadType) {
                case "empty": {
                    if (!player.queue.current) player.destroy();
                    const embed = new discord.EmbedBuilder()
                        .setColor('Red')
                        .setDescription("🤔 Hmm... No results found");
                    const msg = await message.reply({
                        embeds: [embed]
                    });
                    tempMessage(message, msg);
                    break;
                }

                case "track":
                case "search": {
                    const track = res.tracks[0];
                    player.queue.add(track);
                    if (!player.playing && !player.paused && player.queue.size)
                        player.play();

                    const embed = new discord.EmbedBuilder()
                        .setColor('Green')
                        .setDescription(`Added to queue: ${track.title}`);
                    const msg = await message.reply({
                        embeds: [embed]
                    });
                    tempMessage(message, msg);
                    break;
                }

                case "playlist": {
                    if (!res.playlist) break;
                    res.playlist.tracks.forEach((track) => {
                        player.queue.add(track);
                    });

                    if (
                        !player.playing &&
                        !player.paused &&
                        player.queue.totalSize === res.playlist.tracks.length
                    ) {
                        player.play();
                    }

                    const embed = new discord.EmbedBuilder()
                        .setColor('Green')
                        .setDescription(`Added to queue: ${res.playlist.name}`);
                    const msg = await message.reply({
                        embeds: [embed]
                    });
                    tempMessage(message, msg);
                    break;
                }

                default: {
                    const embed = new discord.EmbedBuilder()
                        .setColor('Red')
                        .setDescription("🤔 Hmm... No results found");
                    const msg = await message.reply({
                        embeds: [embed]
                    });
                    tempMessage(message, msg);
                    break;
                }

            }
        } catch (error) {
            client.logger.error(`[MUSIC_CHANNEL] Play error: ${error}`);
            const embed = new discord.EmbedBuilder()
                .setColor('Red')
                .setDescription("An error occurred while processing the song");
            const msg = await message.reply({
                embeds: [embed]
            });
            tempMessage(message, msg);
        }
    }
}


export default event;