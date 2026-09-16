import discord from 'discord.js';

import { RadioBrowser } from './providers/radio_browser';
import { CURATED_STATIONS, findCuratedById, searchCurated } from './stations';
import { RadioSearchOptions, RadioSearchResult, RadioStation } from '../../../types';

export * from './state';
export * from './session';
export * from './reconnect';
export * from './stations';
export { RadioBrowser } from './providers/radio_browser';

const FREQUENCY_REGEX = /^\d{2,3}(?:[.,]\d)?$/;

const MAX_RESULTS = 25;

export class RadioService {
	private readonly client: discord.Client;
	private readonly browser: RadioBrowser;

	constructor(client: discord.Client) {
		this.client = client;
		this.browser = new RadioBrowser(client);
	}

	public static isFrequency = (query: string): boolean => FREQUENCY_REGEX.test(query.trim());

	public search = async (query: string, options: RadioSearchOptions = {}): Promise<RadioSearchResult> => {
		const trimmed = query.trim();
		if (!trimmed) return { status: 'ok', stations: [...CURATED_STATIONS].slice(0, MAX_RESULTS) };

		const isFrequency = RadioService.isFrequency(trimmed);
		const countryCode = options.countryCode ?? null;
		const curated = searchCurated(trimmed, countryCode);
		const remaining = MAX_RESULTS - curated.length;

		let remote: RadioStation[] = [];
		if (remaining > 0) {
			remote = await this.browser.search(trimmed, { countryCode: isFrequency ? countryCode : null, limit: remaining + 10 });

			const seenUrls = new Set(curated.map((station) => station.url));
			const seenNames = new Set(curated.map((station) => station.name.toLowerCase()));
			remote = remote.filter((station) => !seenUrls.has(station.url) && !seenNames.has(station.name.toLowerCase()));

			if (countryCode && !isFrequency) {
				const local = remote.filter((station) => station.country === countryCode);
				const rest = remote.filter((station) => station.country !== countryCode);
				remote = [...local, ...rest];
			}

			remote = remote.slice(0, remaining);
		}

		const stations = [...curated, ...remote];
		if (stations.length) return { status: 'ok', stations };
		return { status: isFrequency ? 'frequency_empty' : 'empty', stations: [] };
	};

	public getById = async (id: string): Promise<RadioStation | null> => {
		const curated = findCuratedById(id);
		if (curated) return curated;
		return this.browser.getByUuid(id);
	};

	public resolveInput = async (input: string, options: RadioSearchOptions = {}): Promise<RadioSearchResult> => {
		const trimmed = input.trim();
		if (!trimmed) return { status: 'empty', stations: [] };

		const byId = await this.getById(trimmed);
		if (byId) return { status: 'ok', stations: [byId] };

		if (/^https?:\/\//i.test(trimmed)) {
			return {
				status: 'ok',
				stations: [{ id: trimmed, name: 'Custom Stream', genre: 'Radio', country: null, url: trimmed, codec: 'Unknown', bitrate: 0, artworkUrl: null, homepage: null, source: 'radiobrowser' }],
			};
		}

		return this.search(trimmed, options);
	};

	public reportPlay = (station: RadioStation): void => {
		if (station.source === 'radiobrowser') this.browser.reportClick(station.id);
	};
}
