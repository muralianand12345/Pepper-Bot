import { EventEmitter } from 'events';

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
