import WebSocket from 'ws';
import http from 'http';
import discord from 'discord.js';
import { ILogger, WebSocketMessage } from '../../../../types';
import PlaylistSuggestion from '../../../../utils/music/playlist_suggestion';

/**
 * Supported WebSocket message types
 */
enum MessageType {
    PLAY = 'play',
    PAUSE = 'pause',
    RESUME = 'resume',
    STOP = 'stop',
    SKIP = 'skip',
    VOLUME = 'volume',
    QUEUE = 'queue',
    RECOMMEND = 'recommend',
    AUTH = 'auth'
}

/**
 * Manages WebSocket connections for music control
 */
class WebSocketManager {
    private static instance: WebSocketManager;
    private wss: WebSocket.Server | null = null;
    private readonly client: discord.Client;
    private readonly logger: ILogger;
    private readonly authenticatedClients: Set<WebSocket> = new Set();
    private readonly clientGuilds: Map<WebSocket, Set<string>> = new Map();
    private readonly apiKey: string;

    /**
     * Initialize WebSocket manager
     * @param client - Discord client
     * @param server - HTTP server instance
     * @param logger - Logger instance
     */
    private constructor(client: discord.Client, server: http.Server, logger: ILogger) {
        this.client = client;
        this.logger = logger;
        this.apiKey = client.config?.api?.auth?.apiKey || '';

        this.initializeWebSocketServer(server);
    }

    /**
     * Get singleton instance
     * @param client - Discord client
     * @param server - HTTP server instance 
     * @param logger - Logger instance
     * @returns WebSocketManager instance
     */
    public static getInstance(client: discord.Client, server: http.Server, logger: ILogger): WebSocketManager {
        if (!WebSocketManager.instance) {
            WebSocketManager.instance = new WebSocketManager(client, server, logger);
        }

        return WebSocketManager.instance;
    }

    /**
     * Initialize WebSocket server
     * @param server - HTTP server instance
     * @private
     */
    private initializeWebSocketServer(server: http.Server): void {
        try {
            this.wss = new WebSocket.Server({
                server,
                path: '/api/v1/music/ws'
            });

            this.wss.on('connection', this.handleConnection.bind(this));
            this.wss.on('error', (error) => {
                this.logger.error(`[WEBSOCKET] Server error: ${error.message}`);
            });

            this.logger.info('[WEBSOCKET] WebSocket server initialized on path /api/v1/music/ws');
        } catch (error) {
            this.logger.error(`[WEBSOCKET] Failed to initialize WebSocket server: ${error}`);
        }
    }

    /**
     * Handle new WebSocket connection
     * @param ws - WebSocket connection
     * @private
     */
    private handleConnection(ws: WebSocket): void {
        this.logger.info('[WEBSOCKET] New connection established');

        // Set up initial state
        this.clientGuilds.set(ws, new Set());

        // Setup message handler
        ws.on('message', async (message) => {
            try {
                const parsedMessage = JSON.parse(message.toString()) as WebSocketMessage;
                await this.handleMessage(ws, parsedMessage);
            } catch (error) {
                this.sendError(ws, 'Invalid message format');
            }
        });

        // Setup close handler
        ws.on('close', () => {
            this.logger.info('[WEBSOCKET] Connection closed');
            this.authenticatedClients.delete(ws);
            this.clientGuilds.delete(ws);
        });

        // Setup error handler
        ws.on('error', (error) => {
            this.logger.error(`[WEBSOCKET] Connection error: ${error.message}`);
        });

        // Send welcome message
        this.sendMessage(ws, 'system', { message: 'Connected to Pepper Music WebSocket. Please authenticate with type: "auth", data: { apiKey: "your-api-key" }' });
    }

    /**
     * Handle incoming WebSocket message
     * @param ws - WebSocket connection
     * @param message - Parsed message
     * @private
     */
    private async handleMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
        // Authentication required for all messages except AUTH
        if (message.type !== MessageType.AUTH && !this.authenticatedClients.has(ws)) {
            return this.sendError(ws, 'Not authenticated', 401);
        }

        // Handle message based on type
        switch (message.type) {
            case MessageType.AUTH:
                this.handleAuth(ws, message);
                break;

            case MessageType.PLAY:
                await this.handlePlay(ws, message);
                break;

            case MessageType.PAUSE:
                this.handlePause(ws, message);
                break;

            case MessageType.RESUME:
                this.handleResume(ws, message);
                break;

            case MessageType.STOP:
                this.handleStop(ws, message);
                break;

            case MessageType.SKIP:
                this.handleSkip(ws, message);
                break;

            case MessageType.VOLUME:
                this.handleVolume(ws, message);
                break;

            case MessageType.QUEUE:
                this.handleQueue(ws, message);
                break;

            case MessageType.RECOMMEND:
                await this.handleRecommend(ws, message);
                break;

            default:
                this.sendError(ws, `Unknown message type: ${message.type}`);
        }
    }

    /**
     * Handle authentication message
     * @param ws - WebSocket connection
     * @param message - Message with authentication data
     * @private
     */
    private handleAuth(ws: WebSocket, message: WebSocketMessage): void {
        const providedKey = message.data.apiKey;

        if (!this.apiKey) {
            this.logger.warn('[WEBSOCKET] API key not configured but authentication attempted');
            return this.sendError(ws, 'Authentication is misconfigured on the server', 500);
        }

        if (!providedKey) {
            return this.sendError(ws, 'API key is required', 401);
        }

        if (providedKey !== this.apiKey) {
            return this.sendError(ws, 'Invalid API key', 401);
        }

        // Mark client as authenticated
        this.authenticatedClients.add(ws);
        this.sendMessage(ws, 'auth_success', { message: 'Successfully authenticated' });
    }

    /**
     * Handle play message
     * @param ws - WebSocket connection
     * @param message - Message with play data
     * @private
     */
    private async handlePlay(ws: WebSocket, message: WebSocketMessage): Promise<void> {
        const { guildId, query, userId } = message.data;

        if (!guildId) {
            return this.sendError(ws, 'guildId is required');
        }

        if (!query) {
            return this.sendError(ws, 'query is required');
        }

        if (!userId) {
            return this.sendError(ws, 'userId is required');  // Make userId required
        }

        try {
            // Save guild association
            const guildSet = this.clientGuilds.get(ws);
            if (guildSet) {
                guildSet.add(guildId);
            }

            // Get guild instance
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                return this.sendError(ws, `Guild not found: ${guildId}`, 404);
            }

            // Find active voice channel if no player exists
            let player = this.client.manager.get(guildId);

            // Load the music guild data to check for songChannelId
            const MusicDB = require('../../../../utils/music/music_db').default;

            // Get songChannelId from database
            const textChannelId = await MusicDB.getSongTextChannelId(this.client, guildId, userId);

            if (!textChannelId) {
                return this.sendError(ws, 'Could not find a suitable text channel');
            }

            // If player exists but is not connected, destroy it
            if (player && !player.voiceChannelId) {
                player = undefined; // Use undefined instead of null
            }

            // Create new player if needed
            if (!player) {
                // Find a voice channel with members
                let voiceChannelId;

                try {
                    const member = guild.members.cache.get(userId) ||
                        await guild.members.fetch(userId);

                    if (member.voice.channel) {
                        voiceChannelId = member.voice.channel.id;
                    } else {
                        // If user is not in a voice channel, find any active voice channel
                        const voiceChannels = guild.channels.cache.filter(
                            channel => (channel.type === discord.ChannelType.GuildVoice ||
                                channel.type === discord.ChannelType.GuildStageVoice) &&
                                channel.members.size > 0
                        );

                        if (voiceChannels.size === 0) {
                            return this.sendError(ws, 'No active voice channels found and user is not in a voice channel');
                        }

                        voiceChannelId = voiceChannels.first()?.id;
                    }
                } catch (error) {
                    return this.sendError(ws, `Could not find a suitable voice channel: ${error}`);
                }

                if (!voiceChannelId) {
                    return this.sendError(ws, 'Could not find a suitable voice channel');
                }

                // Create player with the determined textChannelId
                player = this.client.manager.create({
                    guildId: guild.id,
                    voiceChannelId: voiceChannelId,
                    textChannelId: textChannelId,
                    selfDeafen: true,
                    volume: 50,
                });

                // Connect to voice channel
                player.connect();
            }

            // Get user as requester
            let requester: discord.User | discord.ClientUser | undefined;
            try {
                requester = await this.client.users.fetch(userId);
            } catch (error) {
                requester = this.client.user || undefined;
            }

            // Ensure requester is never null
            if (!requester && this.client.user) {
                requester = this.client.user;
            }

            // Search for the song
            const searchResult = await this.client.manager.search(query, requester);

            if (searchResult.loadType === "empty" || !searchResult.tracks || searchResult.tracks.length === 0) {
                return this.sendError(ws, `No results found for query: ${query}`);
            }

            // Process results based on load type
            switch (searchResult.loadType) {
                case "track":
                case "search": {
                    // Add single track
                    const track = searchResult.tracks[0];
                    player.queue.add(track);

                    // Start playing if not already
                    if (!player.playing && !player.paused && !player.queue.size) {
                        player.play();
                    }

                    // Send response
                    this.sendMessage(ws, 'track_added', {
                        track: {
                            title: track.title,
                            author: track.author,
                            duration: track.duration,
                            uri: track.uri,
                            sourceName: track.sourceName,
                            artworkUrl: track.artworkUrl || track.thumbnail
                        },
                        position: player.queue.size,
                        playing: player.playing,
                        voiceChannelId: player.voiceChannelId
                    });
                    break;
                }

                case "playlist": {
                    // Add playlist tracks
                    if (!searchResult.playlist) {
                        return this.sendError(ws, 'Playlist data is missing');
                    }

                    const { playlist, tracks } = searchResult;

                    tracks.forEach(track => {
                        player.queue.add(track);
                    });

                    // Start playing if not already
                    if (!player.playing && !player.paused && player.queue.totalSize === tracks.length) {
                        player.play();
                    }

                    // Send response
                    this.sendMessage(ws, 'playlist_added', {
                        playlist: {
                            name: playlist.name,
                            trackCount: tracks.length,
                            duration: playlist.duration,
                            tracks: tracks.slice(0, 5).map(track => ({
                                title: track.title,
                                author: track.author,
                                duration: track.duration,
                                uri: track.uri
                            }))
                        },
                        playing: player.playing,
                        voiceChannelId: player.voiceChannelId
                    });
                    break;
                }

                default:
                    this.sendError(ws, `Unsupported load type: ${searchResult.loadType}`);
            }

        } catch (error) {
            this.sendError(ws, `Error playing song: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle pause message
     * @param ws - WebSocket connection
     * @param message - Message with pause data
     * @private
     */
    private handlePause(ws: WebSocket, message: WebSocketMessage): void {
        const { guildId } = message.data;

        if (!guildId) {
            return this.sendError(ws, 'guildId is required');
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                return this.sendError(ws, 'No active player found for this guild', 404);
            }

            if (player.paused) {
                return this.sendMessage(ws, 'already_paused', { guildId });
            }

            player.pause(true);
            this.sendMessage(ws, 'paused', { guildId });

        } catch (error) {
            this.sendError(ws, `Error pausing playback: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle resume message
     * @param ws - WebSocket connection
     * @param message - Message with resume data
     * @private
     */
    private handleResume(ws: WebSocket, message: WebSocketMessage): void {
        const { guildId } = message.data;

        if (!guildId) {
            return this.sendError(ws, 'guildId is required');
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                return this.sendError(ws, 'No active player found for this guild', 404);
            }

            if (!player.paused) {
                return this.sendMessage(ws, 'already_playing', { guildId });
            }

            player.pause(false);
            this.sendMessage(ws, 'resumed', { guildId });

        } catch (error) {
            this.sendError(ws, `Error resuming playback: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle stop message
     * @param ws - WebSocket connection
     * @param message - Message with stop data
     * @private
     */
    private handleStop(ws: WebSocket, message: WebSocketMessage): void {
        const { guildId } = message.data;

        if (!guildId) {
            return this.sendError(ws, 'guildId is required');
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                return this.sendError(ws, 'No active player found for this guild', 404);
            }

            player.destroy();
            this.sendMessage(ws, 'stopped', { guildId });

        } catch (error) {
            this.sendError(ws, `Error stopping playback: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle skip message
     * @param ws - WebSocket connection
     * @param message - Message with skip data
     * @private
     */
    private handleSkip(ws: WebSocket, message: WebSocketMessage): void {
        const { guildId } = message.data;

        if (!guildId) {
            return this.sendError(ws, 'guildId is required');
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                return this.sendError(ws, 'No active player found for this guild', 404);
            }

            if (!player.queue.current) {
                return this.sendError(ws, 'No song is currently playing');
            }

            const currentSong = {
                title: player.queue.current.title,
                author: player.queue.current.author
            };

            player.stop();

            this.sendMessage(ws, 'skipped', {
                guildId,
                skipped: currentSong,
                nextSong: player.queue.current ? {
                    title: player.queue.current.title,
                    author: player.queue.current.author
                } : null
            });

        } catch (error) {
            this.sendError(ws, `Error skipping song: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle volume message
     * @param ws - WebSocket connection
     * @param message - Message with volume data
     * @private
     */
    private handleVolume(ws: WebSocket, message: WebSocketMessage): void {
        const { guildId, volume } = message.data;

        if (!guildId) {
            return this.sendError(ws, 'guildId is required');
        }

        if (volume === undefined || volume === null) {
            return this.sendError(ws, 'volume is required');
        }

        if (typeof volume !== 'number' || volume < 0 || volume > 100) {
            return this.sendError(ws, 'volume must be a number between 0 and 100');
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                return this.sendError(ws, 'No active player found for this guild', 404);
            }

            player.setVolume(volume);
            this.sendMessage(ws, 'volume_set', { guildId, volume });

        } catch (error) {
            this.sendError(ws, `Error setting volume: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle queue message
     * @param ws - WebSocket connection
     * @param message - Message with queue data
     * @private
     */
    private handleQueue(ws: WebSocket, message: WebSocketMessage): void {
        const { guildId } = message.data;

        if (!guildId) {
            return this.sendError(ws, 'guildId is required');
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                return this.sendError(ws, 'No active player found for this guild', 404);
            }

            // Get current song
            const currentSong = player.queue.current ? {
                title: player.queue.current.title,
                author: player.queue.current.author,
                duration: player.queue.current.duration,
                position: player.position,
                uri: player.queue.current.uri,
                sourceName: player.queue.current.sourceName,
                artworkUrl: player.queue.current.artworkUrl || player.queue.current.thumbnail
            } : null;

            // Get queue songs
            const queueSongs = player.queue.map(track => ({
                title: track.title,
                author: track.author,
                duration: track.duration,
                uri: track.uri,
                sourceName: track.sourceName,
                artworkUrl: track.artworkUrl || track.thumbnail
            }));

            // Send response
            this.sendMessage(ws, 'queue', {
                guildId,
                playing: player.playing,
                paused: player.paused,
                volume: player.volume,
                repeatMode: player.trackRepeat ? 'track' : (player.queueRepeat ? 'queue' : 'off'),
                currentSong,
                queueSize: player.queue.size,
                queue: queueSongs
            });

        } catch (error) {
            this.sendError(ws, `Error getting queue: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle recommend message
     * @param ws - WebSocket connection
     * @param message - Message with recommend data
     * @private
     */
    private async handleRecommend(ws: WebSocket, message: WebSocketMessage): Promise<void> {
        const { guildId, userId, count = 10 } = message.data;

        if (!guildId) {
            return this.sendError(ws, 'guildId is required');
        }

        if (!userId) {
            return this.sendError(ws, 'userId is required');
        }

        try {
            const suggestionEngine = new PlaylistSuggestion(this.client);

            // Get recommendations
            const recommendations = await suggestionEngine.getSuggestionsFromUserTopSong(
                userId,
                guildId,
                count
            );

            if (!recommendations.seedSong) {
                return this.sendError(ws, 'No listening history found for recommendation generation', 404);
            }

            // Format and send response
            this.sendMessage(ws, 'recommendations', {
                guildId,
                userId,
                seedSong: {
                    title: recommendations.seedSong.title,
                    author: recommendations.seedSong.author,
                    uri: recommendations.seedSong.uri,
                    artworkUrl: recommendations.seedSong.artworkUrl || recommendations.seedSong.thumbnail
                },
                recommendations: recommendations.recommendations.map(track => ({
                    title: track.title,
                    author: track.author,
                    uri: track.uri,
                    sourceName: track.sourceName,
                    artworkUrl: track.artworkUrl || track.thumbnail
                }))
            });

        } catch (error) {
            this.sendError(ws, `Error getting recommendations: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Send a message to a WebSocket client
     * @param ws - WebSocket connection
     * @param type - Message type
     * @param data - Message data
     * @private
     */
    private sendMessage(ws: WebSocket, type: string, data: any): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, data }));
        }
    }

    /**
     * Send an error message to a WebSocket client
     * @param ws - WebSocket connection
     * @param message - Error message
     * @param code - Error code
     * @private
     */
    private sendError(ws: WebSocket, message: string, code: number = 400): void {
        this.sendMessage(ws, 'error', { message, code });
    }

    /**
     * Broadcast an event to all clients associated with a guild
     * @param guildId - Guild ID
     * @param type - Event type
     * @param data - Event data
     * @public
     */
    public broadcastToGuild(guildId: string, type: string, data: any): void {
        // Find all clients subscribed to this guild
        for (const [client, guilds] of this.clientGuilds.entries()) {
            if (guilds.has(guildId) && client.readyState === WebSocket.OPEN) {
                this.sendMessage(client, type, data);
            }
        }
    }
}

export default WebSocketManager;