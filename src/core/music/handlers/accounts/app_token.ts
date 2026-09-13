import axios from 'axios';

import { ConfigManager } from '../../../../utils/config';

const configManager = ConfigManager.getInstance();

let cached: string | null = null;
let expiresAt = 0;
let inFlight: Promise<string | null> | null = null;

const fetchAppToken = async (): Promise<string | null> => {
	try {
		const auth = Buffer.from(`${configManager.getSpotifyClientId()}:${configManager.getSpotifyClientSecret()}`).toString('base64');
		const { data } = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` } });
		cached = data.access_token;
		expiresAt = Date.now() + Math.max(0, (data.expires_in ?? 3600) - 60) * 1000;
		return cached;
	} catch {
		cached = null;
		expiresAt = 0;
		return null;
	}
};

export const getAppToken = async (): Promise<string | null> => {
	if (cached && Date.now() < expiresAt) return cached;
	if (inFlight) return inFlight;
	inFlight = fetchAppToken().finally(() => {
		inFlight = null;
	});
	return inFlight;
};

export const resetAppToken = (): void => {
	cached = null;
	expiresAt = 0;
};
