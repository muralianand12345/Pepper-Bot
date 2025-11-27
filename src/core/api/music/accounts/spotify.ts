import express from 'express';
import discord from 'discord.js';

import { SpotifyManager } from '../../../music';

export default class SpotifyAPIHandler {
	private client: discord.Client;
    private router: express.Router;

	constructor(client: discord.Client) {
		this.client = client;
		this.router = express.Router();
		this.setupRoutes();
	}

	private setupRoutes = (): void => {
		this.router.get('/callback', this.handleCallback);
	};

	private handleCallback = async (req: express.Request, res: express.Response): Promise<void> => {
		const { code, state, error } = req.query;

		if (error) {
			res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Spotify Login Failed</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: #1a1a1a;
                color: #fff;
              }
              .container {
                text-align: center;
                padding: 40px;
                background: #2a2a2a;
                border-radius: 10px;
              }
              h1 { color: #ff4444; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Login Failed</h1>
              <p>Authorization was denied or an error occurred.</p>
              <p>You can close this tab.</p>
            </div>
          </body>
        </html>
      `);
			return;
		}

		if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
			res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invalid Request</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: #1a1a1a;
                color: #fff;
              }
              .container {
                text-align: center;
                padding: 40px;
                background: #2a2a2a;
                border-radius: 10px;
              }
              h1 { color: #ff4444; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Invalid Request</h1>
              <p>Missing required parameters.</p>
              <p>You can close this tab.</p>
            </div>
          </body>
        </html>
      `);
			return;
		}

		const userId = SpotifyManager.validateState(state);

		if (!userId) {
			res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invalid State</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: #1a1a1a;
                color: #fff;
              }
              .container {
                text-align: center;
                padding: 40px;
                background: #2a2a2a;
                border-radius: 10px;
              }
              h1 { color: #ff4444; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Invalid or Expired Session</h1>
              <p>The login session has expired or is invalid.</p>
              <p>Please try logging in again.</p>
            </div>
          </body>
        </html>
      `);
			return;
		}

		const tokens = await new SpotifyManager(this.client).exchangeCodeForTokens(code);

		if (!tokens) {
			res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Login Error</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: #1a1a1a;
                color: #fff;
              }
              .container {
                text-align: center;
                padding: 40px;
                background: #2a2a2a;
                border-radius: 10px;
              }
              h1 { color: #ff4444; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Login Error</h1>
              <p>Failed to exchange authorization code.</p>
              <p>Please try again later.</p>
            </div>
          </body>
        </html>
      `);
			return;
		}

		const username = await new SpotifyManager(this.client).getSpotifyUsername(tokens.access);
		const saved = await new SpotifyManager(this.client).saveAccount(userId, tokens, username || undefined);

		if (!saved) {
			res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Save Error</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: #1a1a1a;
                color: #fff;
              }
              .container {
                text-align: center;
                padding: 40px;
                background: #2a2a2a;
                border-radius: 10px;
              }
              h1 { color: #ff4444; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Save Error</h1>
              <p>Failed to save account information.</p>
              <p>Please try again later.</p>
            </div>
          </body>
        </html>
      `);
			return;
		}

		res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Login Successful</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #1a1a1a;
              color: #fff;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: #2a2a2a;
              border-radius: 10px;
            }
            h1 { color: #1DB954; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Login Successful</h1>
            <p>Your Spotify account has been linked successfully!</p>
            <p><strong>Username:</strong> ${username || 'Unknown'}</p>
            <p>You can close this tab and return to Discord.</p>
          </div>
        </body>
      </html>
    `);
	};

	getRouter = (): express.Router => {
		return this.router;
	};
}
