import discord from "discord.js";
import { MusicResponseHandler } from "../../../utils/music/embed_template";
import { NowPlayingManager } from "../../../utils/music/now_playing_manager";
import { MusicPlayerValidator } from "../../../utils/music/music_validations";
import { BotEvent } from "../../../types";

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
    private readonly guildId: string | undefined;
    private useEphemeralReplies: boolean = false;

    constructor(
        interaction: discord.ButtonInteraction,
        client: discord.Client
    ) {
        this.interaction = interaction;
        this.client = client;
        this.guildId = interaction.guild?.id;
        client.logger.debug(`[MUSIC_BUTTONS] Guild ID in constructor: ${this.guildId}`);
        this.player = this.guildId ? client.manager.get(this.guildId) : null;
        this.playerValidator = new MusicPlayerValidator(
            client,
            this.player
        );
        this.responseHandler = new MusicResponseHandler(client);
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
            let useEphemeralReplies = false;
            if (this.guildId) {
                try {
                    const music_guild = await (await import("../../../events/database/schema/music_guild")).default;
                    const guildData = await music_guild.findOne({ guildId: this.guildId });
                    if (guildData?.songChannelId === this.interaction.channelId) {
                        useEphemeralReplies = true;
                    }
                } catch (dbError) {
                    this.client.logger.error(`[MUSIC_BUTTONS] Error checking song channel: ${dbError}`);
                }
            }

            if (!this.player) {
                await this.interaction.reply({
                    embeds: [this.responseHandler.createErrorEmbed("No music is currently playing")],
                    flags: useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
                });
                return false;
            }

            const [playerValid, playerError] =
                await this.playerValidator.validatePlayerState();
            if (!playerValid && playerError) {
                await this.interaction.reply({
                    embeds: [playerError],
                    flags: useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
                });
                return false;
            }

            if (!this.interaction.guild) {
                await this.interaction.reply({
                    embeds: [this.responseHandler.createErrorEmbed("This command can only be used in a server")],
                    flags: useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
                });
                return false;
            }

            if (!this.interaction.member) {
                await this.interaction.reply({
                    embeds: [this.responseHandler.createErrorEmbed("Cannot determine your voice channel")],
                    flags: useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
                });
                return false;
            }

            const member = await this.interaction.guild.members.fetch(this.interaction.user.id).catch(() => null);
            if (!member) {
                await this.interaction.reply({
                    embeds: [this.responseHandler.createErrorEmbed("Cannot find your guild member information")],
                    flags: useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
                });
                return false;
            }

            if (!member.voice.channel) {
                await this.interaction.reply({
                    embeds: [this.responseHandler.createErrorEmbed("You need to be in a voice channel")],
                    flags: useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
                });
                return false;
            }

            if (member.voice.channelId !== this.player.voiceChannelId) {
                await this.interaction.reply({
                    embeds: [this.responseHandler.createErrorEmbed("You are not in the same voice channel as the bot")],
                    flags: useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
                });
                return false;
            }

            this.useEphemeralReplies = useEphemeralReplies;
            return true;
        } catch (error) {
            this.client.logger.error(`[MUSIC_BUTTONS] Error in validateCommand: ${error}`);
            await this.interaction.reply({
                embeds: [this.responseHandler.createErrorEmbed("An unexpected error occurred")],
                flags: discord.MessageFlags.Ephemeral
            }).catch(() => {
                this.client.logger.error(`[MUSIC_BUTTONS] Failed to send error response`);
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
                    embeds: [stateError],
                    flags: this.useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
                });
                return;
            }

            this.player.pause(true);

            if (this.nowPlayingManager) {
                this.nowPlayingManager.onPause();
            }

            await this.interaction.reply({
                embeds: [
                    this.responseHandler.createSuccessEmbed("Paused the music!"),
                ],
                flags: this.useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
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
                    embeds: [stateError],
                    flags: this.useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
                });
                return;
            }

            this.player.pause(false);

            if (this.nowPlayingManager) {
                this.nowPlayingManager.onResume();
            }

            await this.interaction.reply({
                embeds: [
                    this.responseHandler.createSuccessEmbed("Resumed the music!"),
                ],
                flags: this.useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
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
                    embeds: [queueError],
                    flags: this.useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
                });
                return;
            }

            this.player.stop(1);

            if (this.player.queue.size === 0 && this.guildId) {
                this.player.destroy();
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
                ],
                flags: this.useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
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
                    ],
                    flags: this.useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
                });
                return;
            }

            if (!(await this.validateCommand())) return;
            this.player.destroy();

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
                ],
                flags: this.useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
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
                    ],
                    flags: this.useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
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
                ],
                flags: this.useEphemeralReplies ? discord.MessageFlags.Ephemeral : undefined
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

const event: BotEvent = {
    name: discord.Events.InteractionCreate,
    execute: async (
        interaction: discord.Interaction,
        client
    ): Promise<void> => {
        if (!interaction.isButton()) return;

        const musicButtonIds = ["pause-music", "resume-music", "skip-music", "stop-music", "loop-music"];
        if (!musicButtonIds.includes(interaction.customId)) return;

        client.logger.debug(`[MUSIC_BUTTONS] Processing button: ${interaction.customId}`);
        client.logger.debug(`[MUSIC_BUTTONS] Interaction has guild: ${!!interaction.guild}`);

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
            client.logger.error(`[MUSIC_BUTTONS] Error handling button ${interaction.customId}: ${error}`);

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