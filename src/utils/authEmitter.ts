import { EventEmitter } from 'events';
import discord from 'discord.js';

export const AUTH_RESULT_EVENT = 'pepperAuthResult';

export const authEmitter = new EventEmitter();
authEmitter.setMaxListeners(100);

export const waitForAuth = (state: string, timeout: number): Promise<'success' | 'failed' | 'timeout'> => {
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			authEmitter.removeAllListeners(`auth:${state}`);
			resolve('timeout');
		}, timeout);
		authEmitter.once(`auth:${state}`, (data: { status: string }) => {
			clearTimeout(timer);
			resolve(data.status === 'success' ? 'success' : 'failed');
		});
	});
};

export const emitAuthResult = (state: string, status: 'success' | 'failed') => authEmitter.emit(`auth:${state}`, { status });

/**
 * Bridges the cross-shard client event back onto the local emitter. Must be
 * called once per shard while the client is being built.
 */
export const registerAuthBridge = (client: discord.Client): void => {
	(client as unknown as EventEmitter).on(AUTH_RESULT_EVENT, (state: string, status: 'success' | 'failed') => emitAuthResult(state, status));
};

/**
 * Delivers an auth result to every shard. The OAuth callback lands on whichever
 * shard hosts the API server, but the /login listener lives on the shard that
 * handled the interaction, so the result has to be fanned out.
 */
export const broadcastAuthResult = async (client: discord.Client, state: string, status: 'success' | 'failed'): Promise<void> => {
	if (!client.shard) return void emitAuthResult(state, status);

	await client.shard
		.broadcastEval(
			(c, context) => {
				(c as unknown as { emit: (event: string, ...args: unknown[]) => boolean }).emit(context.event, context.state, context.status);
			},
			{ context: { event: AUTH_RESULT_EVENT, state, status } },
		)
		.catch((error) => client.logger?.warn(`[AUTH] Failed to broadcast auth result for ${state}: ${error}`));
};
