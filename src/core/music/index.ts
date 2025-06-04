export * from "./db";
export * from "./utils";
export * from "./auto_search";
export * from "./dj_role_service";
export * from "./autoplay_manager";
export * from "./music_validations";
export * from "./now_playing_manager";
export * from "./playlist_suggestion";

import discord from "discord.js";
import magmastream from "magmastream";
import { MusicResponseHandler, handleSearchResult } from "./utils";
import { VoiceChannelValidator, MusicPlayerValidator } from "./music_validations";
import { ConfigManager } from "../../utils/config";
import { CommandContext } from "../../types";

/**
 * Main Music class that handles all music-related operations
 * Supports both slash command interactions and message commands
 */
export class Music {
    private readonly client: discord.Client;
    private readonly configManager: ConfigManager;
    private readonly responseHandler: MusicResponseHandler;
    private readonly defaultConfig = {
        errorSearchText: "No results found. Please try a different search.",
        defaultSearchText: "Please enter a song name or url",
        playerOptions: {
            volume: 50,
            selfDeafen: true,
        }
    };

    constructor(client: discord.Client) {
        this.client = client;
        this.configManager = ConfigManager.getInstance();
        this.responseHandler = new MusicResponseHandler(client);
    }

    /**
     * Gets guild ID from context
     */
    private getGuildId = (context: CommandContext): string | null => {
        if (context.type === 'interaction') {
            return context.interaction.guildId;
        }
        return context.message.guild?.id || null;
    };

    /**
     * Gets user from context
     */
    private getUser = (context: CommandContext): discord.User => {
        if (context.type === 'interaction') {
            return context.interaction.user;
        }
        return context.message.author;
    };

    /**
     * Gets channel ID from context
     */
    private getChannelId = (context: CommandContext): string => {
        if (context.type === 'interaction') {
            return context.interaction.channelId;
        }
        return context.message.channel.id;
    };

    /**
     * Gets guild member from context
     */
    private getGuildMember = async (context: CommandContext): Promise<discord.GuildMember | null> => {
        const user = this.getUser(context);
        const guildId = this.getGuildId(context);

        if (!guildId) return null;

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return null;

        try {
            return guild.members.cache.get(user.id) || await guild.members.fetch(user.id);
        } catch {
            return null;
        }
    };

    /**
     * Sends response based on context type
     */
    private sendResponse = async (
        context: CommandContext,
        options: {
            embeds: discord.EmbedBuilder[];
            components?: discord.ActionRowBuilder<discord.ButtonBuilder>[];
            ephemeral?: boolean;
        }
    ): Promise<void> => {
        if (context.type === 'interaction') {
            if (context.interaction.deferred) {
                await context.interaction.editReply({
                    embeds: options.embeds,
                    components: options.components
                });
            } else {
                await context.interaction.reply({
                    embeds: options.embeds,
                    components: options.components,
                    flags: options.ephemeral ? discord.MessageFlags.Ephemeral : undefined
                });
            }
        } else {
            await context.message.reply({
                embeds: options.embeds,
                components: options.components
            });
        }
    };

    /**
     * Validates Lavalink node if specified
     */
    private validateLavalinkNode = (nodeChoice?: string): [boolean, discord.EmbedBuilder | null] => {
        if (!nodeChoice) return [true, null];

        const node = this.client.manager.nodes.find(
            (n: magmastream.Node) => n.options.identifier === nodeChoice
        );

        if (!node) {
            return [false, this.responseHandler.createErrorEmbed("Invalid Lavalink node")];
        }

        if (!node.connected) {
            return [false, this.responseHandler.createErrorEmbed("Lavalink node is not connected")];
        }

        return [true, null];
    };

    /**
     * Creates or gets existing player
     */
    private createOrGetPlayer = (
        guildId: string,
        voiceChannelId: string,
        textChannelId: string,
        nodeChoice?: string
    ): magmastream.Player => {
        let player = this.client.manager.get(guildId);

        if (!player) {
            player = this.client.manager.create({
                guildId,
                voiceChannelId,
                textChannelId,
                node: nodeChoice,
                ...this.defaultConfig.playerOptions,
            });
        }

        return player;
    };

    /**
     * Main play method that handles music playback
     */
    public play = async (
        context: CommandContext,
        query: string,
        nodeChoice?: string
    ): Promise<void> => {
        try {
            // Check if music is enabled
            if (!this.client.config.music.enabled) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("Music is currently disabled")],
                    ephemeral: true
                });
                return;
            }

            const guildId = this.getGuildId(context);
            if (!guildId) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("This command can only be used in a server")],
                    ephemeral: true
                });
                return;
            }

            // Validate query
            if (!query || query === this.defaultConfig.defaultSearchText) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("Please enter a song name or URL")],
                    ephemeral: true
                });
                return;
            }

            // Check if player exists and validate node choice
            if (nodeChoice && this.client.manager.get(guildId)) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed(
                        "You have an active music player in this server. Please stop the current player before switching Lavalink nodes."
                    )],
                    ephemeral: true
                });
                return;
            }

            // Validate Lavalink node
            const [nodeValid, nodeError] = this.validateLavalinkNode(nodeChoice);
            if (!nodeValid && nodeError) {
                await this.sendResponse(context, {
                    embeds: [nodeError],
                    ephemeral: true
                });
                return;
            }

            // Validate voice connection
            const validator = new VoiceChannelValidator(this.client, context);
            for (const check of [
                validator.validateGuildContext(),
                validator.validateVoiceConnection(),
            ]) {
                const [isValid, embed] = await check;
                if (!isValid) {
                    await this.sendResponse(context, {
                        embeds: [embed],
                        ephemeral: true
                    });
                    return;
                }
            }

            const guildMember = await this.getGuildMember(context);
            if (!guildMember || !guildMember.voice.channelId) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("You need to be in a voice channel")],
                    ephemeral: true
                });
                return;
            }

            // Create player
            const player = this.createOrGetPlayer(
                guildId,
                guildMember.voice.channelId,
                this.getChannelId(context),
                nodeChoice
            );

            // Validate player connection
            const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
            if (!playerValid) {
                await this.sendResponse(context, {
                    embeds: [playerEmbed],
                    ephemeral: true
                });
                return;
            }

            // Validate music source
            const musicValidator = new MusicPlayerValidator(this.client, player);
            const [sourceValid, sourceError] = await musicValidator.validateMusicSource(query);
            if (!sourceValid && sourceError) {
                await this.sendResponse(context, {
                    embeds: [sourceError],
                    ephemeral: true
                });
                return;
            }

            // Defer reply for interactions
            if (context.type === 'interaction' && !context.interaction.deferred) {
                await context.interaction.deferReply();
            }

            // Connect to voice channel
            if (!["CONNECTING", "CONNECTED"].includes(player.state)) {
                player.connect();
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createSuccessEmbed(
                        `Connected to ${guildMember.voice.channel?.name}`
                    )],
                });
            }

            // Search for music
            const searchResult = await this.client.manager.search(query, this.getUser(context));

            if (searchResult.loadType === "error") {
                throw new Error("No results found | loadType: error");
            }

            // Handle search result
            await handleSearchResult(searchResult, player, context, this.client);

        } catch (error) {
            this.client.logger.error(`[MUSIC_CLASS] Play error: ${error}`);
            await this.sendResponse(context, {
                embeds: [this.responseHandler.createErrorEmbed(
                    "An error occurred while processing the song", true
                )],
                components: [this.responseHandler.getSupportButton()],
                ephemeral: true
            });
        }
    };

    /**
     * Stop music playback
     */
    public stop = async (context: CommandContext): Promise<void> => {
        try {
            if (!this.client.config.music.enabled) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("Music is currently disabled")],
                    ephemeral: true
                });
                return;
            }

            const guildId = this.getGuildId(context);
            if (!guildId) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("This command can only be used in a server")],
                    ephemeral: true
                });
                return;
            }

            const player = this.client.manager.get(guildId);
            if (!player) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("No music is currently playing")],
                    ephemeral: true
                });
                return;
            }

            const validator = new VoiceChannelValidator(this.client, context);
            for (const check of [
                validator.validateGuildContext(),
                validator.validateVoiceConnection(),
                validator.validateMusicPlaying(player),
                validator.validateVoiceSameChannel(player),
            ]) {
                const [isValid, embed] = await check;
                if (!isValid) {
                    await this.sendResponse(context, {
                        embeds: [embed],
                        ephemeral: true
                    });
                    return;
                }
            }

            player.destroy();
            await this.sendResponse(context, {
                embeds: [this.responseHandler.createSuccessEmbed("Music playback has been stopped")]
            });

        } catch (error) {
            this.client.logger.error(`[MUSIC_CLASS] Stop error: ${error}`);
            await this.sendResponse(context, {
                embeds: [this.responseHandler.createErrorEmbed("An error occurred while stopping music")],
                ephemeral: true
            });
        }
    };

    /**
     * Skip current track
     */
    public skip = async (context: CommandContext, time?: number): Promise<void> => {
        try {
            if (!this.client.config.music.enabled) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("Music is currently disabled")],
                    ephemeral: true
                });
                return;
            }

            const guildId = this.getGuildId(context);
            if (!guildId) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("This command can only be used in a server")],
                    ephemeral: true
                });
                return;
            }

            const player = this.client.manager.get(guildId);
            if (!player) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("No music is currently playing")],
                    ephemeral: true
                });
                return;
            }

            const validator = new VoiceChannelValidator(this.client, context);
            for (const check of [
                validator.validateGuildContext(),
                validator.validateVoiceConnection(),
                validator.validateMusicPlaying(player),
                validator.validateVoiceSameChannel(player),
            ]) {
                const [isValid, embed] = await check;
                if (!isValid) {
                    await this.sendResponse(context, {
                        embeds: [embed],
                        ephemeral: true
                    });
                    return;
                }
            }

            if (time && time > 0) {
                player.seek(time * 1000);
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createSuccessEmbed(`Skipped to ${time} seconds`)]
                });
            } else {
                const musicValidator = new MusicPlayerValidator(this.client, player);
                const [queueValid, queueError] = await musicValidator.validateQueueSize(1);

                if (!queueValid && queueError) {
                    await this.sendResponse(context, {
                        embeds: [queueError],
                        ephemeral: true
                    });
                    return;
                }

                player.stop(1);
                if (player.queue.size === 0) {
                    player.destroy();
                }

                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createSuccessEmbed("Skipped the current song!")]
                });
            }

        } catch (error) {
            this.client.logger.error(`[MUSIC_CLASS] Skip error: ${error}`);
            await this.sendResponse(context, {
                embeds: [this.responseHandler.createErrorEmbed("An error occurred while skipping")],
                ephemeral: true
            });
        }
    };

    /**
     * Pause music playback
     */
    public pause = async (context: CommandContext): Promise<void> => {
        try {
            if (!this.client.config.music.enabled) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("Music is currently disabled")],
                    ephemeral: true
                });
                return;
            }

            const guildId = this.getGuildId(context);
            if (!guildId) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("This command can only be used in a server")],
                    ephemeral: true
                });
                return;
            }

            const player = this.client.manager.get(guildId);
            if (!player) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("No music is currently playing")],
                    ephemeral: true
                });
                return;
            }

            const validator = new VoiceChannelValidator(this.client, context);
            const musicValidator = new MusicPlayerValidator(this.client, player);

            for (const check of [
                validator.validateGuildContext(),
                validator.validateVoiceConnection(),
                validator.validateMusicPlaying(player),
                validator.validateVoiceSameChannel(player),
            ]) {
                const [isValid, embed] = await check;
                if (!isValid) {
                    await this.sendResponse(context, {
                        embeds: [embed],
                        ephemeral: true
                    });
                    return;
                }
            }

            const [pauseValid, pauseError] = await musicValidator.validatePauseState();
            if (!pauseValid && pauseError) {
                await this.sendResponse(context, {
                    embeds: [pauseError],
                    ephemeral: true
                });
                return;
            }

            player.pause(true);
            await this.sendResponse(context, {
                embeds: [this.responseHandler.createSuccessEmbed("Paused the music!")]
            });

        } catch (error) {
            this.client.logger.error(`[MUSIC_CLASS] Pause error: ${error}`);
            await this.sendResponse(context, {
                embeds: [this.responseHandler.createErrorEmbed("An error occurred while pausing music")],
                ephemeral: true
            });
        }
    };

    /**
     * Resume music playback
     */
    public resume = async (context: CommandContext): Promise<void> => {
        try {
            if (!this.client.config.music.enabled) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("Music is currently disabled")],
                    ephemeral: true
                });
                return;
            }

            const guildId = this.getGuildId(context);
            if (!guildId) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("This command can only be used in a server")],
                    ephemeral: true
                });
                return;
            }

            const player = this.client.manager.get(guildId);
            if (!player) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("No music is currently playing")],
                    ephemeral: true
                });
                return;
            }

            const validator = new VoiceChannelValidator(this.client, context);
            const musicValidator = new MusicPlayerValidator(this.client, player);

            for (const check of [
                validator.validateGuildContext(),
                validator.validateVoiceConnection(),
                validator.validateMusicPlaying(player),
                validator.validateVoiceSameChannel(player),
            ]) {
                const [isValid, embed] = await check;
                if (!isValid) {
                    await this.sendResponse(context, {
                        embeds: [embed],
                        ephemeral: true
                    });
                    return;
                }
            }

            const [resumeValid, resumeError] = await musicValidator.validateResumeState();
            if (!resumeValid && resumeError) {
                await this.sendResponse(context, {
                    embeds: [resumeError],
                    ephemeral: true
                });
                return;
            }

            player.pause(false);
            await this.sendResponse(context, {
                embeds: [this.responseHandler.createSuccessEmbed("Resumed the music!")]
            });

        } catch (error) {
            this.client.logger.error(`[MUSIC_CLASS] Resume error: ${error}`);
            await this.sendResponse(context, {
                embeds: [this.responseHandler.createErrorEmbed("An error occurred while resuming music")],
                ephemeral: true
            });
        }
    };

    /**
     * Get queue information
     */
    public queue = async (context: CommandContext): Promise<void> => {
        try {
            if (!this.client.config.music.enabled) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("Music is currently disabled")],
                    ephemeral: true
                });
                return;
            }

            const guildId = this.getGuildId(context);
            if (!guildId) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("This command can only be used in a server")],
                    ephemeral: true
                });
                return;
            }

            const player = this.client.manager.get(guildId);
            if (!player) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("No music is currently playing")],
                    ephemeral: true
                });
                return;
            }

            const validator = new VoiceChannelValidator(this.client, context);
            for (const check of [
                validator.validateGuildContext(),
                validator.validateVoiceConnection(),
                validator.validateMusicPlaying(player),
                validator.validateVoiceSameChannel(player),
            ]) {
                const [isValid, embed] = await check;
                if (!isValid) {
                    await this.sendResponse(context, {
                        embeds: [embed],
                        ephemeral: true
                    });
                    return;
                }
            }

            const embed = new discord.EmbedBuilder()
                .setColor(this.client.config.content.embed.color.info)
                .setTitle("📋 Current Queue")
                .setDescription(
                    `🎶 Now Playing: **${player.queue.current?.title || "Unknown"}**\n` +
                    `Queue Size: **${player.queue.size}** tracks`
                )
                .setFooter({
                    text: `Requested by ${this.getUser(context).tag}`,
                    iconURL: this.getUser(context).displayAvatarURL(),
                })
                .setTimestamp();

            if (player.queue.size > 0) {
                const queueList = player.queue
                    .slice(0, 10)
                    .map((track: any, index: number) =>
                        `**${index + 1}.** ${track.title} - ${track.author}`
                    )
                    .join("\n");

                embed.addFields({
                    name: "Up Next",
                    value: queueList + (player.queue.size > 10 ? `\n*...and ${player.queue.size - 10} more*` : "")
                });
            }

            await this.sendResponse(context, {
                embeds: [embed]
            });

        } catch (error) {
            this.client.logger.error(`[MUSIC_CLASS] Queue error: ${error}`);
            await this.sendResponse(context, {
                embeds: [this.responseHandler.createErrorEmbed("An error occurred while getting queue information")],
                ephemeral: true
            });
        }
    };

    /**
     * Apply audio filter
     */
    public filter = async (context: CommandContext, filterName: string): Promise<void> => {
        try {
            if (!this.client.config.music.enabled) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("Music is currently disabled")],
                    ephemeral: true
                });
                return;
            }

            const guildId = this.getGuildId(context);
            if (!guildId) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("This command can only be used in a server")],
                    ephemeral: true
                });
                return;
            }

            const player = this.client.manager.get(guildId);
            if (!player) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("No music is currently playing")],
                    ephemeral: true
                });
                return;
            }

            const validator = new VoiceChannelValidator(this.client, context);
            for (const check of [
                validator.validateGuildContext(),
                validator.validateVoiceConnection(),
                validator.validateMusicPlaying(player),
                validator.validateVoiceSameChannel(player),
            ]) {
                const [isValid, embed] = await check;
                if (!isValid) {
                    await this.sendResponse(context, {
                        embeds: [embed],
                        ephemeral: true
                    });
                    return;
                }
            }

            if (!player.filters) {
                player.filters = new magmastream.Filters(player);
            }

            let success = false;
            switch (filterName.toLowerCase()) {
                case "clear":
                    await player.filters.clearFilters();
                    success = true;
                    break;
                case "bassboost":
                    await player.filters.bassBoost(2);
                    success = true;
                    break;
                case "nightcore":
                    await player.filters.nightcore(true);
                    success = true;
                    break;
                default:
                    await this.sendResponse(context, {
                        embeds: [this.responseHandler.createErrorEmbed("Invalid filter name")],
                        ephemeral: true
                    });
                    return;
            }

            if (success) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createSuccessEmbed(`Applied ${filterName} filter!`)]
                });
            }

        } catch (error) {
            this.client.logger.error(`[MUSIC_CLASS] Filter error: ${error}`);
            await this.sendResponse(context, {
                embeds: [this.responseHandler.createErrorEmbed("An error occurred while applying filter")],
                ephemeral: true
            });
        }
    };

    /**
     * Set volume
     */
    public volume = async (context: CommandContext, volumeLevel: number): Promise<void> => {
        try {
            if (!this.client.config.music.enabled) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("Music is currently disabled")],
                    ephemeral: true
                });
                return;
            }

            if (volumeLevel < 0 || volumeLevel > 100) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("Volume must be between 0 and 100")],
                    ephemeral: true
                });
                return;
            }

            const guildId = this.getGuildId(context);
            if (!guildId) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("This command can only be used in a server")],
                    ephemeral: true
                });
                return;
            }

            const player = this.client.manager.get(guildId);
            if (!player) {
                await this.sendResponse(context, {
                    embeds: [this.responseHandler.createErrorEmbed("No music is currently playing")],
                    ephemeral: true
                });
                return;
            }

            const validator = new VoiceChannelValidator(this.client, context);
            for (const check of [
                validator.validateGuildContext(),
                validator.validateVoiceConnection(),
                validator.validateMusicPlaying(player),
                validator.validateVoiceSameChannel(player),
            ]) {
                const [isValid, embed] = await check;
                if (!isValid) {
                    await this.sendResponse(context, {
                        embeds: [embed],
                        ephemeral: true
                    });
                    return;
                }
            }

            player.setVolume(volumeLevel);
            await this.sendResponse(context, {
                embeds: [this.responseHandler.createSuccessEmbed(`Set volume to ${volumeLevel}%`)]
            });

        } catch (error) {
            this.client.logger.error(`[MUSIC_CLASS] Volume error: ${error}`);
            await this.sendResponse(context, {
                embeds: [this.responseHandler.createErrorEmbed("An error occurred while setting volume")],
                ephemeral: true
            });
        }
    };
}