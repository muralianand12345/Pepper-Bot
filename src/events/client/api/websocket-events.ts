import discord from 'discord.js';
import magmastream, { ManagerEventTypes } from 'magmastream';
import WebSocketManager from './core/websocket-manager';
import { BotEvent } from '../../../types';

/**
 * Broadcast a player event to all WebSocket clients subscribed to a guild
 * @param client - Discord client
 * @param guildId - Guild ID
 * @param eventType - Event type
 * @param data - Event data
 */
const broadcastPlayerEvent = (client: discord.Client, guildId: string, eventType: string, data: any): void => {
    try {
        // Safety check for guildId
        if (!guildId) {
            client.logger.warn('[WEBSOCKET] Attempted to broadcast event without guildId');
            return;
        }

        // Get HTTP server from client (if available)
        const server = (client as any).httpServer;
        if (!server) {
            return;
        }

        // Get WebSocket manager instance
        const wsManager = WebSocketManager.getInstance(client, server, client.logger);

        // Broadcast event
        wsManager.broadcastToGuild(guildId, eventType, {
            guildId,
            timestamp: new Date().toISOString(),
            ...data
        });
    } catch (error) {
        client.logger.error(`[WEBSOCKET] Failed to broadcast event: ${error}`);
    }
};

/**
 * WebSocket events for music player state changes
 * @type {BotEvent}
 */
const event: BotEvent = {
    name: discord.Events.ClientReady,
    execute: async (client: discord.Client): Promise<void> => {
        // Check if API and WebSocket are enabled
        if (!client.config.api?.enabled) {
            return;
        }

        try {
            // Add event listeners to the manager
            client.manager.on(ManagerEventTypes.TrackStart, (player, track) => {
                // Check if track is null or undefined
                if (!track || !player) {
                    client.logger.warn('[WEBSOCKET] TrackStart event received with null track or player');
                    return;
                }

                try {
                    broadcastPlayerEvent(client, player.guildId, 'track_start', {
                        track: {
                            title: track.title || 'Unknown Title',
                            author: track.author || 'Unknown Artist',
                            duration: track.duration || 0,
                            uri: track.uri || '',
                            sourceName: track.sourceName || 'unknown',
                            artworkUrl: track.artworkUrl || track.thumbnail || null
                        },
                        position: player.position || 0,
                        volume: player.volume || 50
                    });
                } catch (error) {
                    client.logger.error(`[WEBSOCKET] Error broadcasting track_start event: ${error}`);
                }
            });

            client.manager.on(ManagerEventTypes.TrackEnd, (player, track) => {
                // Check if track is null or undefined
                if (!track || !player) {
                    client.logger.warn('[WEBSOCKET] TrackEnd event received with null track or player');
                    return;
                }

                try {
                    broadcastPlayerEvent(client, player.guildId, 'track_end', {
                        track: {
                            title: track.title || 'Unknown Title',
                            author: track.author || 'Unknown Artist',
                            duration: track.duration || 0,
                            uri: track.uri || ''
                        }
                    });
                } catch (error) {
                    client.logger.error(`[WEBSOCKET] Error broadcasting track_end event: ${error}`);
                }
            });

            client.manager.on(ManagerEventTypes.QueueEnd, (player) => {
                if (!player) {
                    client.logger.warn('[WEBSOCKET] QueueEnd event received with null player');
                    return;
                }

                try {
                    broadcastPlayerEvent(client, player.guildId, 'queue_end', {});
                } catch (error) {
                    client.logger.error(`[WEBSOCKET] Error broadcasting queue_end event: ${error}`);
                }
            });

            client.manager.on(ManagerEventTypes.PlayerDestroy, (player) => {
                if (!player) {
                    client.logger.warn('[WEBSOCKET] PlayerDestroy event received with null player');
                    return;
                }

                try {
                    broadcastPlayerEvent(client, player.guildId, 'player_destroy', {});
                } catch (error) {
                    client.logger.error(`[WEBSOCKET] Error broadcasting player_destroy event: ${error}`);
                }
            });

            client.manager.on(ManagerEventTypes.PlayerCreate, (player) => {
                if (!player) {
                    client.logger.warn('[WEBSOCKET] PlayerCreate event received with null player');
                    return;
                }

                try {
                    broadcastPlayerEvent(client, player.guildId, 'player_create', {
                        voiceChannelId: player.voiceChannelId || null,
                        textChannelId: player.textChannelId || null,
                        volume: player.volume || 50
                    });
                } catch (error) {
                    client.logger.error(`[WEBSOCKET] Error broadcasting player_create event: ${error}`);
                }
            });

            client.manager.on(ManagerEventTypes.PlayerStateUpdate, (oldPlayer, newPlayer, changeType) => {
                if (!newPlayer || !oldPlayer) {
                    client.logger.warn('[WEBSOCKET] PlayerStateUpdate event received with null player');
                    return;
                }

                try {
                    // Check if pause state changed
                    if (oldPlayer.paused !== newPlayer.paused) {
                        broadcastPlayerEvent(client, newPlayer.guildId, newPlayer.paused ? 'player_paused' : 'player_resumed', {
                            position: newPlayer.position || 0
                        });
                    }

                    // Check if volume changed
                    if (oldPlayer.volume !== newPlayer.volume) {
                        broadcastPlayerEvent(client, newPlayer.guildId, 'player_volume_changed', {
                            volume: newPlayer.volume || 0
                        });
                    }
                } catch (error) {
                    client.logger.error(`[WEBSOCKET] Error broadcasting player state change event: ${error}`);
                }
            });

            client.logger.info('[WEBSOCKET] Music events registered for WebSocket notifications');

        } catch (error) {
            client.logger.error(`[WEBSOCKET] Failed to register music events: ${error}`);
        }
    },
};

export default event;