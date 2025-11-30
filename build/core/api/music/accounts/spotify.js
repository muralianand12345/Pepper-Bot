"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const view_1 = require("../view");
const music_1 = require("../../../music");
const authEmitter_1 = require("../../../../utils/authEmitter");
class SpotifyAPIHandler {
    constructor(client) {
        this.setupRoutes = () => {
            this.router.get('/callback', this.handleCallback);
        };
        this.handleCallback = async (req, res) => {
            const { code, state, error } = req.query;
            if (error) {
                const userId = music_1.SpotifyManager.validateState(state);
                if (userId)
                    (0, authEmitter_1.emitAuthResult)(userId, 'failed');
                res.status(400).send((0, view_1.generateHTML)({
                    title: 'Spotify Login Failed',
                    icon: '✕',
                    iconColor: 'error',
                    heading: 'Authorization Denied',
                    message: 'The authorization request was denied or an error occurred during the process.',
                    submessage: 'You can safely close this tab.',
                    platformLogo: this.spotifyLogo,
                }));
                return;
            }
            if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
                res.status(400).send((0, view_1.generateHTML)({
                    title: 'Invalid Request',
                    icon: '⚠',
                    iconColor: 'warning',
                    heading: 'Invalid Request',
                    message: 'The request is missing required parameters. Please try the login process again.',
                    submessage: 'You can safely close this tab.',
                    platformLogo: this.spotifyLogo,
                }));
                return;
            }
            const userId = music_1.SpotifyManager.validateState(state);
            if (!userId) {
                res.status(400).send((0, view_1.generateHTML)({
                    title: 'Session Expired',
                    icon: '⏱',
                    iconColor: 'warning',
                    heading: 'Session Expired',
                    message: 'Your login session has expired or is invalid. Please initiate a new login from Discord.',
                    submessage: 'You can safely close this tab.',
                    platformLogo: this.spotifyLogo,
                }));
                return;
            }
            const spotifyManager = new music_1.SpotifyManager(this.client);
            const tokens = await spotifyManager.exchangeCodeForTokens(code);
            if (!tokens) {
                (0, authEmitter_1.emitAuthResult)(userId, 'failed');
                res.status(500).send((0, view_1.generateHTML)({
                    title: 'Connection Error',
                    icon: '✕',
                    iconColor: 'error',
                    heading: 'Connection Failed',
                    message: "We couldn't complete the authorization with Spotify. Please try again in a few moments.",
                    submessage: 'You can safely close this tab.',
                    platformLogo: this.spotifyLogo,
                }));
                return;
            }
            const username = await spotifyManager.getSpotifyUsername(tokens.access);
            const saved = await spotifyManager.saveAccount(userId, tokens, username || undefined);
            if (!saved) {
                (0, authEmitter_1.emitAuthResult)(userId, 'failed');
                res.status(500).send((0, view_1.generateHTML)({
                    title: 'Save Error',
                    icon: '✕',
                    iconColor: 'error',
                    heading: 'Save Failed',
                    message: "Your account was authorized but we couldn't save the connection. Please try again.",
                    submessage: 'You can safely close this tab.',
                    platformLogo: this.spotifyLogo,
                }));
                return;
            }
            (0, authEmitter_1.emitAuthResult)(userId, 'success');
            res.status(200).send((0, view_1.generateHTML)({
                title: 'Successfully Connected',
                icon: '✓',
                iconColor: 'success',
                heading: 'Successfully Connected!',
                message: 'Your Spotify account has been linked to your Discord profile.',
                username: username || 'Spotify User',
                submessage: 'You can safely close this tab and return to Discord.',
                platformLogo: this.spotifyLogo,
            }));
        };
        this.getRouter = () => {
            return this.router;
        };
        this.client = client;
        this.router = express_1.default.Router();
        this.spotifyLogo =
            '<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>';
        this.setupRoutes();
    }
}
exports.default = SpotifyAPIHandler;
