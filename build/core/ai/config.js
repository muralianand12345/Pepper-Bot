"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIConfig = void 0;
const DEFAULTS = {
    enabled: false,
    model: 'gpt-5.4-mini',
    reasoning_effort: 'none',
    temperature: null,
    max_output_tokens: 2000,
    timeout_ms: 15000,
    daily_limit: 5000,
    autoplay: { enabled: true, candidates: 25, daily_limit_per_guild: 150 },
};
const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high'];
const clamp = (value, min, max, fallback) => {
    const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return Math.min(max, Math.max(min, num));
};
const getAIConfig = (client) => {
    const raw = client.config?.ai ?? {};
    const effort = raw.reasoning_effort === undefined ? DEFAULTS.reasoning_effort : raw.reasoning_effort;
    return {
        enabled: raw.enabled ?? DEFAULTS.enabled,
        model: typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : DEFAULTS.model,
        reasoning_effort: effort && REASONING_EFFORTS.includes(effort) ? effort : null,
        temperature: typeof raw.temperature === 'number' ? clamp(raw.temperature, 0, 2, 1) : null,
        max_output_tokens: raw.max_output_tokens === null ? null : Math.floor(clamp(raw.max_output_tokens, 100, 32000, DEFAULTS.max_output_tokens)),
        timeout_ms: Math.floor(clamp(raw.timeout_ms, 1000, 120000, DEFAULTS.timeout_ms)),
        daily_limit: Math.floor(clamp(raw.daily_limit, 0, 1_000_000, DEFAULTS.daily_limit)),
        autoplay: {
            enabled: raw.autoplay?.enabled ?? DEFAULTS.autoplay.enabled,
            candidates: Math.floor(clamp(raw.autoplay?.candidates, 5, 50, DEFAULTS.autoplay.candidates)),
            daily_limit_per_guild: Math.floor(clamp(raw.autoplay?.daily_limit_per_guild, 0, 100_000, DEFAULTS.autoplay.daily_limit_per_guild)),
        },
    };
};
exports.getAIConfig = getAIConfig;
