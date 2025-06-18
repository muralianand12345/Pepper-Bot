"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LavaLink = void 0;
const magmastream_1 = __importDefault(require("magmastream"));
const music_user_1 = __importDefault(require("../../events/database/schema/music_user"));
class LavaLink {
    constructor(client) {
        this.maxRetries = 5;
        this.addUserLavalink = async (userId, config) => {
            try {
                const testResult = await this.testConnection(config);
                if (!testResult.success) {
                    return { success: false, error: testResult.error };
                }
                const identifier = `user_${userId}_${Date.now()}`;
                const nodeConfig = {
                    ...config,
                    identifier,
                    retryCount: 0,
                    isActive: true,
                    addedAt: new Date(),
                };
                await music_user_1.default.findOneAndUpdate({ userId }, { lavalink: nodeConfig }, { upsert: true, new: true });
                const success = await this.registerNodeWithManager(userId, nodeConfig);
                if (!success) {
                    return { success: false, error: 'Failed to register node with manager' };
                }
                this.client.logger.info(`[LAVALINK] User ${userId} added personal Lavalink: ${identifier}`);
                return { success: true, nodeId: identifier };
            }
            catch (error) {
                this.client.logger.error(`[LAVALINK] Error adding user Lavalink: ${error}`);
                return { success: false, error: 'Internal error occurred' };
            }
        };
        this.removeUserLavalink = async (userId) => {
            try {
                const user = await music_user_1.default.findOne({ userId });
                if (!user?.lavalink?.identifier) {
                    return { success: false, error: 'No personal Lavalink found' };
                }
                const nodeId = user.lavalink.identifier;
                const activePlayer = Array.from(this.client.manager.players.values()).find((player) => player.node.options.identifier === nodeId);
                if (activePlayer) {
                    return { success: false, error: 'Cannot remove Lavalink while music is playing on it' };
                }
                this.unregisterNodeFromManager(nodeId);
                await music_user_1.default.findOneAndUpdate({ userId }, { $unset: { lavalink: 1 } });
                this.client.logger.info(`[LAVALINK] User ${userId} removed personal Lavalink: ${nodeId}`);
                return { success: true };
            }
            catch (error) {
                this.client.logger.error(`[LAVALINK] Error removing user Lavalink: ${error}`);
                return { success: false, error: 'Internal error occurred' };
            }
        };
        this.getUserLavalink = async (userId) => {
            try {
                const user = await music_user_1.default.findOne({ userId });
                return user?.lavalink || null;
            }
            catch (error) {
                this.client.logger.error(`[LAVALINK] Error getting user Lavalink: ${error}`);
                return null;
            }
        };
        this.getOptimalNodeForUser = async (userId, guildId) => {
            const existingPlayer = this.client.manager.get(guildId);
            if (existingPlayer) {
                return existingPlayer.node.options.identifier || null;
            }
            const userLavalink = await this.getUserLavalink(userId);
            if (userLavalink?.isActive && userLavalink.identifier) {
                const node = this.client.manager.nodes.find((n) => n.options.identifier === userLavalink.identifier);
                if (node?.connected) {
                    return userLavalink.identifier;
                }
            }
            return null;
        };
        this.handleNodeFailure = async (nodeId) => {
            try {
                if (!nodeId.startsWith('user_'))
                    return;
                const userId = this.extractUserIdFromNodeId(nodeId);
                if (!userId)
                    return;
                const user = await music_user_1.default.findOne({ userId });
                if (!user?.lavalink)
                    return;
                const newRetryCount = (user.lavalink.retryCount || 0) + 1;
                if (newRetryCount >= this.maxRetries && user.lavalink.autoFallback) {
                    await music_user_1.default.findOneAndUpdate({ userId }, {
                        'lavalink.isActive': false,
                        'lavalink.retryCount': newRetryCount,
                        'lavalink.lastError': 'Exceeded retry limit - auto-disabled',
                    });
                    this.client.logger.warn(`[LAVALINK] Auto-disabled user Lavalink for ${userId} after ${this.maxRetries} failures`);
                }
                else {
                    await music_user_1.default.findOneAndUpdate({ userId }, { 'lavalink.retryCount': newRetryCount });
                }
            }
            catch (error) {
                this.client.logger.error(`[LAVALINK] Error handling node failure: ${error}`);
            }
        };
        this.resetRetryCount = async (userId) => {
            try {
                await music_user_1.default.findOneAndUpdate({ userId }, { 'lavalink.retryCount': 0, 'lavalink.lastError': null });
            }
            catch (error) {
                this.client.logger.error(`[LAVALINK] Error resetting retry count: ${error}`);
            }
        };
        this.initializeUserNodes = async () => {
            try {
                const usersWithLavalink = await music_user_1.default.find({ 'lavalink.isActive': true });
                for (const user of usersWithLavalink) {
                    if (user.lavalink) {
                        await this.registerNodeWithManager(user.userId, user.lavalink);
                    }
                }
                this.client.logger.info(`[LAVALINK] Initialized ${usersWithLavalink.length} user Lavalink nodes`);
            }
            catch (error) {
                this.client.logger.error(`[LAVALINK] Error initializing user nodes: ${error}`);
            }
        };
        this.testConnection = async (config) => {
            try {
                const testNode = new magmastream_1.default.Node({
                    identifier: `test_${Date.now()}`,
                    host: config.host,
                    port: config.port,
                    password: config.password,
                    secure: config.secure || false,
                    retryAmount: 1,
                    retrydelay: 3000,
                    requestTimeout: 5000,
                });
                return new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        resolve({ success: false, error: 'Connection timeout' });
                    }, 10000);
                    testNode.once('connect', () => {
                        clearTimeout(timeout);
                        testNode.destroy();
                        resolve({ success: true });
                    });
                    testNode.once('error', (error) => {
                        clearTimeout(timeout);
                        testNode.destroy();
                        resolve({ success: false, error: error.message });
                    });
                    testNode.connect();
                });
            }
            catch (error) {
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        };
        this.registerNodeWithManager = async (userId, config) => {
            try {
                if (!config.identifier)
                    return false;
                const existingNode = this.client.manager.nodes.find((n) => n.options.identifier === config.identifier);
                if (existingNode) {
                    this.client.manager.removeNode(config.identifier);
                }
                const nodeOptions = {
                    identifier: config.identifier,
                    host: config.host,
                    port: config.port,
                    password: config.password,
                    secure: config.secure || false,
                    retryAmount: 3,
                    retryDelay: 5000,
                    requestTimeout: 10000,
                };
                const node = this.client.manager.addNode(nodeOptions);
                node.on('connect', () => {
                    this.client.logger.info(`[LAVALINK] User node connected: ${config.identifier}`);
                    this.resetRetryCount(userId);
                });
                node.on('error', (error) => {
                    this.client.logger.error(`[LAVALINK] User node error: ${config.identifier} - ${error.message}`);
                    this.handleNodeFailure(config.identifier);
                });
                node.on('disconnect', () => {
                    this.client.logger.warn(`[LAVALINK] User node disconnected: ${config.identifier}`);
                    this.handleNodeFailure(config.identifier);
                });
                return true;
            }
            catch (error) {
                this.client.logger.error(`[LAVALINK] Error registering node: ${error}`);
                return false;
            }
        };
        this.unregisterNodeFromManager = (nodeId) => {
            try {
                const node = this.client.manager.nodes.find((n) => n.options.identifier === nodeId);
                if (node) {
                    this.client.manager.removeNode(nodeId);
                    this.client.logger.info(`[LAVALINK] Unregistered user node: ${nodeId}`);
                }
            }
            catch (error) {
                this.client.logger.error(`[LAVALINK] Error unregistering node: ${error}`);
            }
        };
        this.extractUserIdFromNodeId = (nodeId) => {
            const match = nodeId.match(/^user_(\d+)_\d+$/);
            return match ? match[1] : null;
        };
        this.client = client;
    }
}
exports.LavaLink = LavaLink;
