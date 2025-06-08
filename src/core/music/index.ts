import discord from "discord.js";
import magmastream from "magmastream";

import { MusicResponseHandler, VoiceChannelValidator, MusicPlayerValidator, Autoplay } from "./handlers";

export * from "./func";
export * from "./repo";
export * from "./handlers";
export * from "./auto_search";
export * from "./now_playing";


export const MUSIC_CONFIG = {
    ERROR_SEARCH_TEXT: "Unable To Fetch Results",
    DEFAULT_SEARCH_TEXT: "Please enter a song name or url",
    PLAYER_OPTIONS: {
        volume: 50,
        selfDeafen: true,
    },
};

export class Music {
    private client: discord.Client;
    private interaction: discord.ChatInputCommandInteraction | discord.ButtonInteraction;

    constructor(client: discord.Client, interaction: discord.ChatInputCommandInteraction | discord.ButtonInteraction) {
        this.client = client;
        this.interaction = interaction;
    };

    private validateMusicEnabled = (): discord.EmbedBuilder | null => {
        if (this.client.config.music.enabled) return null;
        return new MusicResponseHandler(this.client).createErrorEmbed("Music is currently disabled.");
    };

    private validateLavalinkNode = async (nodeChoice: string | undefined): Promise<discord.EmbedBuilder | null> => {
        if (!nodeChoice) return null;
        if (this.client.manager.get(this.interaction.guild?.id || "")) return new MusicResponseHandler(this.client).createErrorEmbed("Hmmm, you have an active music player in this server. Please stop the current player before switching Lavalink nodes.");
        const node = this.client.manager.nodes.find((n: magmastream.Node) => n.options.identifier === nodeChoice);
        if (!node) return new MusicResponseHandler(this.client).createErrorEmbed("Invalid Lavalink node");
        if (!node.connected) return new MusicResponseHandler(this.client).createErrorEmbed("Lavalink node is not connected");
        return null;
    };

    searchResults = async (res: magmastream.SearchResult, player: magmastream.Player): Promise<void> => {
        switch (res.loadType) {
            case "empty": {
                if (!player.queue.current) player.destroy();
                await this.interaction.editReply({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed(MUSIC_CONFIG.ERROR_SEARCH_TEXT)] });
                break;
            };
            case "track":
            case "search": {
                const track = res.tracks[0];
                player.queue.add(track);
                if (!player.playing && !player.paused && !player.queue.size) player.play();
                await this.interaction.editReply({ embeds: [new MusicResponseHandler(this.client).createTrackEmbed(track, player.queue.size)] });
                break;
            };
            case "playlist": {
                if (!res.playlist) break;
                res.playlist.tracks.forEach((track: magmastream.Track) => player.queue.add(track));
                if (!player.playing && !player.paused && player.queue.totalSize === res.playlist.tracks.length) player.play();
                await this.interaction.editReply({ embeds: [new MusicResponseHandler(this.client).createPlaylistEmbed(res.playlist, this.interaction.user)], components: [new MusicResponseHandler(this.client).getMusicButton()] });
                break;
            };
        };
    };

    play = async (): Promise<discord.InteractionResponse<boolean> | void> => {
        if (!(this.interaction instanceof discord.ChatInputCommandInteraction)) return;

        const musicCheck = this.validateMusicEnabled();
        if (musicCheck) return await this.interaction.reply({ embeds: [musicCheck], flags: discord.MessageFlags.Ephemeral });

        const query = this.interaction.options.getString("song") || MUSIC_CONFIG.DEFAULT_SEARCH_TEXT;
        const nodeChoice = this.interaction.options.getString("lavalink_node") || undefined;

        const nodeCheck = await this.validateLavalinkNode(nodeChoice);
        if (nodeCheck) return await this.interaction.reply({ embeds: [nodeCheck], flags: discord.MessageFlags.Ephemeral });

        const validator = new VoiceChannelValidator(this.client, this.interaction);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) return await this.interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
        }

        const guildMember = this.interaction.guild?.members.cache.get(this.interaction.user.id);
        const player = this.client.manager.create({
            guildId: this.interaction.guildId || "",
            voiceChannelId: guildMember?.voice.channelId || "",
            textChannelId: this.interaction.channelId,
            node: nodeChoice,
            ...MUSIC_CONFIG.PLAYER_OPTIONS,
        });

        const [playerValid, playerEmbed] = await validator.validatePlayerConnection(player);
        if (!playerValid) return await this.interaction.reply({ embeds: [playerEmbed], flags: discord.MessageFlags.Ephemeral });

        const musicValidator = new MusicPlayerValidator(this.client, player);
        const [queueValid, queueError] = await musicValidator.validateMusicSource(query);
        if (!queueValid && queueError) return this.interaction.reply({ embeds: [queueError] });

        await this.interaction.deferReply();

        if (!["CONNECTING", "CONNECTED"].includes(player.state)) {
            player.connect();
            await this.interaction.editReply({ embeds: [new MusicResponseHandler(this.client).createSuccessEmbed(`Connected to ${guildMember?.voice.channel?.name}`)] });
        }

        try {
            const res = await this.client.manager.search(query, this.interaction.user);
            if (res.loadType === "error") throw new Error("No results found | loadType: error");
            await this.searchResults(res, player);
        } catch (error) {
            this.client.logger.error(`[MUSIC] Play error: ${error}`);
            await this.interaction.followUp({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("An error occurred while processing the song", true)], components: [new MusicResponseHandler(this.client).getSupportButton()], flags: discord.MessageFlags.Ephemeral });
        }
    };

    stop = async (): Promise<discord.InteractionResponse<boolean> | void> => {
        const musicCheck = this.validateMusicEnabled();
        if (musicCheck) return await this.interaction.reply({ embeds: [musicCheck], flags: discord.MessageFlags.Ephemeral });

        const player = this.client.manager.get(this.interaction.guild?.id || "");
        if (!player) return await this.interaction.reply({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("No music is currently playing")], flags: discord.MessageFlags.Ephemeral });

        const validator = new VoiceChannelValidator(this.client, this.interaction);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) return await this.interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
        };

        try {
            player.destroy();
            await this.interaction.reply({ embeds: [new MusicResponseHandler(this.client).createSuccessEmbed("Music player stopped and disconnected from the voice channel")], components: [new MusicResponseHandler(this.client).getMusicButton(true)] });
        } catch (error) {
            this.client.logger.error(`[MUSIC] Stop error: ${error}`);
            await this.interaction.followUp({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("An error occurred while stopping song", true)], components: [new MusicResponseHandler(this.client).getSupportButton()], flags: discord.MessageFlags.Ephemeral });
        }
    };

    pause = async (): Promise<discord.InteractionResponse<boolean> | void> => {
        const musicCheck = this.validateMusicEnabled();
        if (musicCheck) return await this.interaction.reply({ embeds: [musicCheck], flags: discord.MessageFlags.Ephemeral });

        const player = this.client.manager.get(this.interaction.guild?.id || "");
        if (!player) return await this.interaction.reply({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("No music is currently playing")], flags: discord.MessageFlags.Ephemeral });

        const validator = new VoiceChannelValidator(this.client, this.interaction);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) return await this.interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
        };

        const musicValidator = new MusicPlayerValidator(this.client, player);
        const [isValid, errorEmbed] = await musicValidator.validatePauseState();
        if (!isValid && errorEmbed) return await this.interaction.reply({ embeds: [errorEmbed], flags: discord.MessageFlags.Ephemeral });

        try {
            player.pause(true);
            await this.interaction.reply({ embeds: [new MusicResponseHandler(this.client).createSuccessEmbed("Paused the music!")], components: [new MusicResponseHandler(this.client).getMusicButton()] });
        } catch (error) {
            this.client.logger.error(`[MUSIC] Pause error: ${error}`);
            await this.interaction.followUp({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("An error occurred while pausing the song", true)], components: [new MusicResponseHandler(this.client).getSupportButton()], flags: discord.MessageFlags.Ephemeral });
        }
    };

    resume = async (): Promise<discord.InteractionResponse<boolean> | void> => {
        const musicCheck = this.validateMusicEnabled();
        if (musicCheck) return await this.interaction.reply({ embeds: [musicCheck], flags: discord.MessageFlags.Ephemeral });

        const player = this.client.manager.get(this.interaction.guild?.id || "");
        if (!player) return await this.interaction.reply({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("No music is currently playing")], flags: discord.MessageFlags.Ephemeral });

        const validator = new VoiceChannelValidator(this.client, this.interaction);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) return await this.interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
        };

        const musicValidator = new MusicPlayerValidator(this.client, player);
        const [isValid, errorEmbed] = await musicValidator.validateResumeState();
        if (!isValid && errorEmbed) return await this.interaction.reply({ embeds: [errorEmbed], flags: discord.MessageFlags.Ephemeral });

        try {
            player.pause(false);
            await this.interaction.reply({ embeds: [new MusicResponseHandler(this.client).createSuccessEmbed("Resumed the music!")], components: [new MusicResponseHandler(this.client).getMusicButton()] });
        } catch (error) {
            this.client.logger.error(`[MUSIC] Resume error: ${error}`);
            await this.interaction.followUp({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("An error occurred while resuming the song", true)], components: [new MusicResponseHandler(this.client).getSupportButton()], flags: discord.MessageFlags.Ephemeral });
        }
    };

    skip = async (): Promise<discord.InteractionResponse<boolean> | void> => {
        const musicCheck = this.validateMusicEnabled();
        if (musicCheck) return await this.interaction.reply({ embeds: [musicCheck], flags: discord.MessageFlags.Ephemeral });

        const player = this.client.manager.get(this.interaction.guild?.id || "");
        if (!player) return await this.interaction.reply({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("No music is currently playing")], flags: discord.MessageFlags.Ephemeral });

        const validator = new VoiceChannelValidator(this.client, this.interaction);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) return await this.interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
        };

        const musicValidator = new MusicPlayerValidator(this.client, player);
        const [isValid, errorEmbed] = await musicValidator.validateQueueSize(1);
        if (!isValid && errorEmbed) return await this.interaction.reply({ embeds: [errorEmbed], flags: discord.MessageFlags.Ephemeral });

        try {
            player.stop(1);
            if (player.queue.size === 0 && this.interaction.guildId) player.destroy();
            await this.interaction.reply({ embeds: [new MusicResponseHandler(this.client).createSuccessEmbed("Skipped the current song!")], components: [new MusicResponseHandler(this.client).getMusicButton()] });
        } catch (error) {
            this.client.logger.error(`[MUSIC] Skip error: ${error}`);
            await this.interaction.followUp({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("An error occurred while skipping the song", true)], components: [new MusicResponseHandler(this.client).getSupportButton()], flags: discord.MessageFlags.Ephemeral });
        }
    };

    loop = async (): Promise<discord.InteractionResponse<boolean> | void> => {
        const musicCheck = this.validateMusicEnabled();
        if (musicCheck) return await this.interaction.reply({ embeds: [musicCheck], flags: discord.MessageFlags.Ephemeral });

        const player = this.client.manager.get(this.interaction.guild?.id || "");
        if (!player) return await this.interaction.reply({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("No music is currently playing")], flags: discord.MessageFlags.Ephemeral });

        const validator = new VoiceChannelValidator(this.client, this.interaction);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) return await this.interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
        };

        try {
            player.setTrackRepeat(!player.trackRepeat);
            await this.interaction.reply({ embeds: [new MusicResponseHandler(this.client).createSuccessEmbed(`Looping is now ${player.trackRepeat ? "enabled" : "disabled"}`)], components: [new MusicResponseHandler(this.client).getMusicButton()] });
        } catch (error) {
            this.client.logger.error(`[MUSIC] Loop error: ${error}`);
            await this.interaction.followUp({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("An error occurred while toggling loop", true)], components: [new MusicResponseHandler(this.client).getSupportButton()], flags: discord.MessageFlags.Ephemeral });
        }
    };

    autoplay = async (enable: boolean): Promise<discord.InteractionResponse<boolean> | void> => {
        const musicCheck = this.validateMusicEnabled();
        if (musicCheck) return await this.interaction.reply({ embeds: [musicCheck], flags: discord.MessageFlags.Ephemeral });

        const player = this.client.manager.get(this.interaction.guild?.id || "");
        if (!player) return await this.interaction.reply({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("No music is currently playing")], flags: discord.MessageFlags.Ephemeral });

        const validator = new VoiceChannelValidator(this.client, this.interaction);
        for (const check of [
            validator.validateGuildContext(),
            validator.validateVoiceConnection(),
            validator.validateMusicPlaying(player),
            validator.validateVoiceSameChannel(player),
        ]) {
            const [isValid, embed] = await check;
            if (!isValid) return await this.interaction.reply({ embeds: [embed], flags: discord.MessageFlags.Ephemeral });
        };

        await this.interaction.deferReply();

        try {

            const autoplayManager = Autoplay.getInstance(player.guildId, player, this.client);
            if (enable) {
                autoplayManager.enable(this.interaction.user.id);
                const embed = new MusicResponseHandler(this.client).createSuccessEmbed("🎵 Smart Autoplay is now **enabled**\n\n" + "When the queue is empty, I'll automatically add songs based on your music preferences.");
                await this.interaction.editReply({ embeds: [embed] });
            } else {
                autoplayManager.disable();
                const embed = new MusicResponseHandler(this.client).createInfoEmbed("⏹️ Autoplay is now **disabled**\n\n" + "Playback will stop when the queue is empty.");
                await this.interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            this.client.logger.error(`[AUTOPLAY] Command error: ${error}`);
            await this.interaction.editReply({ embeds: [new MusicResponseHandler(this.client).createErrorEmbed("An error occurred while toggling autoplay.", true)], components: [new MusicResponseHandler(this.client).getSupportButton()] });
        }
    };
};