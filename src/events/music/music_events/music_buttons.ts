import discord from "discord.js";
import { BotEvent } from "../../../types";
import {
    MusicPlayerValidator,
    VoiceChannelValidator,
} from "../../../utils/music/music_validations";
import { MusicResponseHandler } from "../../../utils/music/embed_template";
import { NowPlayingManager } from "../../../utils/music/now_playing_manager";

/**
 * Handles music commands through button interactions
 * @class MusicButtonHandler
 */
class MusicButtonHandler {
    private readonly interaction: discord.ButtonInteraction;
    private readonly client: discord.Client;
    private readonly player: any;
    private readonly playerValidator: MusicPlayerValidator;
    private readonly responseHandler: MusicResponseHandler;
    private readonly nowPlayingManager: NowPlayingManager | null;
    private readonly guildId: string | undefined; // Store guild ID for reuse

    constructor(
        interaction: discord.ButtonInteraction,
        client: discord.Client
    ) {
        this.interaction = interaction;
        this.client = client;
        this.guildId = interaction.guild?.id;

        // Debug the guild ID
        client.logger.debug(`[MUSIC_BUTTONS] Guild ID in constructor: ${this.guildId}`);

        // Only try to get player if we have a guild ID
        this.player = this.guildId ? client.manager.get(this.guildId) : null;

        this.playerValidator = new MusicPlayerValidator(
            client,
            this.player
        );
        this.responseHandler = new MusicResponseHandler(client);

        // Only create NowPlayingManager if needed
        this.nowPlayingManager = null;
        try {
            if (this.player && this.guildId) {
                this.nowPlayingManager = NowPlayingManager.getInstance(this.guildId, this.player, client);
            }
        } catch (error) {
            client.logger.error(`[MUSIC_BUTTONS] Error creating NowPlayingManager: ${error}`);
        }
    }

    /**
     * Validates common conditions for music commands
     * @returns {Promise<boolean>} Whether all validations passed
     */
    private async validateCommand(): Promise<boolean> {
        try {
            // First check if we have a valid player
            if (!this.player) {
                await this.interaction.reply({
                    embeds: [this.responseHandler.createErrorEmbed("No music is currently playing")]
                });
                return false;
            }

            // Check if player exists and is playing
            const [playerValid, playerError] =
                await this.playerValidator.validatePlayerState();
            if (!playerValid && playerError) {
                await this.interaction.reply({
                    embeds: [playerError]
                });
                return false;
            }

            // Check if we have a valid guild context
            if (!this.interaction.guild) {
                await this.interaction.reply({
                    embeds: [this.responseHandler.createErrorEmbed("This command can only be used in a server")]
                });
                return false;
            }

            // Use a safer approach for voice validator
            try {
                // Create voice validator instance with proper type assertion
                const voiceValidator = new VoiceChannelValidator(
                    this.client,
                    this.interaction as unknown as discord.ChatInputCommandInteraction
                );

                // Validate voice connection
                const [voiceValid, voiceError] =
                    await voiceValidator.validateVoiceConnection();
                if (!voiceValid) {
                    await this.interaction.reply({
                        embeds: [voiceError]
                    });
                    return false;
                }

                // Validate same channel
                const [sameChannelValid, sameChannelError] =
                    await voiceValidator.validateVoiceSameChannel(this.player);
                if (!sameChannelValid) {
                    await this.interaction.reply({
                        embeds: [sameChannelError]
                    });
                    return false;
                }
            } catch (validationError) {
                this.client.logger.error(`[MUSIC_BUTTONS] Validation error: ${validationError}`);
                await this.interaction.reply({
                    embeds: [this.responseHandler.createErrorEmbed("An error occurred while validating your command")]
                });
                return false;
            }

            return true;
        } catch (error) {
            this.client.logger.error(`[MUSIC_BUTTONS] Error in validateCommand: ${error}`);
            await this.interaction.reply({
                embeds: [this.responseHandler.createErrorEmbed("An unexpected error occurred")]
            });
            return false;
        }
    }

    /**
     * Handles pause button interaction
     */
    public async handlePause(): Promise<void> {
        try {
            if (!(await this.validateCommand())) return;

            const [stateValid, stateError] =
                await this.playerValidator.validatePauseState();
            if (!stateValid && stateError) {
                await this.interaction.reply({
                    embeds: [stateError]
                });
                return;
            }

            this.player.pause(true);

            // Update now playing manager with pause state
            if (this.nowPlayingManager) {
                this.nowPlayingManager.onPause();
            }

            await this.interaction.reply({
                embeds: [
                    this.responseHandler.createSuccessEmbed("Paused the music!"),
                ]
            });
        } catch (error) {
            this.client.logger.error(`[MUSIC_BUTTONS] Error in handlePause: ${error}`);
            await this.safeReply(this.responseHandler.createErrorEmbed("An error occurred while pausing the music"));
        }
    }

    /**
     * Handles resume button interaction
     */
    public async handleResume(): Promise<void> {
        try {
            if (!(await this.validateCommand())) return;

            const [stateValid, stateError] =
                await this.playerValidator.validateResumeState();
            if (!stateValid && stateError) {
                await this.interaction.reply({
                    embeds: [stateError]
                });
                return;
            }

            this.player.pause(false);

            // Update now playing manager with resume state
            if (this.nowPlayingManager) {
                this.nowPlayingManager.onResume();
            }

            await this.interaction.reply({
                embeds: [
                    this.responseHandler.createSuccessEmbed("Resumed the music!"),
                ]
            });
        } catch (error) {
            this.client.logger.error(`[MUSIC_BUTTONS] Error in handleResume: ${error}`);
            await this.safeReply(this.responseHandler.createErrorEmbed("An error occurred while resuming the music"));
        }
    }

    /**
     * Handles skip button interaction
     */
    public async handleSkip(): Promise<void> {
        try {
            if (!(await this.validateCommand())) return;

            const [queueValid, queueError] =
                await this.playerValidator.validateQueueSize(1);
            if (!queueValid && queueError) {
                await this.interaction.reply({
                    embeds: [queueError]
                });
                return;
            }

            this.player.stop(1);

            // Use the stored guild ID to avoid accessing undefined
            if (this.player.queue.size === 0 && this.guildId) {
                this.player.destroy();

                // Clean up the now playing manager when player is destroyed
                try {
                    NowPlayingManager.removeInstance(this.guildId);
                } catch (cleanupError) {
                    this.client.logger.error(`[MUSIC_BUTTONS] Error cleaning up NowPlayingManager: ${cleanupError}`);
                }
            }

            await this.interaction.reply({
                embeds: [
                    this.responseHandler.createSuccessEmbed(
                        "Skipped the current song!"
                    ),
                ]
            });
        } catch (error) {
            this.client.logger.error(`[MUSIC_BUTTONS] Error in handleSkip: ${error}`);
            await this.safeReply(this.responseHandler.createErrorEmbed("An error occurred while skipping the song"));
        }
    }

    /**
     * Handles stop button interaction
     */
    public async handleStop(): Promise<void> {
        try {
            if (!this.player) {
                await this.interaction.reply({
                    embeds: [
                        this.responseHandler.createErrorEmbed(
                            "There is no music playing"
                        ),
                    ]
                });
                return;
            }

            if (!(await this.validateCommand())) return;

            // Use the stored guild ID to avoid accessing undefined
            this.player.destroy();

            // Clean up the now playing manager when player is destroyed
            if (this.guildId) {
                try {
                    NowPlayingManager.removeInstance(this.guildId);
                } catch (cleanupError) {
                    this.client.logger.error(`[MUSIC_BUTTONS] Error cleaning up NowPlayingManager: ${cleanupError}`);
                }
            }

            await this.interaction.reply({
                embeds: [
                    this.responseHandler.createSuccessEmbed("Stopped the music!"),
                ]
            });
        } catch (error) {
            this.client.logger.error(`[MUSIC_BUTTONS] Error in handleStop: ${error}`);
            await this.safeReply(this.responseHandler.createErrorEmbed("An error occurred while stopping the music"));
        }
    }

    /**
     * Handles loop button interaction
     */
    public async handleLoop(): Promise<void> {
        try {
            if (!this.player) {
                await this.interaction.reply({
                    embeds: [
                        this.responseHandler.createErrorEmbed(
                            "There is no music playing"
                        ),
                    ]
                });
                return;
            }

            if (!(await this.validateCommand())) return;

            this.player.setTrackRepeat(!this.player.trackRepeat);
            await this.interaction.reply({
                embeds: [
                    this.responseHandler.createSuccessEmbed(
                        `Loop mode is now ${this.player.trackRepeat ? "enabled" : "disabled"
                        }!`
                    ),
                ]
            });
        } catch (error) {
            this.client.logger.error(`[MUSIC_BUTTONS] Error in handleLoop: ${error}`);
            await this.safeReply(this.responseHandler.createErrorEmbed("An error occurred while toggling loop mode"));
        }
    }

    /**
     * Safely reply to an interaction, handling errors
     */
    private async safeReply(embed: discord.EmbedBuilder): Promise<void> {
        try {
            if (!this.interaction.replied && !this.interaction.deferred) {
                await this.interaction.reply({
                    embeds: [embed],
                    flags: discord.MessageFlags.Ephemeral,
                });
            }
        } catch (replyError) {
            this.client.logger.error(`[MUSIC_BUTTONS] Failed to send error response: ${replyError}`);
        }
    }
}

/**
 * Main event handler for button interactions related to music controls
 * @type {BotEvent}
 */
const event: BotEvent = {
    name: discord.Events.InteractionCreate,
    execute: async (
        interaction: discord.Interaction,
        client
    ): Promise<void> => {
        if (!interaction.isButton()) return;

        // Filter music button interactions
        const musicButtonIds = ["pause-music", "resume-music", "skip-music", "stop-music", "loop-music"];
        if (!musicButtonIds.includes(interaction.customId)) return;

        // Log more detailed information
        client.logger.debug(`[MUSIC_BUTTONS] Processing button: ${interaction.customId}`);
        client.logger.debug(`[MUSIC_BUTTONS] Interaction has guild: ${!!interaction.guild}`);

        // Skip music button interactions if they don't have a guild context
        if (!interaction.guild) {
            client.logger.warn(`[MUSIC_BUTTONS] Button interaction without guild context: ${interaction.customId}`);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: "This button can only be used in a server.",
                        flags: discord.MessageFlags.Ephemeral,
                    });
                }
            } catch (error) {
                client.logger.error(`[MUSIC_BUTTONS] Error replying to guildless interaction: ${error}`);
            }
            return;
        }

        try {
            const handler = new MusicButtonHandler(interaction, client);

            const commands = {
                "pause-music": () => handler.handlePause(),
                "resume-music": () => handler.handleResume(),
                "skip-music": () => handler.handleSkip(),
                "stop-music": () => handler.handleStop(),
                "loop-music": () => handler.handleLoop(),
            };

            const command = commands[interaction.customId as keyof typeof commands];
            if (command) {
                await command();
            }
        } catch (error) {
            // Add error handling
            client.logger.error(`[MUSIC_BUTTONS] Error handling button ${interaction.customId}: ${error}`);

            // Try to respond to the user if possible
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        embeds: [new MusicResponseHandler(client).createErrorEmbed(
                            "An error occurred while processing this button action", true
                        )],
                        flags: discord.MessageFlags.Ephemeral,
                    });
                }
            } catch (replyError) {
                client.logger.error(`[MUSIC_BUTTONS] Failed to send error response: ${replyError}`);
            }
        }
    },
};

export default event;