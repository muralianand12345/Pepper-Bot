"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadioService = exports.RadioBrowser = void 0;
const radio_browser_1 = require("./providers/radio_browser");
const stations_1 = require("./stations");
__exportStar(require("./state"), exports);
__exportStar(require("./session"), exports);
__exportStar(require("./reconnect"), exports);
__exportStar(require("./stations"), exports);
var radio_browser_2 = require("./providers/radio_browser");
Object.defineProperty(exports, "RadioBrowser", { enumerable: true, get: function () { return radio_browser_2.RadioBrowser; } });
const FREQUENCY_REGEX = /^\d{2,3}(?:[.,]\d)?$/;
const MAX_RESULTS = 25;
class RadioService {
    constructor(client) {
        this.search = async (query, options = {}) => {
            const trimmed = query.trim();
            if (!trimmed)
                return { status: 'ok', stations: [...stations_1.CURATED_STATIONS].slice(0, MAX_RESULTS) };
            const isFrequency = RadioService.isFrequency(trimmed);
            const countryCode = options.countryCode ?? null;
            const curated = (0, stations_1.searchCurated)(trimmed, countryCode);
            const remaining = MAX_RESULTS - curated.length;
            let remote = [];
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
            if (stations.length)
                return { status: 'ok', stations };
            return { status: isFrequency ? 'frequency_empty' : 'empty', stations: [] };
        };
        this.getById = async (id) => {
            const curated = (0, stations_1.findCuratedById)(id);
            if (curated)
                return curated;
            return this.browser.getByUuid(id);
        };
        this.resolveInput = async (input, options = {}) => {
            const trimmed = input.trim();
            if (!trimmed)
                return { status: 'empty', stations: [] };
            const byId = await this.getById(trimmed);
            if (byId)
                return { status: 'ok', stations: [byId] };
            if (/^https?:\/\//i.test(trimmed)) {
                return {
                    status: 'ok',
                    stations: [{ id: trimmed, name: 'Custom Stream', genre: 'Radio', country: null, url: trimmed, codec: 'Unknown', bitrate: 0, artworkUrl: null, homepage: null, source: 'radiobrowser' }],
                };
            }
            return this.search(trimmed, options);
        };
        this.reportPlay = (station) => {
            if (station.source === 'radiobrowser')
                this.browser.reportClick(station.id);
        };
        this.client = client;
        this.browser = new radio_browser_1.RadioBrowser(client);
    }
}
exports.RadioService = RadioService;
RadioService.isFrequency = (query) => FREQUENCY_REGEX.test(query.trim());
