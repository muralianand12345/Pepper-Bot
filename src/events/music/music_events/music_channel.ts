import discord from "discord.js";
import { BotEvent } from "../../../types";
import music_guild from "../../database/schema/music_guild";
import { VoiceChannelValidator } from "../../../utils/music/music_validations";
import { MusicResponseHandler } from "../../../utils/music/embed_template";
import { handleSearchResult, sendTempMessage } from "../../../utils/music/music_functions";

/**
 * YouTube URL detection regex pattern
 */
const YOUTUBE_REGEX = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;

/**
 * Delay in milliseconds for deleting messages
 */
const DELETE_DELAY = 5000; // 5 seconds

/**
 * Message Create Event Handler for the dedicated music channel
 * Processes messages to play songs when users send song names or URLs
 * 
 * @implements {BotEvent}
 */
const event: BotEvent = {
    name: discord.Events.MessageCreate,
    execute: async (message: discord.Message, client: discord.Client): Promise<void> => {
        try {
            // Skip if message is from a bot or not in a guild
            if (message.author.bot || !message.guild) return;

            // Check if music is enabled in config
            if (!client.config.music.enabled) return;

            // Get guild data to check if this is the designated music channel
            const guildData = await music_guild.findOne({ guildId: message.guild.id });

            // Make sure channel is a text channel
            const chan = message.channel as discord.TextChannel;
            if (!chan.isTextBased()) return;

            // Skip if guild data doesn't exist or this isn't the designated music channel
            if (!guildData || !guildData.songChannelId || chan.id !== guildData.songChannelId) return;

            // Delete user message after a delay (regardless of whether we process it or not)
            setTimeout(() => {
                message.delete().catch(err => {
                    // Only log if it's not already deleted
                    if (err.code !== 10008) {
                        client.logger.warn(`[MUSIC_CHANNEL] Failed to delete user message: ${err}`);
                    }
                });
            }, DELETE_DELAY);

            // Get the query from the message content
            const query = message.content.trim();

            // Skip if query is empty
            if (!query) {
                return sendTempMessage(
                    chan,
                    new MusicResponseHandler(client).createErrorEmbed("Please enter a song name or URL"),
                    DELETE_DELAY
                );
            }

            // Check if query is a YouTube link
            if (YOUTUBE_REGEX.test(query)) {
                return sendTempMessage(
                    chan,
                    new MusicResponseHandler(client).createErrorEmbed("YouTube links are not supported at this time"),
                    DELETE_DELAY
                );
            }

            // Validate voice channel requirements
            const validator = new VoiceChannelValidator(client, message);

            // Run validations
            for (const check of [
                validator.validateMusicSource(query),
                validator.validateGuildContext(),
                validator.validateVoiceConnection(),
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

            // Get guild member
            const guildMember = message.guild.members.cache.get(message.author.id) ||
                await message.guild.members.fetch(message.author.id).catch(() => null);

            if (!guildMember) {
                return sendTempMessage(
                    chan,
                    new MusicResponseHandler(client).createErrorEmbed("Failed to find your guild member information"),
                    DELETE_DELAY
                );
            }

            // Create or get player
            let player = client.manager.get(message.guild.id);

            // Create new player if none exists
            if (!player) {
                player = client.manager.create({
                    guildId: message.guild.id,
                    voiceChannelId: guildMember.voice.channelId || "",
                    textChannelId: chan.id,
                    volume: 50,
                    selfDeafen: true,
                });
            } else if (player.voiceChannelId) {
                // Validate if user is in the same voice channel as the bot (only if player has a voice channel)
                const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
                if (!playerValid) {
                    return sendTempMessage(
                        chan,
                        playerEmbed,
                        DELETE_DELAY
                    );
                }
            }

            // Connect to voice channel if not already connected
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

            // Search and play the track
            try {
                client.logger.info(
                    `[MUSIC_CHANNEL] User ${message.author.tag} requested song: ${query} in channel ${chan.name}`
                );

                // Send loading message
                const loadingMessage = await chan.send({
                    embeds: [
                        new MusicResponseHandler(client).createInfoEmbed(
                            `🔍 Searching for: ${query.length > 40 ? query.substring(0, 40) + "..." : query}`
                        )
                    ]
                });

                // Search for the track
                const res = await client.manager.search(query, message.author);

                // Delete loading message
                loadingMessage.delete().catch(err => {
                    if (err.code !== 10008) { // Only log if not already deleted
                        client.logger.warn(`[MUSIC_CHANNEL] Failed to delete loading message: ${err}`);
                    }
                });

                // Handle search result
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

                // Create context object for handleSearchResult
                const messageContext = {
                    type: 'message' as const,
                    message: message
                };

                // Process search results and play
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