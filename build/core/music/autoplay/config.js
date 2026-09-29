"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAutoplayConfig = void 0;
const DEFAULTS = {
    batch_size: 5,
    favorites_per_batch: 1,
    refill_below: 2,
    history_days: 90,
    early_skip_seconds: 30,
    seeds: { session: 5, listeners: 2, server: 1 },
};
const clamp = (value, min, max, fallback) => {
    const num = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.min(max, Math.max(min, num));
};
const getAutoplayConfig = (client) => {
    const raw = client.config?.music?.autoplay ?? {};
    const batchSize = clamp(raw.batch_size, 1, 10, DEFAULTS.batch_size);
    return {
        batch_size: batchSize,
        favorites_per_batch: clamp(raw.favorites_per_batch, 0, batchSize - 1, DEFAULTS.favorites_per_batch),
        refill_below: clamp(raw.refill_below, 1, 10, DEFAULTS.refill_below),
        history_days: clamp(raw.history_days, 1, 3650, DEFAULTS.history_days),
        early_skip_seconds: clamp(raw.early_skip_seconds, 0, 600, DEFAULTS.early_skip_seconds),
        seeds: {
            session: clamp(raw.seeds?.session, 1, 10, DEFAULTS.seeds.session),
            listeners: clamp(raw.seeds?.listeners, 0, 10, DEFAULTS.seeds.listeners),
            server: clamp(raw.seeds?.server, 0, 10, DEFAULTS.seeds.server),
        },
    };
};
exports.getAutoplayConfig = getAutoplayConfig;
