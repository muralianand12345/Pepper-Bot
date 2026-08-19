import path from 'path';
import discord from 'discord.js';

import { Logger } from './utils/logger';
import { ConfigManager } from './utils/config';

const botPath = path.join(__dirname, 'main.js');
const configManager = ConfigManager.getInstance();
const logger = new Logger();
const manager = new discord.ShardingManager(botPath, { token: configManager.getToken(), totalShards: 'auto', respawn: true });

const attachShardListeners = (shard: discord.Shard): void => {
	shard.on(discord.ShardEvents.Message, (message) => logger.debug(`[INDEX] (SHARD ${shard.id}) ${message._eval} => ${message._result}`));
	shard.on(discord.ShardEvents.Error, (error: Error) => logger.error(`[INDEX] Shard ${shard.id} errored: ${error.message}`));
	shard.on(discord.ShardEvents.Death, (child) => logger.error(`[INDEX] Shard ${shard.id} died (code ${'exitCode' in child ? (child.exitCode ?? 'unknown') : 'unknown'}), respawning...`));
	shard.on(discord.ShardEvents.Disconnect, () => logger.warn(`[INDEX] Shard ${shard.id} disconnected`));
	shard.on(discord.ShardEvents.Reconnecting, () => logger.warn(`[INDEX] Shard ${shard.id} reconnecting`));
	shard.on(discord.ShardEvents.Ready, () => logger.success(`[INDEX] Shard ${shard.id} ready`));
};

manager.on('shardCreate', (shard: discord.Shard) => {
	logger.info(`[INDEX] Launched shard ${shard.id}`);
	attachShardListeners(shard);
});

manager
	.spawn()
	.then((shards: discord.Collection<number, discord.Shard>) => logger.success(`[INDEX] Spawned ${shards.size} shard(s)`))
	.catch((error: Error) => {
		logger.error(`[INDEX] Failed to spawn shards: ${error}`);
		process.exit(1);
	});
