import http from 'http';
import WebSocket from 'ws';
import discord from 'discord.js';
import magmastream from 'magmastream';
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
    AUTH = 'auth',
    NOW_PLAYING = 'now_playing',
    AUTOPLAY = 'autoplay',
}

/**
 * Interface for storing client metadata
 */
interface ClientMetadata {
    ip: string;
    authenticated: boolean;
    guilds: Set<string>;
    connectedAt: Date;
}

/**
 * Manages WebSocket connections for music control
 */
class WebSocketManager {
    private static instance: WebSocketManager;
    private wss: WebSocket.Server | null = null;
    private readonly client: discord.Client;
    private readonly logger: ILogger;
    private readonly clientsMetadata: Map<WebSocket, ClientMetadata> = new Map();
    private readonly apiKey: string;
    private readonly webhookUrl: string | undefined;

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
        this.webhookUrl = client.config?.api?.webhook || undefined;

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
     * Gets IP address from WebSocket request
     * @param req - HTTP request object
     * @returns IP address string
     */
    private getClientIp(req: http.IncomingMessage): string {
        // Try different headers that might contain the IP
        const forwardedFor = req.headers['x-forwarded-for'];
        if (forwardedFor) {
            // X-Forwarded-For can be a comma-separated list, take the first one
            const ips = Array.isArray(forwardedFor)
                ? forwardedFor[0]
                : forwardedFor.split(',')[0].trim();
            return ips || 'unknown';
        }

        // Try Cloudflare-specific headers
        const cfConnectingIp = req.headers['cf-connecting-ip'];
        if (cfConnectingIp) {
            return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
        }

        // Try other common proxy headers
        const realIp = req.headers['x-real-ip'];
        if (realIp) {
            return Array.isArray(realIp) ? realIp[0] : realIp;
        }

        // Fall back to socket remote address
        const remoteAddress = req.socket.remoteAddress;

        // Format IPv6 addresses (like ::1) to be more readable
        if (remoteAddress && remoteAddress.includes(':')) {
            if (remoteAddress === '::1') {
                return 'localhost';
            }
            // IPv6 address formatting
            return remoteAddress;
        }

        return remoteAddress || 'unknown';
    }

    /**
     * Sends a webhook notification with information about the WebSocket action
     * @param type - The type of WebSocket action
     * @param data - Data associated with the action
     * @param status - Status of the action (success, error, info)
     * @param details - Additional details or error message
     * @param clientMetadata - Optional metadata about the client
     * @private
     */
    private async sendWebhookNotification(
        type: string,
        data: any,
        status: 'success' | 'error' | 'info' = 'info',
        details?: string,
        clientMetadata?: ClientMetadata
    ): Promise<void> {
        if (!this.webhookUrl) {
            this.logger.debug('[WEBSOCKET] Webhook URL not configured, skipping webhook notification');
            return;
        }

        try {
            const webhookClient = new discord.WebhookClient({ url: this.webhookUrl });
            const timestamp = new Date();

            // Set color based on status
            let color: number;
            switch (status) {
                case 'success': color = 0x43b581; // Discord green
                    break;
                case 'error': color = 0xf04747; // Discord red
                    break;
                default: color = 0x7289da; // Discord blurple
            }

            // Format guild information if available
            let guildInfo = '';
            if (data?.guildId) {
                const guild = this.client.guilds.cache.get(data.guildId);
                if (guild) {
                    guildInfo = `**Guild:** ${guild.name} (${guild.id})`;
                } else {
                    guildInfo = `**Guild ID:** ${data.guildId}`;
                }
            }

            // Format user information if available
            let userInfo = '';
            if (data?.userId) {
                try {
                    const user = this.client.users.cache.get(data.userId) ||
                        await this.client.users.fetch(data.userId).catch(() => null);

                    if (user) {
                        userInfo = `**User:** ${user.tag} (${user.id})`;
                    } else {
                        userInfo = `**User ID:** ${data.userId}`;
                    }
                } catch (error) {
                    userInfo = `**User ID:** ${data.userId}`;
                }
            }

            // Format client information if available
            let clientInfo = '';
            if (clientMetadata) {
                clientInfo = `**IP Address:** ${clientMetadata.ip}\n`;
                clientInfo += `**Connected At:** <t:${Math.floor(clientMetadata.connectedAt.getTime() / 1000)}:R>\n`;
                clientInfo += `**Authenticated:** ${clientMetadata.authenticated ? 'Yes' : 'No'}\n`;
                clientInfo += `**Subscribed Guilds:** ${clientMetadata.guilds.size}`;
            }

            // Format event specific details
            let eventDetails = '';
            let thumbnailUrl = null;

            switch (type) {
                case MessageType.PLAY:
                    eventDetails = `**Query:** ${data.query || 'N/A'}`;
                    // Add track information if available
                    if (data.trackInfo) {
                        eventDetails += `\n**Track:** ${data.trackInfo.title || 'Unknown'} by ${data.trackInfo.author || 'Unknown Artist'}`;
                        thumbnailUrl = data.trackInfo.artworkUrl;
                    }
                    break;
                case MessageType.PAUSE:
                    eventDetails = `**Action:** Paused playback`;
                    if (data.trackInfo) {
                        eventDetails += `\n**Current Track:** ${data.trackInfo.title || 'Unknown'} by ${data.trackInfo.author || 'Unknown Artist'}`;
                        thumbnailUrl = data.trackInfo.artworkUrl;
                    }
                    break;
                case MessageType.RESUME:
                    eventDetails = `**Action:** Resumed playback`;
                    if (data.trackInfo) {
                        eventDetails += `\n**Current Track:** ${data.trackInfo.title || 'Unknown'} by ${data.trackInfo.author || 'Unknown Artist'}`;
                        thumbnailUrl = data.trackInfo.artworkUrl;
                    }
                    break;
                case MessageType.STOP:
                    eventDetails = `**Action:** Stopped playback`;
                    break;
                case MessageType.SKIP:
                    eventDetails = `**Action:** Skipped song`;
                    if (data.skipped) {
                        eventDetails += `\n**Skipped:** ${data.skipped.title || 'Unknown'} by ${data.skipped.author || 'Unknown Artist'}`;
                    }
                    if (data.nextSong) {
                        eventDetails += `\n**Now Playing:** ${data.nextSong.title || 'Unknown'} by ${data.nextSong.author || 'Unknown Artist'}`;
                    }
                    break;
                case MessageType.VOLUME:
                    eventDetails = `**Volume:** ${data.volume !== undefined ? `${data.volume}%` : 'N/A'}`;
                    break;
                case MessageType.RECOMMEND:
                    eventDetails = `**Recommendation Count:** ${data.count || 10}`;
                    if (data.seedSong) {
                        eventDetails += `\n**Seed Song:** ${data.seedSong.title || 'Unknown'} by ${data.seedSong.author || 'Unknown Artist'}`;
                        thumbnailUrl = data.seedSong.artworkUrl;
                    }
                    break;
                case MessageType.QUEUE:
                    eventDetails = `**Queue Size:** ${data.queueSize || 0} tracks`;
                    if (data.currentSong) {
                        eventDetails += `\n**Current Track:** ${data.currentSong.title || 'Unknown'} by ${data.currentSong.author || 'Unknown Artist'}`;
                        thumbnailUrl = data.currentSong.artworkUrl;
                    }
                    break;
                case MessageType.AUTH:
                    // Don't show API key, just status
                    eventDetails = `**Authentication:** ${status === 'success' ? 'Successful' : 'Failed'}`;
                    break;
                case MessageType.NOW_PLAYING:
                    if (data.track) {
                        eventDetails = `**Track:** ${data.track.title || 'Unknown'} by ${data.track.author || 'Unknown Artist'}`;
                        eventDetails += `\n**Progress:** ${Math.floor(data.progressPercent || 0)}%`;
                        thumbnailUrl = data.track.artworkUrl;
                    } else {
                        eventDetails = `**Nothing Playing**`;
                    }
                    break;
                case 'connection_established':
                    eventDetails = `**New WebSocket connection**`;
                    break;
                case 'connection_closed':
                    eventDetails = `**WebSocket connection closed**`;
                    break;
                case 'connection_error':
                    eventDetails = `**WebSocket connection error**`;
                    break;
                case 'parse_error':
                    eventDetails = `**Message parsing error**`;
                    break;
                case 'authentication_required':
                    eventDetails = `**Authentication required**`;
                    break;
                case 'unknown_message_type':
                    eventDetails = `**Unknown message type received**`;
                    break;
            }

            // Create embed for the webhook
            const embed = new discord.EmbedBuilder()
                .setColor(color)
                .setTitle(`WebSocket Action: ${type.toUpperCase()}`)
                .setDescription(`A WebSocket client performed the \`${type}\` action`)
                .setTimestamp(timestamp);

            // Add thumbnail if available
            if (thumbnailUrl) {
                embed.setThumbnail(thumbnailUrl);
            }

            // Add fields conditionally
            if (guildInfo) embed.addFields({ name: '🏠 Server', value: guildInfo, inline: true });
            if (userInfo) embed.addFields({ name: '👤 User', value: userInfo, inline: true });
            if (clientInfo) embed.addFields({ name: '🖥️ Client Information', value: clientInfo, inline: false });
            if (eventDetails) embed.addFields({ name: '📝 Details', value: eventDetails, inline: false });
            if (details) embed.addFields({ name: status === 'error' ? '❌ Error' : 'ℹ️ Additional Info', value: details, inline: false });

            // Add bot branding
            embed.setFooter({
                text: `${this.client.user?.username || 'Bot'} WebSocket API`,
                iconURL: this.client.user?.displayAvatarURL()
            });

            // Send the webhook
            webhookClient.send({
                username: `${this.client.user?.username || 'Music Bot'} WebSocket`,
                avatarURL: this.client.user?.displayAvatarURL(),
                embeds: [embed]
            }).catch(error => {
                this.logger.error(`[WEBSOCKET] Failed to send webhook notification: ${error}`);
            });
        } catch (error) {
            this.logger.error(`[WEBSOCKET] Error sending webhook notification: ${error}`);
        }
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
     * @param req - HTTP request
     * @private
     */
    private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
        // Get client IP address
        const clientIp = this.getClientIp(req);

        this.logger.info(`[WEBSOCKET] New connection established from IP: ${clientIp}`);

        // Initialize client metadata
        const metadata: ClientMetadata = {
            ip: clientIp,
            authenticated: false,
            guilds: new Set<string>(),
            connectedAt: new Date()
        };
        this.clientsMetadata.set(ws, metadata);

        // Setup message handler
        ws.on('message', async (message) => {
            try {
                const parsedMessage = JSON.parse(message.toString()) as WebSocketMessage;
                await this.handleMessage(ws, parsedMessage);
            } catch (error) {
                this.sendError(ws, 'Invalid message format');
                // Send webhook notification for parse error
                this.sendWebhookNotification(
                    'parse_error',
                    { message: message.toString().substring(0, 100) + '...' },
                    'error',
                    `Failed to parse JSON message: ${error instanceof Error ? error.message : String(error)}`,
                    this.clientsMetadata.get(ws)
                );
            }
        });

        // Setup close handler
        ws.on('close', () => {
            const metadata = this.clientsMetadata.get(ws);
            this.logger.info(`[WEBSOCKET] Connection closed from IP: ${metadata?.ip || 'unknown'}`);

            // Send webhook notification for connection close
            this.sendWebhookNotification(
                'connection_closed',
                {},
                'info',
                'WebSocket connection closed',
                metadata
            );

            // Clean up metadata
            this.clientsMetadata.delete(ws);
        });

        // Setup error handler
        ws.on('error', (error) => {
            const metadata = this.clientsMetadata.get(ws);
            this.logger.error(`[WEBSOCKET] Connection error from IP ${metadata?.ip || 'unknown'}: ${error.message}`);

            // Send webhook notification for connection error
            this.sendWebhookNotification(
                'connection_error',
                {},
                'error',
                `WebSocket connection error: ${error.message}`,
                metadata
            );
        });

        // Send welcome message
        this.sendMessage(ws, 'system', { message: 'Connected to Pepper Music WebSocket. Please authenticate with type: "auth", data: { apiKey: "your-api-key" }' });

        // Send webhook notification for new connection
        this.sendWebhookNotification(
            'connection_established',
            {},
            'info',
            'New WebSocket connection established',
            metadata
        );
    }

    /**
     * Handle incoming WebSocket message
     * @param ws - WebSocket connection
     * @param message - Parsed message
     * @private
     */
    private async handleMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
        const metadata = this.clientsMetadata.get(ws);

        // Authentication required for all messages except AUTH
        if (message.type !== MessageType.AUTH && !(metadata && metadata.authenticated)) {
            this.sendError(ws, 'Not authenticated', 401, message.data.guildId);

            // Send webhook notification for authentication failure
            this.sendWebhookNotification(
                'authentication_required',
                {},
                'error',
                'Client attempted to use a command without authentication',
                metadata
            );
            return;
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

            case MessageType.NOW_PLAYING:
                this.handleNowPlaying(ws, message);
                break;

            case MessageType.AUTOPLAY:
                this.handleAutoplay(ws, message);
                break;

            default:
                this.sendError(ws, `Unknown message type: ${message.type}`, 400, message.data.guildId);

                // Send webhook notification for unknown message type
                this.sendWebhookNotification(
                    'unknown_message_type',
                    { type: message.type },
                    'error',
                    `Client sent an unknown message type: ${message.type}`,
                    metadata
                );
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
        const metadata = this.clientsMetadata.get(ws);

        if (!this.apiKey) {
            this.logger.warn('[WEBSOCKET] API key not configured but authentication attempted');
            this.sendError(ws, 'Authentication is misconfigured on the server', 500, message.data.guildId);

            // Send webhook notification for authentication error
            this.sendWebhookNotification(
                MessageType.AUTH,
                {},
                'error',
                'API key not configured on server',
                metadata
            );
            return;
        }

        if (!providedKey) {
            this.sendError(ws, 'API key is required', 401, message.data.guildId);

            // Send webhook notification for missing API key
            this.sendWebhookNotification(
                MessageType.AUTH,
                {},
                'error',
                'Client attempted authentication without providing an API key',
                metadata
            );
            return;
        }

        if (providedKey !== this.apiKey) {
            this.sendError(ws, 'Invalid API key', 401, message.data.guildId);

            // Send webhook notification for invalid API key
            this.sendWebhookNotification(
                MessageType.AUTH,
                {},
                'error',
                'Client attempted authentication with invalid API key',
                metadata
            );
            return;
        }

        // Mark client as authenticated
        if (metadata) {
            metadata.authenticated = true;
        }

        this.sendMessage(ws, 'auth_success', { message: 'Successfully authenticated' });

        // Send webhook notification for successful authentication
        this.sendWebhookNotification(
            MessageType.AUTH,
            {},
            'success',
            'Client successfully authenticated',
            metadata
        );
    }

    /**
     * Handle play message
     * @param ws - WebSocket connection
     * @param message - Message with play data
     * @private
     */
    private async handlePlay(ws: WebSocket, message: WebSocketMessage): Promise<void> {
        const { guildId, query, userId, node } = message.data;
        const metadata = this.clientsMetadata.get(ws);

        if (!guildId) {
            this.sendError(ws, 'guildId is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.PLAY, message.data, 'error', 'guildId is required', metadata);
            return;
        }

        if (!query) {
            this.sendError(ws, 'query is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.PLAY, message.data, 'error', 'query is required', metadata);
            return;
        }

        if (!userId) {
            this.sendError(ws, 'userId is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.PLAY, message.data, 'error', 'userId is required', metadata);
            return;
        }

        if (node) {
            const validNode = this.client.manager.nodes.find(
                (n: magmastream.Node) => n.options.identifier === node
            );
            if (!validNode) {
                this.sendError(ws, 'Invalid node identifier', 400, message.data.guildId);
                this.sendWebhookNotification(MessageType.PLAY, message.data, 'error', 'Invalid node identifier', metadata);
                return;
            }
            if (!validNode.connected) {
                this.sendError(ws, 'Node is not connected', 503, message.data.guildId);
                this.sendWebhookNotification(MessageType.PLAY, message.data, 'error', 'Node is not connected', metadata);
                return;
            }
        }

        try {
            // Save guild association
            if (metadata) {
                metadata.guilds.add(guildId);
            }

            // Get guild instance
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                this.sendError(ws, `Guild not found: ${guildId}`, 404, message.data.guildId);
                this.sendWebhookNotification(MessageType.PLAY, message.data, 'error', `Guild not found: ${guildId}`, metadata);
                return;
            }

            // Find active voice channel if no player exists
            let player = this.client.manager.get(guildId);

            // Load the music guild data to check for songChannelId
            const MusicDB = require('../../../../utils/music/music_db').default;

            // Get songChannelId from database
            const textChannelId = await MusicDB.getSongTextChannelId(this.client, guildId, userId);

            if (!textChannelId) {
                this.sendError(ws, 'Could not find a suitable text channel', 404, message.data.guildId);
                this.sendWebhookNotification(MessageType.PLAY, message.data, 'error', 'Could not find a suitable text channel', metadata);
                return;
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
                            this.sendError(ws, 'No active voice channels found and user is not in a voice channel', 404, message.data.guildId);
                            this.sendWebhookNotification(MessageType.PLAY, message.data, 'error', 'No active voice channels found and user is not in a voice channel', metadata);
                            return;
                        }

                        voiceChannelId = voiceChannels.first()?.id;
                    }
                } catch (error) {
                    this.sendError(ws, `Could not find a suitable voice channel: ${error}`, 404, message.data.guildId);
                    this.sendWebhookNotification(MessageType.PLAY, message.data, 'error', `Could not find a suitable voice channel: ${error}`, metadata);
                    return;
                }

                if (!voiceChannelId) {
                    this.sendError(ws, 'Could not find a suitable voice channel', 404, message.data.guildId);
                    this.sendWebhookNotification(MessageType.PLAY, message.data, 'error', 'Could not find a suitable voice channel', metadata);
                    return;
                }

                // Create player with the determined textChannelId
                player = this.client.manager.create({
                    guildId: guild.id,
                    voiceChannelId: voiceChannelId,
                    textChannelId: textChannelId,
                    node: node,
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
                this.sendError(ws, `No results found for query: ${query}`, 404, message.data.guildId);
                this.sendWebhookNotification(MessageType.PLAY, message.data, 'error', `No results found for query: ${query}`, metadata);
                return;
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

                    // Prepare response data
                    const responseData = {
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
                    };

                    // Send response to client
                    this.sendMessage(ws, 'track_added', responseData);

                    // Send webhook notification
                    this.sendWebhookNotification(
                        MessageType.PLAY,
                        {
                            ...message.data,
                            trackInfo: {
                                title: track.title,
                                author: track.author,
                                duration: track.duration,
                                artworkUrl: track.artworkUrl || track.thumbnail
                            }
                        },
                        'success',
                        `Added track "${track.title}" by "${track.author}" to queue`,
                        metadata
                    );
                    break;
                }

                case "playlist": {
                    // Add playlist tracks
                    if (!searchResult.playlist) {
                        this.sendError(ws, 'Playlist data is missing', 400, message.data.guildId);
                        this.sendWebhookNotification(MessageType.PLAY, message.data, 'error', 'Playlist data is missing', metadata);
                        return;
                    }

                    const { playlist, tracks } = searchResult;

                    tracks.forEach(track => {
                        player.queue.add(track);
                    });

                    // Start playing if not already
                    if (!player.playing && !player.paused && player.queue.totalSize === tracks.length) {
                        player.play();
                    }

                    // Prepare response data
                    const responseData = {
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
                    };

                    // Send response to client
                    this.sendMessage(ws, 'playlist_added', responseData);

                    // Send webhook notification
                    this.sendWebhookNotification(
                        MessageType.PLAY,
                        {
                            ...message.data,
                            playlistInfo: {
                                name: playlist.name,
                                trackCount: tracks.length,
                                firstTrack: tracks.length > 0 ? {
                                    title: tracks[0].title,
                                    author: tracks[0].author,
                                    artworkUrl: tracks[0].artworkUrl || tracks[0].thumbnail
                                } : null
                            }
                        },
                        'success',
                        `Added playlist "${playlist.name}" with ${tracks.length} tracks to queue`,
                        metadata
                    );
                    break;
                }

                default:
                    this.sendError(ws, `Unsupported load type: ${searchResult.loadType}`, 400, message.data.guildId);
                    this.sendWebhookNotification(
                        MessageType.PLAY,
                        message.data,
                        'error',
                        `Unsupported load type: ${searchResult.loadType}`,
                        metadata
                    );
            }

        } catch (error) {
            this.sendError(ws, `Error playing song: ${error instanceof Error ? error.message : String(error)}`, 500, message.data.guildId);
            this.sendWebhookNotification(
                MessageType.PLAY,
                message.data,
                'error',
                `Error playing song: ${error instanceof Error ? error.message : String(error)}`,
                metadata
            );
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
            this.sendError(ws, 'guildId is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.PAUSE, message.data, 'error', 'guildId is required');
            return;
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                this.sendError(ws, 'No active player found for this guild', 404, message.data.guildId);
                this.sendWebhookNotification(MessageType.PAUSE, message.data, 'error', 'No active player found for this guild');
                return;
            }

            if (player.paused) {
                this.sendMessage(ws, 'already_paused', { guildId });
                this.sendWebhookNotification(MessageType.PAUSE, message.data, 'info', 'Player is already paused');
                return;
            }

            // Get current track info for the webhook
            const trackInfo = player.queue.current ? {
                title: player.queue.current.title,
                author: player.queue.current.author,
                artworkUrl: player.queue.current.artworkUrl || player.queue.current.thumbnail
            } : null;

            player.pause(true);
            this.sendMessage(ws, 'paused', { guildId });

            // Send webhook notification
            this.sendWebhookNotification(
                MessageType.PAUSE,
                {
                    ...message.data,
                    trackInfo
                },
                'success',
                'Playback paused'
            );

        } catch (error) {
            this.sendError(ws, `Error pausing playback: ${error instanceof Error ? error.message : String(error)}`, 500, message.data.guildId);
            this.sendWebhookNotification(
                MessageType.PAUSE,
                message.data,
                'error',
                `Error pausing playback: ${error instanceof Error ? error.message : String(error)}`
            );
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
            this.sendError(ws, 'guildId is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.RESUME, message.data, 'error', 'guildId is required');
            return;
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                this.sendError(ws, 'No active player found for this guild', 404, message.data.guildId);
                this.sendWebhookNotification(MessageType.RESUME, message.data, 'error', 'No active player found for this guild');
                return;
            }

            if (!player.paused) {
                this.sendMessage(ws, 'already_playing', { guildId });
                this.sendWebhookNotification(MessageType.RESUME, message.data, 'info', 'Player is already playing');
                return;
            }

            // Get current track info for the webhook
            const trackInfo = player.queue.current ? {
                title: player.queue.current.title,
                author: player.queue.current.author,
                artworkUrl: player.queue.current.artworkUrl || player.queue.current.thumbnail
            } : null;

            player.pause(false);
            this.sendMessage(ws, 'resumed', { guildId });

            // Send webhook notification
            this.sendWebhookNotification(
                MessageType.RESUME,
                {
                    ...message.data,
                    trackInfo
                },
                'success',
                'Playback resumed'
            );

        } catch (error) {
            this.sendError(ws, `Error resuming playback: ${error instanceof Error ? error.message : String(error)}`, 500, message.data.guildId);
            this.sendWebhookNotification(
                MessageType.RESUME,
                message.data,
                'error',
                `Error resuming playback: ${error instanceof Error ? error.message : String(error)}`
            );
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
            this.sendError(ws, 'guildId is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.STOP, message.data, 'error', 'guildId is required');
            return;
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                this.sendError(ws, 'No active player found for this guild', 404, message.data.guildId);
                this.sendWebhookNotification(MessageType.STOP, message.data, 'error', 'No active player found for this guild');
                return;
            }

            // Get current track info for the webhook before destroying the player
            const trackInfo = player.queue.current ? {
                title: player.queue.current.title,
                author: player.queue.current.author,
                artworkUrl: player.queue.current.artworkUrl || player.queue.current.thumbnail
            } : null;

            const queueSize = player.queue.size;

            player.destroy();
            this.sendMessage(ws, 'stopped', { guildId });

            // Send webhook notification
            this.sendWebhookNotification(
                MessageType.STOP,
                {
                    ...message.data,
                    trackInfo,
                    queueSize
                },
                'success',
                `Stopped playback and cleared queue with ${queueSize} remaining tracks`
            );

        } catch (error) {
            this.sendError(ws, `Error stopping playback: ${error instanceof Error ? error.message : String(error)}`, 500, message.data.guildId);
            this.sendWebhookNotification(
                MessageType.STOP,
                message.data,
                'error',
                `Error stopping playback: ${error instanceof Error ? error.message : String(error)}`
            );
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
            this.sendError(ws, 'guildId is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.SKIP, message.data, 'error', 'guildId is required');
            return;
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                this.sendError(ws, 'No active player found for this guild', 404, message.data.guildId);
                this.sendWebhookNotification(MessageType.SKIP, message.data, 'error', 'No active player found for this guild');
                return;
            }

            if (!player.queue.current) {
                this.sendError(ws, 'No song is currently playing', 404, message.data.guildId);
                this.sendWebhookNotification(MessageType.SKIP, message.data, 'error', 'No song is currently playing');
                return;
            }

            const currentSong = {
                title: player.queue.current.title,
                author: player.queue.current.author,
                artworkUrl: player.queue.current.artworkUrl || player.queue.current.thumbnail
            };

            // Check what the next song will be
            const nextTrack = player.queue.size > 0 ? player.queue[0] : null;
            const nextSong = nextTrack ? {
                title: nextTrack.title,
                author: nextTrack.author,
                artworkUrl: nextTrack.artworkUrl || nextTrack.thumbnail
            } : null;

            player.stop();

            const responseData = {
                guildId,
                skipped: currentSong,
                nextSong: player.queue.current ? {
                    title: player.queue.current.title,
                    author: player.queue.current.author
                } : null
            };

            this.sendMessage(ws, 'skipped', responseData);

            // Send webhook notification
            this.sendWebhookNotification(
                MessageType.SKIP,
                {
                    ...message.data,
                    skipped: currentSong,
                    nextSong: responseData.nextSong || nextSong
                },
                'success',
                `Skipped "${currentSong.title}" by "${currentSong.author}"`
            );

        } catch (error) {
            this.sendError(ws, `Error skipping song: ${error instanceof Error ? error.message : String(error)}`, 500, message.data.guildId);
            this.sendWebhookNotification(
                MessageType.SKIP,
                message.data,
                'error',
                `Error skipping song: ${error instanceof Error ? error.message : String(error)}`
            );
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
            this.sendError(ws, 'guildId is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.VOLUME, message.data, 'error', 'guildId is required');
            return;
        }

        const player = this.client.manager.get(guildId);

        if (!player) {
            this.sendError(ws, 'No active player found for this guild', 404, message.data.guildId);
            this.sendWebhookNotification(MessageType.VOLUME, message.data, 'error', 'No active player found for this guild');
            return;
        }

        if (volume === undefined || volume === null) {
            this.sendMessage(ws, 'current_volume', { guildId, volume: player.volume });

            // Send webhook notification for volume query
            this.sendWebhookNotification(
                MessageType.VOLUME,
                {
                    ...message.data,
                    volume: player.volume
                },
                'info',
                `Checked current volume: ${player.volume}%`
            );
            return;
        }

        if (typeof volume !== 'number' || volume < 0 || volume > 100) {
            this.sendError(ws, 'volume must be a number between 0 and 100', 400, message.data.guildId);
            this.sendWebhookNotification(
                MessageType.VOLUME,
                message.data,
                'error',
                'volume must be a number between 0 and 100'
            );
            return;
        }

        try {
            const oldVolume = player.volume;
            player.setVolume(volume);
            this.sendMessage(ws, 'volume_set', { guildId, volume });

            // Send webhook notification for volume change
            this.sendWebhookNotification(
                MessageType.VOLUME,
                {
                    ...message.data,
                    oldVolume,
                    volume
                },
                'success',
                `Volume changed from ${oldVolume}% to ${volume}%`
            );

        } catch (error) {
            this.sendError(ws, `Error setting volume: ${error instanceof Error ? error.message : String(error)}`, 500, message.data.guildId);
            this.sendWebhookNotification(
                MessageType.VOLUME,
                message.data,
                'error',
                `Error setting volume: ${error instanceof Error ? error.message : String(error)}`
            );
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
            this.sendError(ws, 'guildId is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.QUEUE, message.data, 'error', 'guildId is required');
            return;
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                this.sendError(ws, 'No active player found for this guild', 404, message.data.guildId);
                this.sendWebhookNotification(MessageType.QUEUE, message.data, 'error', 'No active player found for this guild');
                return;
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

            // Prepare response data
            const responseData = {
                guildId,
                playing: player.playing,
                paused: player.paused,
                volume: player.volume,
                repeatMode: player.trackRepeat ? 'track' : (player.queueRepeat ? 'queue' : 'off'),
                currentSong,
                queueSize: player.queue.size,
                queue: queueSongs
            };

            // Send response
            this.sendMessage(ws, 'queue', responseData);

            // Send webhook notification
            this.sendWebhookNotification(
                MessageType.QUEUE,
                {
                    ...message.data,
                    currentSong,
                    queueSize: player.queue.size,
                    playing: player.playing,
                    paused: player.paused,
                    sampleQueueTracks: queueSongs.slice(0, 3) // Just include first 3 for webhook
                },
                'success',
                `Retrieved queue with ${player.queue.size} tracks`
            );

        } catch (error) {
            this.sendError(ws, `Error getting queue: ${error instanceof Error ? error.message : String(error)}`, 500, message.data.guildId);
            this.sendWebhookNotification(
                MessageType.QUEUE,
                message.data,
                'error',
                `Error getting queue: ${error instanceof Error ? error.message : String(error)}`
            );
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
            this.sendError(ws, 'guildId is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.RECOMMEND, message.data, 'error', 'guildId is required');
            return;
        }

        if (!userId) {
            this.sendError(ws, 'userId is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.RECOMMEND, message.data, 'error', 'userId is required');
            return;
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
                this.sendError(ws, 'No listening history found for recommendation generation', 404, message.data.guildId);
                this.sendWebhookNotification(
                    MessageType.RECOMMEND,
                    message.data,
                    'error',
                    'No listening history found for recommendation generation'
                );
                return;
            }

            // Format the response
            const responseData = {
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
            };

            // Send the response
            this.sendMessage(ws, 'recommendations', responseData);

            // Send webhook notification
            this.sendWebhookNotification(
                MessageType.RECOMMEND,
                {
                    ...message.data,
                    seedSong: responseData.seedSong,
                    recommendationCount: responseData.recommendations.length,
                    sampleRecommendations: responseData.recommendations.slice(0, 3) // Just include first 3 for webhook
                },
                'success',
                `Generated ${responseData.recommendations.length} recommendations based on "${responseData.seedSong.title}"`
            );

        } catch (error) {
            this.sendError(ws, `Error getting recommendations: ${error instanceof Error ? error.message : String(error)}`, 500, message.data.guildId);
            this.sendWebhookNotification(
                MessageType.RECOMMEND,
                message.data,
                'error',
                `Error getting recommendations: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Handle now playing message
     * @param ws - WebSocket connection
     * @param message - Message with now playing request data
     * @private
     */
    private handleNowPlaying(ws: WebSocket, message: WebSocketMessage): void {
        const { guildId } = message.data;

        if (!guildId) {
            this.sendError(ws, 'guildId is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.NOW_PLAYING, message.data, 'error', 'guildId is required');
            return;
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                this.sendError(ws, 'No active player found for this guild', 404, message.data.guildId);
                this.sendWebhookNotification(
                    MessageType.NOW_PLAYING,
                    message.data,
                    'error',
                    'No active player found for this guild'
                );
                return;
            }

            if (!player.queue.current) {
                const responseData = {
                    guildId,
                    playing: false,
                    paused: player.paused,
                    volume: null,
                    track: null,
                    progressBar: null,
                    progressPercent: 0,
                    queueSize: player.queue.size || 0
                };

                this.sendMessage(ws, 'now_playing', responseData);
                return;
            }

            // Get the NowPlayingManager for this guild to get accurate position
            const NowPlayingManager = require('../../../../utils/music/now_playing_manager').NowPlayingManager;
            const nowPlayingManager = NowPlayingManager.getInstance(guildId, player, this.client);

            // Get playback status including adjusted position
            const playbackStatus = nowPlayingManager.getPlaybackStatus();

            // Current track details
            const currentTrack = {
                title: player.queue.current.title,
                author: player.queue.current.author,
                duration: player.queue.current.duration,
                position: player.position,
                progressBarPosition: playbackStatus.position,
                uri: player.queue.current.uri,
                sourceName: player.queue.current.sourceName,
                isStream: player.queue.current.isStream,
                artworkUrl: player.queue.current.artworkUrl || player.queue.current.thumbnail,
                requester: player.queue.current.requester ? {
                    id: player.queue.current.requester.id,
                    username: player.queue.current.requester.username,
                    discriminator: player.queue.current.requester.discriminator || '0'
                } : null
            };

            // Format progress bar
            const Formatter = require('../../../../utils/format').default;
            const progressBar = Formatter.createProgressBar({
                position: playbackStatus.position,
                queue: {
                    current: {
                        duration: playbackStatus.duration
                    }
                }
            });

            const AutoplayManager = require('../../../../utils/music/autoplay_manager').default;
            const autoplayManager = AutoplayManager.getInstance(
                guildId,
                player,
                this.client
            );

            // Calculate progress percent
            const progressPercent = Math.min(100, Math.floor((playbackStatus.position / Math.max(1, playbackStatus.duration)) * 100));

            // Prepare response data
            const responseData = {
                guildId,
                playing: player.playing,
                paused: player.paused,
                volume: player.volume,
                autoplay: autoplayManager.isEnabled(),
                track: currentTrack,
                progressBar: progressBar,
                progressPercent: progressPercent,
                queueSize: player.queue.size
            };

            // Send response
            this.sendMessage(ws, 'now_playing', responseData);

            // Send webhook notification
            this.sendWebhookNotification(
                MessageType.NOW_PLAYING,
                {
                    ...message.data,
                    track: {
                        title: currentTrack.title,
                        author: currentTrack.author,
                        artworkUrl: currentTrack.artworkUrl,
                        uri: currentTrack.uri,
                        sourceName: currentTrack.sourceName
                    },
                    playing: player.playing,
                    paused: player.paused,
                    progressPercent: progressPercent
                },
                'success',
                `Currently playing "${currentTrack.title}" (${progressPercent}% complete)`
            );

        } catch (error) {
            this.sendError(ws, `Error getting now playing info: ${error instanceof Error ? error.message : String(error)}`, 500, message.data.guildId);
            this.sendWebhookNotification(
                MessageType.NOW_PLAYING,
                message.data,
                'error',
                `Error getting now playing info: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Handle autoplay message
     * @param ws - WebSocket connection
     * @param message - Message with autoplay data
     * @private
     */
    private handleAutoplay(ws: WebSocket, message: WebSocketMessage): void {
        const { guildId, enabled, userId } = message.data;
        const metadata = this.clientsMetadata.get(ws);

        if (!guildId) {
            this.sendError(ws, 'guildId is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.AUTOPLAY, message.data, 'error', 'guildId is required', metadata);
            return;
        }

        if (enabled === undefined) {
            this.sendError(ws, 'enabled parameter is required', 400, message.data.guildId);
            this.sendWebhookNotification(MessageType.AUTOPLAY, message.data, 'error', 'enabled parameter is required', metadata);
            return;
        }

        try {
            const player = this.client.manager.get(guildId);

            if (!player) {
                this.sendError(ws, 'No active player found for this guild', 404, message.data.guildId);
                this.sendWebhookNotification(MessageType.AUTOPLAY, message.data, 'error', 'No active player found for this guild', metadata);
                return;
            }

            // Save guild association
            if (metadata) {
                metadata.guilds.add(guildId);
            }

            // Get the AutoplayManager for this guild
            const AutoplayManager = require('../../../../utils/music/autoplay_manager').default;
            const autoplayManager = AutoplayManager.getInstance(
                guildId,
                player,
                this.client
            );

            // Determine user ID to use for autoplay context
            // Use provided userId, if available, or fall back to the last requester's ID
            const effectiveUserId = userId ||
                (player.queue.current?.requester as discord.User)?.id ||
                this.client.user?.id || null;

            if (enabled) {
                // Enable autoplay
                autoplayManager.enable(effectiveUserId);

                this.sendMessage(ws, 'autoplay_state', {
                    guildId,
                    enabled: true,
                    userId: effectiveUserId
                });

                // Send webhook notification
                this.sendWebhookNotification(
                    MessageType.AUTOPLAY,
                    {
                        ...message.data,
                        userId: effectiveUserId
                    },
                    'success',
                    'Autoplay enabled successfully'
                );
            } else {
                // Disable autoplay
                autoplayManager.disable();

                this.sendMessage(ws, 'autoplay_state', {
                    guildId,
                    enabled: false
                });

                // Send webhook notification
                this.sendWebhookNotification(
                    MessageType.AUTOPLAY,
                    {
                        ...message.data
                    },
                    'success',
                    'Autoplay disabled successfully'
                );
            }
        } catch (error) {
            this.sendError(ws, `Error toggling autoplay: ${error instanceof Error ? error.message : String(error)}`, 500, message.data.guildId);
            this.sendWebhookNotification(
                MessageType.AUTOPLAY,
                message.data,
                'error',
                `Error toggling autoplay: ${error instanceof Error ? error.message : String(error)}`,
                metadata
            );
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
    private sendError(ws: WebSocket, message: string, code: number = 400, guildId?: string | null): void {
        this.sendMessage(ws, 'error', { guildId, message, code });
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
        for (const [client, metadata] of this.clientsMetadata.entries()) {
            if (metadata.guilds.has(guildId) && client.readyState === WebSocket.OPEN) {
                this.sendMessage(client, type, data);
            }
        }
    }
}

export default WebSocketManager;