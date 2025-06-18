import discord from 'discord.js';
import magmastream from 'magmastream';

import { IUserLavalink } from '../../types';
import music_user from '../../events/database/schema/music_user';

export class LavaLink {
	private client: discord.Client;
	private readonly maxRetries: number = 5;

	constructor(client: discord.Client) {
		this.client = client;
	}

	public addUserLavalink = async (userId: string, config: Omit<IUserLavalink, 'retryCount' | 'isActive' | 'addedAt'>): Promise<{ success: boolean; error?: string; nodeId?: string }> => {
		try {
			const testResult = await this.testConnection(config);
			if (!testResult.success) {
				return { success: false, error: testResult.error };
			}

			const identifier = `user_${userId}_${Date.now()}`;
			const nodeConfig: IUserLavalink = {
				...config,
				identifier,
				retryCount: 0,
				isActive: true,
				addedAt: new Date(),
			};

			await music_user.findOneAndUpdate({ userId }, { lavalink: nodeConfig }, { upsert: true, new: true });

			const success = await this.registerNodeWithManager(userId, nodeConfig);
			if (!success) {
				return { success: false, error: 'Failed to register node with manager' };
			}

			this.client.logger.info(`[LAVALINK] User ${userId} added personal Lavalink: ${identifier}`);
			return { success: true, nodeId: identifier };
		} catch (error) {
			this.client.logger.error(`[LAVALINK] Error adding user Lavalink: ${error}`);
			return { success: false, error: 'Internal error occurred' };
		}
	};

	public removeUserLavalink = async (userId: string): Promise<{ success: boolean; error?: string }> => {
		try {
			const user = await music_user.findOne({ userId });
			if (!user?.lavalink?.identifier) {
				return { success: false, error: 'No personal Lavalink found' };
			}

			const nodeId = user.lavalink.identifier;

			const activePlayer = Array.from(this.client.manager.players.values()).find((player) => player.node.options.identifier === nodeId);

			if (activePlayer) {
				return { success: false, error: 'Cannot remove Lavalink while music is playing on it' };
			}

			this.unregisterNodeFromManager(nodeId);

			await music_user.findOneAndUpdate({ userId }, { $unset: { lavalink: 1 } });

			this.client.logger.info(`[LAVALINK] User ${userId} removed personal Lavalink: ${nodeId}`);
			return { success: true };
		} catch (error) {
			this.client.logger.error(`[LAVALINK] Error removing user Lavalink: ${error}`);
			return { success: false, error: 'Internal error occurred' };
		}
	};

	public getUserLavalink = async (userId: string): Promise<IUserLavalink | null> => {
		try {
			const user = await music_user.findOne({ userId });
			return user?.lavalink || null;
		} catch (error) {
			this.client.logger.error(`[LAVALINK] Error getting user Lavalink: ${error}`);
			return null;
		}
	};

	public getOptimalNodeForUser = async (userId: string, guildId: string): Promise<string | null> => {
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

	public handleNodeFailure = async (nodeId: string): Promise<void> => {
		try {
			if (!nodeId.startsWith('user_')) return;

			const userId = this.extractUserIdFromNodeId(nodeId);
			if (!userId) return;

			const user = await music_user.findOne({ userId });
			if (!user?.lavalink) return;

			const newRetryCount = (user.lavalink.retryCount || 0) + 1;

			if (newRetryCount >= this.maxRetries && user.lavalink.autoFallback) {
				await music_user.findOneAndUpdate(
					{ userId },
					{
						'lavalink.isActive': false,
						'lavalink.retryCount': newRetryCount,
						'lavalink.lastError': 'Exceeded retry limit - auto-disabled',
					}
				);

				this.client.logger.warn(`[LAVALINK] Auto-disabled user Lavalink for ${userId} after ${this.maxRetries} failures`);
			} else {
				await music_user.findOneAndUpdate({ userId }, { 'lavalink.retryCount': newRetryCount });
			}
		} catch (error) {
			this.client.logger.error(`[LAVALINK] Error handling node failure: ${error}`);
		}
	};

	public resetRetryCount = async (userId: string): Promise<void> => {
		try {
			await music_user.findOneAndUpdate({ userId }, { 'lavalink.retryCount': 0, 'lavalink.lastError': null });
		} catch (error) {
			this.client.logger.error(`[LAVALINK] Error resetting retry count: ${error}`);
		}
	};

	public initializeUserNodes = async (): Promise<void> => {
		try {
			const usersWithLavalink = await music_user.find({ 'lavalink.isActive': true });

			for (const user of usersWithLavalink) {
				if (user.lavalink) {
					await this.registerNodeWithManager(user.userId, user.lavalink);
				}
			}

			this.client.logger.info(`[LAVALINK] Initialized ${usersWithLavalink.length} user Lavalink nodes`);
		} catch (error) {
			this.client.logger.error(`[LAVALINK] Error initializing user nodes: ${error}`);
		}
	};

	private testConnection = async (config: Omit<IUserLavalink, 'retryCount' | 'isActive' | 'addedAt'>): Promise<{ success: boolean; error?: string }> => {
		try {
			const testNode = new magmastream.Node({
				identifier: `test_${Date.now()}`,
				host: config.host!,
				port: config.port!,
				password: config.password!,
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

				testNode.once('error', (error: Error) => {
					clearTimeout(timeout);
					testNode.destroy();
					resolve({ success: false, error: error.message });
				});

				testNode.connect();
			});
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
		}
	};

	private registerNodeWithManager = async (userId: string, config: IUserLavalink): Promise<boolean> => {
		try {
			if (!config.identifier) return false;

			const existingNode = this.client.manager.nodes.find((n) => n.options.identifier === config.identifier);
			if (existingNode) {
				this.client.manager.removeNode(config.identifier);
			}

			const nodeOptions: magmastream.NodeOptions = {
				identifier: config.identifier,
				host: config.host!,
				port: config.port!,
				password: config.password!,
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

			node.on('error', (error: Error) => {
				this.client.logger.error(`[LAVALINK] User node error: ${config.identifier} - ${error.message}`);
				this.handleNodeFailure(config.identifier!);
			});

			node.on('disconnect', () => {
				this.client.logger.warn(`[LAVALINK] User node disconnected: ${config.identifier}`);
				this.handleNodeFailure(config.identifier!);
			});

			return true;
		} catch (error) {
			this.client.logger.error(`[LAVALINK] Error registering node: ${error}`);
			return false;
		}
	};

	private unregisterNodeFromManager = (nodeId: string): void => {
		try {
			const node = this.client.manager.nodes.find((n) => n.options.identifier === nodeId);
			if (node) {
				this.client.manager.removeNode(nodeId);
				this.client.logger.info(`[LAVALINK] Unregistered user node: ${nodeId}`);
			}
		} catch (error) {
			this.client.logger.error(`[LAVALINK] Error unregistering node: ${error}`);
		}
	};

	private extractUserIdFromNodeId = (nodeId: string): string | null => {
		const match = nodeId.match(/^user_(\d+)_\d+$/);
		return match ? match[1] : null;
	};
}
