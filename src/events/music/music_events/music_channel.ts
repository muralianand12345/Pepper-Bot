import discord from "discord.js";
import music_guild from "../../database/schema/music_guild";
import { MusicResponseHandler } from "../../../utils/music/embed_template";
import { handleSearchResult, sendTempMessage } from "../../../utils/music/music_functions";
import { VoiceChannelValidator, MusicPlayerValidator } from "../../../utils/music/music_validations";
import { BotEvent } from "../../../types";

const DELETE_DELAY = 5000;

const event: BotEvent = {
    name: discord.Events.MessageCreate,
    execute: async (message: discord.Message, client: discord.Client): Promise<void | any> => {
        try {
            if (message.author.bot || !message.guild) return;
            if (!client.config.music.enabled) return;

            const guildData = await music_guild.findOne({ guildId: message.guild.id });

            const chan = message.channel as discord.TextChannel;
            if (!chan.isTextBased()) return;

            if (!guildData || !guildData.songChannelId || chan.id !== guildData.songChannelId) return;

            setTimeout(() => {
                message.delete().catch(err => {
                    if (err.code !== 10008) {
                        client.logger.warn(`[MUSIC_CHANNEL] Failed to delete user message: ${err}`);
                    }
                });
            }, DELETE_DELAY);

            const query = message.content.trim();

            if (!query) {
                return sendTempMessage(
                    chan,
                    new MusicResponseHandler(client).createErrorEmbed("Please enter a song name or URL"),
                    DELETE_DELAY
                );
            }

            const validator = new VoiceChannelValidator(client, message);

            for (const check of [
                validator.validateGuildContext(),
                validator.validateVoiceConnection()
            ]) {
                const [isValid, embed] = await check;
                if (!isValid) {
                    return sendTempMessage(
                        chan,
                        embed,
                        DELETE_DELAY
                    );
                }
            }

            const guildMember = message.guild.members.cache.get(message.author.id) ||
                await message.guild.members.fetch(message.author.id).catch(() => null);

            if (!guildMember) {
                return sendTempMessage(
                    chan,
                    new MusicResponseHandler(client).createErrorEmbed("Failed to find your guild member information"),
                    DELETE_DELAY
                );
            }

            let player = client.manager.get(message.guild.id);

            if (!player) {
                player = client.manager.create({
                    guildId: message.guild.id,
                    voiceChannelId: guildMember.voice.channelId || "",
                    textChannelId: chan.id,
                    volume: 50,
                    selfDeafen: true,
                });
            } else if (player.voiceChannelId) {
                const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
                if (!playerValid) {
                    return sendTempMessage(
                        chan,
                        playerEmbed,
                        DELETE_DELAY
                    );
                }
            }

            const musicValidator = new MusicPlayerValidator(client, player);
            const [queueValid, queueError] = await musicValidator.validateMusicSource(query);
            if (!queueValid && queueError) {
                return message.reply({
                    embeds: [queueError],
                });
            }

            if (!["CONNECTING", "CONNECTED"].includes(player.state)) {
                player.connect();
                await sendTempMessage(
                    chan,
                    new MusicResponseHandler(client).createSuccessEmbed(
                        `Connected to ${guildMember.voice.channel?.name || "voice channel"}`
                    ),
                    DELETE_DELAY
                );
            }

            try {
                client.logger.info(
                    `[MUSIC_CHANNEL] User ${message.author.tag} requested song: ${query} in channel ${chan.name}`
                );

                const loadingMessage = await chan.send({
                    embeds: [
                        new MusicResponseHandler(client).createInfoEmbed(
                            `🔍 Searching for: ${query.length > 40 ? query.substring(0, 40) + "..." : query}`
                        )
                    ]
                });

                const res = await client.manager.search(query, message.author);

                loadingMessage.delete().catch(err => {
                    if (err.code !== 10008) {
                        client.logger.warn(`[MUSIC_CHANNEL] Failed to delete loading message: ${err}`);
                    }
                });

                if (res.loadType === "error") {
                    client.logger.error(`[MUSIC_CHANNEL] Search error: "Unknown error"`);
                    return sendTempMessage(
                        chan,
                        new MusicResponseHandler(client).createErrorEmbed(
                            "An error occurred while searching for the song"
                        ),
                        DELETE_DELAY
                    );
                }

                if (res.loadType === "empty") {
                    return sendTempMessage(
                        chan,
                        new MusicResponseHandler(client).createErrorEmbed(
                            "No results found for your query"
                        ),
                        DELETE_DELAY
                    );
                }

                const messageContext = {
                    type: 'message' as const,
                    message: message
                };

                await handleSearchResult(res, player, messageContext, client);

            } catch (error) {
                client.logger.error(`[MUSIC_CHANNEL] Play error: ${error}`);
                sendTempMessage(
                    chan,
                    new MusicResponseHandler(client).createErrorEmbed(
                        "An error occurred while processing the song"
                    ),
                    DELETE_DELAY
                );
            }
        } catch (error) {
            client.logger.error(`[MUSIC_CHANNEL] Message handler error: ${error}`);
        }
    },
};

export default event;