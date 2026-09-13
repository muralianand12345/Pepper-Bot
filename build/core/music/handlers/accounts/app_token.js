"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetAppToken = exports.getAppToken = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../../../utils/config");
const configManager = config_1.ConfigManager.getInstance();
let cached = null;
let expiresAt = 0;
let inFlight = null;
const fetchAppToken = async () => {
    try {
        const auth = Buffer.from(`${configManager.getSpotifyClientId()}:${configManager.getSpotifyClientSecret()}`).toString('base64');
        const { data } = await axios_1.default.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` } });
        cached = data.access_token;
        expiresAt = Date.now() + Math.max(0, (data.expires_in ?? 3600) - 60) * 1000;
        return cached;
    }
    catch {
        cached = null;
        expiresAt = 0;
        return null;
    }
};
const getAppToken = async () => {
    if (cached && Date.now() < expiresAt)
        return cached;
    if (inFlight)
        return inFlight;
    inFlight = fetchAppToken().finally(() => {
        inFlight = null;
    });
    return inFlight;
};
exports.getAppToken = getAppToken;
const resetAppToken = () => {
    cached = null;
    expiresAt = 0;
};
exports.resetAppToken = resetAppToken;
