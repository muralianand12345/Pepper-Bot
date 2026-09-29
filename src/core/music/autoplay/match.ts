import { AutoplaySongRef } from '../../../types';

const VARIANT_PATTERN = /\b(karaoke|instrumental|8d|sped ?up|slowed|reverb|nightcore|lo-?fi|remix|cover|live|bass ?boosted)\b/i;
const BRACKETED = /[([{][^)\]}]*[)\]}]/g;

const stripDiacritics = (value: string): string => value.normalize('NFKD').replace(/[̀-ͯ]/g, '');

export const normalizeText = (value: string): string =>
	stripDiacritics(value || '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '');

export const normalizeTitle = (title: string): string => {
	let base = (title || '').replace(BRACKETED, ' ');
	const dash = base.indexOf(' - ');
	if (dash !== -1) base = base.slice(0, dash);
	base = base.replace(/\s(feat|ft)\.?\s.*$/i, '');
	return normalizeText(base) || normalizeText(title);
};

export const plainTitle = (title: string): string =>
	(title || '')
		.replace(BRACKETED, ' ')
		.replace(/\s+/g, ' ')
		.trim() || title;

export const primaryArtist = (artist: string): string => {
	const first = (artist || '').split(/,|&|\/|;|\s+(?:feat\.?|ft\.?|x)\s+/i)[0] ?? '';
	return normalizeText(first);
};

export const isVariant = (title: string): boolean => {
	const extras = [...(title || '').matchAll(BRACKETED)].map((match) => match[0]);
	const dash = (title || '').indexOf(' - ');
	if (dash !== -1) extras.push(title.slice(dash + 3));
	return extras.some((part) => VARIANT_PATTERN.test(part));
};

export const songKey = (ref: AutoplaySongRef): string => `${normalizeTitle(ref.title)}|${primaryArtist(ref.artist)}`;

interface NormalizedRef {
	title: string;
	primary: string;
	artist: string;
}

const normalizeRef = (ref: AutoplaySongRef): NormalizedRef => ({ title: normalizeTitle(ref.title), primary: primaryArtist(ref.artist), artist: normalizeText(ref.artist) });

const sameSong = (a: NormalizedRef, b: NormalizedRef): boolean => {
	if (!a.title || a.title !== b.title) return false;
	if (!a.primary || !b.primary) return true;
	return a.primary === b.primary || a.artist.includes(b.primary) || b.artist.includes(a.primary);
};

export const isSameSong = (a: AutoplaySongRef, b: AutoplaySongRef): boolean => sameSong(normalizeRef(a), normalizeRef(b));

export class SongSet {
	private entries: NormalizedRef[] = [];

	constructor(refs: AutoplaySongRef[] = []) {
		for (const ref of refs) this.add(ref);
	}

	public add = (ref: AutoplaySongRef): void => {
		const normalized = normalizeRef(ref);
		if (normalized.title) this.entries.push(normalized);
	};

	public has = (ref: AutoplaySongRef): boolean => {
		const normalized = normalizeRef(ref);
		return this.entries.some((entry) => sameSong(entry, normalized));
	};
}
