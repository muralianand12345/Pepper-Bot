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

    constructor(
        interaction: discord.ButtonInteraction,
        client: discord.Client
    ) {
        this.interaction = interaction;
        this.client = client;
        this.player = client.manager.get(interaction.guild!.id);
        this.playerValidator = new MusicPlayerValidator(
            client,
            this.player
        );
        this.responseHandler = new MusicResponseHandler(client);

        // Get the now playing manager if player exists
        this.nowPlayingManager = this.player
            ? NowPlayingManager.getInstance(interaction.guild!.id, this.player, client)
            : null;
    }

    /**
     * Validates common conditions for music commands
     * @returns {Promise<boolean>} Whether all validations passed
     */
    private async validateCommand(): Promise<boolean> {
        // Check if player exists and is playing
        const [playerValid, playerError] =
            await this.playerValidator.validatePlayerState();
        if (!playerValid && playerError) {
            await this.interaction.reply({
                embeds: [playerError]
            });
            return false;
        }

        // Create voice validator instance
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

        return true;
    }

    /**
     * Handles pause button interaction
     */
    public async handlePause(): Promise<void> {
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
    }

    /**
     * Handles resume button interaction
     */
    public async handleResume(): Promise<void> {
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
    }

    /**
     * Handles skip button interaction
     */
    public async handleSkip(): Promise<void> {
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
        if (this.player.queue.size === 0) {
            this.player.destroy();

            // Clean up the now playing manager when player is destroyed
            NowPlayingManager.removeInstance(this.interaction.guild!.id);
        }

        await this.interaction.reply({
            embeds: [
                this.responseHandler.createSuccessEmbed(
                    "Skipped the current song!"
                ),
            ]
        });
    }

    /**
     * Handles stop button interaction
     */
    public async handleStop(): Promise<void> {
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

        this.player.destroy();

        // Clean up the now playing manager when player is destroyed
        NowPlayingManager.removeInstance(this.interaction.guild!.id);

        await this.interaction.reply({
            embeds: [
                this.responseHandler.createSuccessEmbed("Stopped the music!"),
            ]
        });
    }

    /**
     * Handles loop button interaction
     */
    public async handleLoop(): Promise<void> {
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
    },
};

export default event;