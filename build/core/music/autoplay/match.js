"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SongSet = exports.isSameSong = exports.songKey = exports.isVariant = exports.primaryArtist = exports.plainTitle = exports.normalizeTitle = exports.normalizeText = void 0;
const VARIANT_PATTERN = /\b(karaoke|instrumental|8d|sped ?up|slowed|reverb|nightcore|lo-?fi|remix|cover|live|bass ?boosted)\b/i;
const BRACKETED = /[([{][^)\]}]*[)\]}]/g;
const stripDiacritics = (value) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '');
const normalizeText = (value) => stripDiacritics(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
exports.normalizeText = normalizeText;
const normalizeTitle = (title) => {
    let base = (title || '').replace(BRACKETED, ' ');
    const dash = base.indexOf(' - ');
    if (dash !== -1)
        base = base.slice(0, dash);
    base = base.replace(/\s(feat|ft)\.?\s.*$/i, '');
    return (0, exports.normalizeText)(base) || (0, exports.normalizeText)(title);
};
exports.normalizeTitle = normalizeTitle;
const plainTitle = (title) => (title || '')
    .replace(BRACKETED, ' ')
    .replace(/\s+/g, ' ')
    .trim() || title;
exports.plainTitle = plainTitle;
const primaryArtist = (artist) => {
    const first = (artist || '').split(/,|&|\/|;|\s+(?:feat\.?|ft\.?|x)\s+/i)[0] ?? '';
    return (0, exports.normalizeText)(first);
};
exports.primaryArtist = primaryArtist;
const isVariant = (title) => {
    const extras = [...(title || '').matchAll(BRACKETED)].map((match) => match[0]);
    const dash = (title || '').indexOf(' - ');
    if (dash !== -1)
        extras.push(title.slice(dash + 3));
    return extras.some((part) => VARIANT_PATTERN.test(part));
};
exports.isVariant = isVariant;
const songKey = (ref) => `${(0, exports.normalizeTitle)(ref.title)}|${(0, exports.primaryArtist)(ref.artist)}`;
exports.songKey = songKey;
const normalizeRef = (ref) => ({ title: (0, exports.normalizeTitle)(ref.title), primary: (0, exports.primaryArtist)(ref.artist), artist: (0, exports.normalizeText)(ref.artist) });
const sameSong = (a, b) => {
    if (!a.title || a.title !== b.title)
        return false;
    if (!a.primary || !b.primary)
        return true;
    return a.primary === b.primary || a.artist.includes(b.primary) || b.artist.includes(a.primary);
};
const isSameSong = (a, b) => sameSong(normalizeRef(a), normalizeRef(b));
exports.isSameSong = isSameSong;
class SongSet {
    constructor(refs = []) {
        this.entries = [];
        this.add = (ref) => {
            const normalized = normalizeRef(ref);
            if (normalized.title)
                this.entries.push(normalized);
        };
        this.has = (ref) => {
            const normalized = normalizeRef(ref);
            return this.entries.some((entry) => sameSong(entry, normalized));
        };
        for (const ref of refs)
            this.add(ref);
    }
}
exports.SongSet = SongSet;
