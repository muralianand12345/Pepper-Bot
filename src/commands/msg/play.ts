import discord from "discord.js";
import { VoiceChannelValidator } from "../../utils/music/music_validations";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { handleSearchResult } from "../../utils/music/music_functions";
import { Command } from "../../types";

const command: Command = {
    name: "play",
    description: "Play a song via song name or url",
    cooldown: 5,
    owner: false,

    execute: async (
        client: discord.Client,
        message: discord.Message,
        args: Array<string>
    ) => {
        if (!client.config.music.enabled) {
            return message.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Music is currently disabled"
                    ),
                ],
            });
        }

        // Check if we have any arguments (song name/url)
        if (!args.length) {
            return message.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Please provide a song name or URL"
                    ),
                ],
            });
        }

        // Combine args to get the full query
        const query = args.join(" ");

        // Validate voice and music requirements
        const validator = new VoiceChannelValidator(client, message);
        for (const check of [
            validator.validateMusicSource(query),
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) {
                return message.reply({ embeds: [embed] });
            }
        }

        const guildMember = message.guild?.members.cache.get(message.author.id);
        if (!guildMember) {
            return message.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Failed to find your guild member information"
                    ),
                ],
            });
        }

        // Get or create player
        let player = client.manager.get(message.guild?.id || "");

        const chan = message.channel as discord.TextChannel;

        if (!player) {
            player = client.manager.create({
                guildId: message.guild?.id || "",
                voiceChannelId: guildMember.voice.channelId || "",
                textChannelId: chan.id,
                volume: 50,
                selfDeafen: true,
            });
        }

        // Check if user is in the same voice channel as the bot
        if (player.voiceChannelId) {
            const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
            if (!playerValid) {
                return message.reply({ embeds: [playerEmbed] });
            }
        }

        // Send loading message
        const loadingMsg = await message.reply({
            embeds: [
                new MusicResponseHandler(client).createInfoEmbed(
                    `🔍 Searching for: ${query.length > 40 ? query.substring(0, 40) + "..." : query}`
                ),
            ],
        });

        // Connect to voice channel if not already connected
        if (!["CONNECTING", "CONNECTED"].includes(player.state)) {
            player.connect();
            await chan.send({
                embeds: [
                    new MusicResponseHandler(client).createSuccessEmbed(
                        `Connected to ${guildMember?.voice.channel?.name || "voice channel"}`
                    ),
                ],
            });
        }

        try {
            const res = await client.manager.search(query, message.author);

            // Remove loading message
            await loadingMsg.delete().catch(() => { });

            if (res.loadType === "error") {
                return message.reply({
                    embeds: [
                        new MusicResponseHandler(client).createErrorEmbed(
                            "An error occurred while searching for the song"
                        ),
                    ],
                });
            }

            if (res.loadType === "empty") {
                return message.reply({
                    embeds: [
                        new MusicResponseHandler(client).createErrorEmbed(
                            "No results found for your query"
                        ),
                    ],
                });
            }

            // Create message context for handleSearchResult
            const messageContext = {
                type: 'message' as const,
                message: message
            };

            // Process search results and play
            await handleSearchResult(res, player, messageContext, client);
        } catch (error) {
            client.logger.error(`[MSG_PLAY] Play error: ${error}`);
            message.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "An error occurred while processing the song",
                        true
                    ),
                ],
                components: [
                    new MusicResponseHandler(client).getSupportButton(),
                ],
            });
        }
    },
};

export default command;