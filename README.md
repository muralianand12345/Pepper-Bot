<div align="center">

# 🎵 Pepper Bot

**A Discord music bot with smart autoplay, live radio, custom playlists and listening analytics.**

![Version](https://img.shields.io/badge/version-5.15.2-blue)
![Discord.js](https://img.shields.io/badge/discord.js-v14.27-5865F2?logo=discord&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/license-Apache--2.0-green)

[Support Server](https://discord.gg/XzE9hSbsNb) · [Report a Bug](https://github.com/muralianand12345/Pepper-Bot/issues) · [Contributing](CONTRIBUTING.md)

</div>

---

## 📑 Table of Contents

- [Features](#-features)
- [Commands](#-commands)
- [Getting Started](#-getting-started)
- [Configuration](#%EF%B8%8F-configuration)
- [REST API](#-rest-api)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

## ✨ Features

### 🎶 Music playback

- **Lavalink audio.** Streams through [Lavalink](https://github.com/lavalink-devs/Lavalink) and uses the least-loaded node when you run several.
- **Many sources.** Search or paste links from Spotify, SoundCloud, Bandcamp, Deezer, Apple Music and any other source your Lavalink node's plugins support.
- **Smart autoplay.** When the queue ends, it keeps playing related tracks based on what was just played.
- **11 audio filters.** Bass Boost, Nightcore, Vaporwave, 8D, Karaoke, and more.
- **Interactive queue.** Page through the queue and shuffle, move, remove or clear tracks with buttons.
- **Lyrics.** Shows the lyrics of the song that is playing.
- **Empty channel handling.** Pauses when everyone leaves and disconnects after 5 minutes.
- **Survives restarts.** Player state is kept in Redis, so playback resumes after the bot restarts.

### 📻 Live radio

- **40 checked stations.** Includes SomaFM, All India Radio, Bollywood, Tamil, lo-fi, jazz, classical, hip-hop, EDM, rock and more.
- **~50,000 more stations.** Search the [Radio Browser](https://www.radio-browser.info/) directory by name, genre or country, or paste a stream URL.
- **Auto-reconnect.** If a stream drops, the bot reconnects to the same station.
- **Separate stats.** Radio listening is tracked apart from music, so it doesn't change your charts or autoplay.

### 📂 Custom playlists

- **Your own playlists.** Create, rename, reorder and delete them.
- **Sharing.** Make a playlist public and share its code. Anyone can paste the code into `/play`.
- **Transfers.** Hand a playlist to another user. They accept the transfer by DM.
- **Spotify link.** Connect your Spotify account with `/login` and your public playlists appear in `/play`.

### 📊 Analytics

- **Charts.** Top tracks and artists for you, your server, or all servers.
- **CSV export.** Download your listening history.
- **Stats API.** A REST API with realtime and historical usage stats. See [REST API](#-rest-api).

### 🌍 Localization

Every command and reply is translated into **7 languages**:

| 🇺🇸 English | 🇪🇸 Español | 🇫🇷 Français | 🇩🇪 Deutsch | 🇧🇷 Português | 🇷🇺 Русский | 🇻🇳 Tiếng Việt |
| :---------: | :--------: | :---------: | :--------: | :----------: | :--------: | :-----------: |

The language is detected automatically. Users and servers can override it with `/language`.

## 🎮 Commands

> [!NOTE]
> Commands marked 🎧 are DJ commands. When a DJ role is set with `/dj`, only members with that role can use them.

### Music

| Command               | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `/play <song>`        | 🎧 Play a song, link, playlist or playlist share code          |
| `/pause`              | 🎧 Pause playback                                              |
| `/resume`             | 🎧 Resume playback                                             |
| `/skip`               | 🎧 Skip to the next track                                      |
| `/stop`               | 🎧 Stop playback and leave the voice channel                   |
| `/loop`               | 🎧 Toggle loop for the current track                           |
| `/queue`              | 🎧 View and manage the queue                                   |
| `/volume <1-100>`     | 🎧 Set the playback volume                                     |
| `/filter <type>`      | 🎧 Apply an audio filter                                       |
| `/autoplay <enabled>` | 🎧 Turn smart autoplay on or off                               |
| `/lyrics`             | Show lyrics for the current track                             |

### Radio

| Command             | Description                                                                         |
| ------------------- | ----------------------------------------------------------------------------------- |
| `/radio <station>`  | 🎧 Play a live station. Search by name, genre, country or frequency, or paste a URL |

⭐ in the search results marks a checked station. Starting radio clears the queue and turns off autoplay. Use `/stop` to end it, or `/play` to go back to music.

### Playlists

| Command                                      | Description                                  |
| -------------------------------------------- | -------------------------------------------- |
| `/playlist create <name> [visibility]`       | Create a playlist                            |
| `/playlist list`                             | Show your playlists and your limits          |
| `/playlist view <playlist or code>`          | Show the songs in a playlist                 |
| `/playlist rename <playlist> <name>`         | Rename a playlist                            |
| `/playlist delete <playlist>`                | Delete a playlist                            |
| `/playlist visibility <playlist> <state>`    | Make a playlist public or private            |
| `/playlist share <playlist>`                 | Post the playlist's share code               |
| `/playlist transfer <playlist> <user>`       | Send an ownership transfer request by DM     |
| `/playlist song add <playlist> <song>`       | Search for a song and add it                 |
| `/playlist song current <playlist>`          | Add the song that is playing                 |
| `/playlist song remove <playlist> <position>`| Remove a song                                |
| `/playlist song move <playlist> <from> <to>` | Move a song to a new position                |

**Limits:** 1 playlist of up to 10 songs. Members of the [support server](https://discord.gg/XzE9hSbsNb) get 5 playlists of up to 50 songs each.

### Account, server and utility

| Command                          | Description                                        |
| -------------------------------- | -------------------------------------------------- |
| `/login spotify <profile>`       | Link your Spotify account                          |
| `/logout spotify`                | Unlink your Spotify account                        |
| `/chart <scope> [limit]`         | Show top tracks for you, the server, or everyone   |
| `/dj [role]`                     | Set, change, create or turn off the DJ role        |
| `/language <scope> [language]`   | Set the language for yourself or the server        |
| `/help [command]`                | List commands or show details for one              |
| `/ping`                          | Check latency and connection status                |
| `/feedback`                      | Send feedback to the developers                    |

## 🚀 Getting Started

### Prerequisites

| Requirement                                                          | Notes                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Node.js](https://nodejs.org/) 22+                                   | Same version as the Docker image                                   |
| [MongoDB](https://www.mongodb.com/)                                  | Stores users, playlists, stats and settings                        |
| [Redis](https://redis.io/)                                           | Stores player state so playback survives restarts                  |
| [Lavalink v4](https://github.com/lavalink-devs/Lavalink)             | The audio server. A `Lavalink.jar` is included in `lavalink/`      |
| [Discord bot token](https://discord.com/developers/applications)     |                                                                    |
| [Spotify app](https://developer.spotify.com/dashboard)               | Used for search, autocomplete and `/login`                         |
| [Last.fm API key](https://www.last.fm/api/account/create)            | Used for autoplay recommendations                                  |

### Option 1: Docker Compose

This runs the bot and a Lavalink server together.

1. Clone the repository and create your config files:

    ```bash
    git clone https://github.com/muralianand12345/Pepper-Bot.git
    cd Pepper-Bot
    cp .example.env .env
    cp config/config.example.yml config/config.yml
    ```

2. Add a Lavalink config at `lavalink/application.yml`. Use `lavalink/application_test.yml` as a starting point.
3. Fill in `.env` (see [Environment variables](#environment-variables)). In `config/config.yml`, point a node at host `lavalink` with the port set in your `application.yml`.
4. Start everything:

    ```bash
    docker compose up -d --build
    ```

### Option 2: Run manually

```bash
git clone https://github.com/muralianand12345/Pepper-Bot.git
cd Pepper-Bot
yarn install

cp .example.env .env
cp config/config.example.yml config/config.yml
# edit both files, then:

yarn build
yarn start
```

> [!TIP]
> `yarn start` runs `build/index.js`. That file starts a Discord.js `ShardingManager`, which spawns shards automatically. Each shard runs `build/main.js`.

## ⚙️ Configuration

The bot reads two files:

- **`.env`** holds secrets and connection strings.
- **`config/config.yml`** holds bot behavior, premium tiers and Lavalink nodes.

### Environment variables

| Variable                              | Required | Description                                                                   |
| ------------------------------------- | :------: | ----------------------------------------------------------------------------- |
| `TOKEN`                               |    ✅    | Discord bot token                                                             |
| `MONGO_URI`                           |    ✅    | MongoDB connection string                                                     |
| `DEBUG_MODE`                          |    ✅    | `true` or `false`. Turns on verbose logging                                   |
| `LASTFM_API_KEY`                      |    ✅    | Last.fm API key, used by autoplay                                             |
| `SPOTIFY_CLIENT_ID`                   |    ✅    | Spotify app client ID                                                         |
| `SPOTIFY_CLIENT_SECRET`               |    ✅    | Spotify app client secret                                                     |
| `SPOTIFY_REDIRECT_URI`                |    ✅    | OAuth callback URL, `https://<your-host>/api/v1/accounts/spotify/callback`    |
| `FEEDBACK_WEBHOOK`                    |    ✅    | Discord webhook that receives `/feedback` submissions                         |
| `LIVE_SONGS_WEBHOOK`                  |    ✅    | Discord webhook that receives a live feed of played songs                     |
| `OPENAI_API_KEY`                      |    ✅    | OpenAI (or compatible) API key                                                |
| `OPENAI_BASE_URL`                     |    ✅    | OpenAI-compatible base URL                                                    |
| `API_PORT`                            |          | Port for the REST API. Defaults to `3000`                                     |
| `STATS_API_KEY`                       |          | Enables the `/api/v1/stats` routes. Left unset, those routes are not mounted  |
| `REDIS_HOST` / `REDIS_PORT`           |          | Redis connection used for player state                                        |
| `REDIS_PASSWORD`                      |          | Redis password                                                                |
| `REDIS_PREFIX`                        |          | Key prefix. Defaults to `pepper:`                                             |

> [!IMPORTANT]
> If a required variable is missing, the bot won't start. The startup error lists the missing variables.

### Lavalink nodes

Nodes are defined under `music.lavalink.nodes` in `config/config.yml`. With more than one node, the bot sends new players to the least-loaded node.

```yaml
music:
    lavalink:
        default_search: spsearch # amsearch, bcsearch, dzsearch, scsearch, spsearch, ytsearch, ytmsearch, ...
        nodes:
            - identifier: 'Main Node'
              host: 'localhost'
              port: 2333
              password: 'youshallnotpass'
              useSSL: false
              nodePriority: 1 # lower = higher priority
              isBackup: false
              maxRetryAttempts: 100000
              retryDelayMs: 10000
              enableSessionResumeOption: true
              sessionTimeoutSeconds: 30000
              apiRequestTimeoutMs: 10000
```

### Other settings

`config/config.yml` also controls:

- **`bot.owners`**: user IDs with owner access. Owners see extra player and shard details in `/ping`.
- **`bot.support_server`**: the support server ID and invite link. Members of this server get premium tier 1.
- **`bot.presence`**: the rotating status messages. They support the placeholders `<clientname>`, `<usersize>`, `<guildsize>`, `<channelsize>` and `<version>`.
- **`bot.log`**: channel IDs for command-usage logs and server join/leave logs.
- **`premium.tiers`**: per-tier limits for queued playlist size and custom playlists.

### Bot permissions

When you invite the bot, give it these permissions: **View Channels**, **Send Messages**, **Embed Links**, **Read Message History**, **Connect** and **Speak**. `/dj` also needs **Manage Roles** so it can create a DJ role.

## 🔌 REST API

The bot runs an Express server on the primary shard, on port `API_PORT` (default `3000`).

| Endpoint                                   | Auth | Description                                    |
| ------------------------------------------ | :--: | ---------------------------------------------- |
| `GET /api/v1/commands`                     |      | List all commands                              |
| `GET /api/v1/commands/:name`               |      | Details for one command                        |
| `GET /api/v1/languages`                    |      | List supported languages                       |
| `GET /api/v1/languages/:code`              |      | Details for one language                       |
| `GET /api/v1/accounts/spotify/callback`    |      | Spotify OAuth callback, used by `/login`       |
| `GET /api/v1/stats/realtime`               |  🔑  | Live players, listeners, shards, now playing   |
| `GET /api/v1/stats/overview`               |  🔑  | Summary of all-time usage                      |
| `GET /api/v1/stats/songs`                  |  🔑  | Most played songs                              |
| `GET /api/v1/stats/requesters`             |  🔑  | Users who requested the most songs             |
| `GET /api/v1/stats/playtime`               |  🔑  | Listening time                                 |
| `GET /api/v1/stats/servers[/:guildId]`     |  🔑  | Stats for every server, or for one server      |
| `GET /api/v1/stats/radio`                  |  🔑  | Radio listening stats                          |
| `GET /api/v1/stats/radio/servers/:guildId` |  🔑  | Radio stats for one server                     |
| `GET /api/v1/stats/radio/users/:userId`    |  🔑  | Radio stats for one user                       |
| `GET /api/v1/stats/playlists[/:code]`      |  🔑  | Playlist stats, or one playlist by share code  |

🔑 Send `STATS_API_KEY` in an `x-api-key` header or as `Authorization: Bearer <key>`:

```bash
curl -H "x-api-key: $STATS_API_KEY" http://localhost:3000/api/v1/stats/realtime
```

## 🏗 Development

### Project structure

```text
src/
├── index.ts            # Starts the ShardingManager
├── main.ts             # Per-shard startup: loads handlers and events, logs in
├── pepper.ts           # Creates the Discord client and Magmastream manager
├── commands/           # One file per slash command
├── core/
│   ├── api/            # REST API route handlers
│   ├── commands/       # Autocomplete, interaction routing, premium checks
│   ├── locales/        # Localization manager and language detection
│   └── music/          # Player logic, search, lyrics, playlists, radio, repositories
├── events/
│   ├── client/         # Ready, interactions, buttons, modals, API server
│   ├── database/       # MongoDB connection and schemas
│   ├── log/            # Shard, request and server join/leave logging
│   └── music/          # Lavalink node and player events
├── handlers/           # Command loader
├── types/              # TypeScript types
└── utils/              # Config, logger, sharding and formatting helpers

config/                 # config.yml and config.example.yml
locales/                # Translation files (*.yml)
lavalink/               # Lavalink jar and a sample application.yml
scripts/                # Release helper scripts
```

### Adding a command

Create a file in `src/commands/`. The command loader picks it up automatically.

```typescript
import discord from 'discord.js';

import { Command } from '../types';
import { LocalizationManager } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();

const exampleCommand: Command = {
	cooldown: 5,
	data: new discord.SlashCommandBuilder()
		.setName('example')
		.setDescription('Example command')
		.setNameLocalizations(localizationManager.getCommandLocalizations('commands.example.name'))
		.setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.example.description')),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {},
};

export default exampleCommand;
```

Then add its strings to **every** file in `locales/`:

```yaml
commands:
    example:
        name: 'example'
        description: 'Example command description'

responses:
    example:
        success: 'Command executed successfully!'
```

### Releasing a new version

Change the number in `VERSION`, then run:

```bash
yarn update-version
```

This updates `package.json` and the version badge in this README.

### Code style

- TypeScript in strict mode.
- Use arrow functions for all functions and class methods.
- Import Discord.js as `import discord from 'discord.js'`.
- Write self-documenting code and avoid comments.
- Keep no state in process memory. The bot is sharded, so a `Map` on one shard can't be seen by the others. Use MongoDB or Redis instead.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution workflow.

## 🔧 Troubleshooting

<details>
<summary><b>The bot doesn't respond to commands</b></summary>

- Check that the bot has the [required permissions](#bot-permissions) in the channel.
- Check that `TOKEN` is correct and the logs show `has connected successfully`.
- Slash commands can take a few minutes to appear the first time the bot joins a server.

</details>

<details>
<summary><b>A track is queued but nothing plays</b></summary>

- Check that at least one Lavalink node is up and reachable from the bot.
- Check that the bot has **Connect** and **Speak** permissions in the voice channel.
- Look for `node_error` or `track_error` entries in the logs. If a source is blocked on your Lavalink node, try a different `default_search`.

</details>

<details>
<summary><b>The bot fails at startup with "Missing required environment variables"</b></summary>

Compare your `.env` with the [environment variables](#environment-variables) table. Every row marked ✅ must have a value.

</details>

<details>
<summary><b>Stats API routes return 404</b></summary>

`STATS_API_KEY` isn't set, so the stats routes weren't mounted. Set it and restart the bot.

</details>

Logs are written to the `logs/` directory.

## 🤝 Contributing

Contributions are welcome. Fork the repo, create a feature branch, and open a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). To report a vulnerability, follow [SECURITY.md](SECURITY.md).

## 📄 License

Pepper Bot is licensed under the [Apache License 2.0](LICENSE).

## 🙏 Acknowledgments

- [Discord.js](https://discord.js.org/): Discord API library
- [Lavalink](https://github.com/lavalink-devs/Lavalink): audio server
- [Magmastream](https://www.npmjs.com/package/magmastream): Lavalink client
- [Radio Browser](https://www.radio-browser.info/): the radio station directory
- [MongoDB](https://www.mongodb.com/) and [Redis](https://redis.io/): storage

---

<div align="center">

**Made with ❤️ by Murali Anand**

</div>
