# Pepper Bot 🎵

![Version](https://img.shields.io/badge/version-5.6.2-blue)
![Discord.js](https://img.shields.io/badge/discord.js-v14.18.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue)
![License](https://img.shields.io/badge/license-Apache--2.0-green)

A powerful Discord music bot with smart autoplay, multi-language support, and advanced analytics. Built with TypeScript, Discord.js v14, and Lavalink for high-quality audio streaming.

## ✨ Features

### 🎵 Music Playback
- **High-Quality Audio**: Powered by Lavalink for superior sound quality
- **Multiple Sources**: Support for Spotify, SoundCloud, Bandcamp, and more
- **Smart Queue Management**: Advanced queue system with position tracking
- **Audio Filters**: 11+ audio filters including bassboost, nightcore, and 8D audio

### 🤖 Smart Features
- **Intelligent Autoplay**: Smart music recommendations based on listening history
- **Music Analytics**: Personal, server, and global music charts with detailed statistics
- **Song Suggestions**: Get personalized recommendations using smart algorithms
- **Multi-Language Support**: 15+ languages with complete localization

### 🛠 Advanced Controls
- **Voice Channel Management**: Auto-pause when channel is empty, resume when users join
- **Loop Modes**: Single track and queue loop options
- **Player Persistence**: Maintains state across bot restarts
- **Dashboard Integration**: Web-based control panel for enhanced management

### 📊 Analytics & History
- **Listening Statistics**: Track play counts, listening time, and favorite artists
- **Export Data**: CSV export functionality for personal analytics
- **Global Charts**: See what's trending across all servers
- **User Profiles**: Personal music taste analysis

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- MongoDB database
- Lavalink server
- Discord Bot Token
- Spotify API credentials (optional, for enhanced features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/muralianand12345/Pepper-Bot.git
   cd Pepper-Bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .example.env .env.prod
   ```
   
   Edit `.env.prod` with your credentials:
   ```env
   DEBUG_MODE=false
   TOKEN=your_discord_bot_token
   MONGO_URI=mongodb://localhost:27017/pepperbot
   LASTFM_API_KEY=your_lastfm_api_key
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   FEEDBACK_WEBHOOK=your_discord_webhook_url
   ```

4. **Configuration**
   ```bash
   cp config/config.example.yml config/config.yml
   ```
   
   Update `config/config.yml` with your settings (bot owners, Lavalink nodes, etc.)

5. **Build and Start**
   ```bash
   npm run build
   npm start
   ```

## ⚙️ Configuration

### Lavalink Setup
Configure your Lavalink nodes in `config/config.yml`:
```yaml
music:
  lavalink:
    nodes:
      - identifier: "Main Node"
        host: "localhost"
        port: 2333
        password: "youshallnotpass"
        secure: false
```

### Bot Permissions
Required Discord permissions:
- `Send Messages`
- `Use Slash Commands`
- `Connect` (to voice channels)
- `Speak` (in voice channels)
- `Use Voice Activity`
- `Read Message History`
- `Add Reactions`
- `Embed Links`

## 🎮 Commands

### Music Commands
- `/play <song>` - Play a song or add to queue
- `/pause` - Pause the current track
- `/resume` - Resume playback
- `/skip` - Skip the current song
- `/stop` - Stop playback and leave voice channel
- `/loop` - Toggle loop mode for current track
- `/autoplay <enabled>` - Toggle smart autoplay

### Utility Commands
- `/ping` - Check bot latency and status
- `/help [command]` - Display help information
- `/language <scope> [language]` - Set language preferences
- `/feedback` - Send feedback to developers

### Analytics Commands
- `/chart <scope> [limit]` - Display music analytics
- `/suggest-songs [count]` - Get personalized recommendations
- `/filter <type>` - Apply audio filters

## 🌍 Supported Languages

- 🇺🇸 English
- 🇪🇸 Spanish (Español)
- 🇫🇷 French (Français)
- 🇩🇪 German (Deutsch)
- 🇧🇷 Portuguese (Português)
- 🇷🇺 Russian (Русский)
- And 10+ more languages

## 🏗 Development

### Development Setup
```bash
# Install dependencies
npm install

# Set up development environment
cp .example.env .env.dev
# Edit .env.dev with your development credentials

# Start development server with hot reload
npm run dev
```

### Project Structure
```
src/
├── commands/          # Slash commands
├── core/              # Core functionality
│   ├── music/         # Music system
│   └── locales/       # Internationalization
├── events/            # Discord.js event handlers
├── handlers/          # Command and event loaders
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── main.ts           # Application entry point

config/               # Configuration files
locales/             # Translation files
scripts/             # Build and utility scripts
```

### Adding New Features

#### Creating a New Command
```typescript
import discord from "discord.js";
import { Command } from "../types";
import { LocalizationManager } from "../core/locales";

const localizationManager = LocalizationManager.getInstance();

const newCommand: Command = {
    cooldown: 5,
    data: new discord.SlashCommandBuilder()
        .setName("example")
        .setDescription("Example command")
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.example.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.example.description')),
    
    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
        // Command implementation
    }
};

export default newCommand;
```

#### Adding Translations
Add new translation keys to locale files in `locales/`:
```yaml
commands:
  example:
    name: "example"
    description: "Example command description"

responses:
  example:
    success: "Command executed successfully!"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Use TypeScript with strict mode
- Follow ESLint configuration
- Use arrow functions for all functions and class methods
- Import discord.js as: `import discord from "discord.js"`
- No comments in code (self-documenting code preferred)

## 🔧 Troubleshooting

### Common Issues

**Bot not responding to commands:**
- Check bot permissions in Discord server
- Verify bot token is correct
- Ensure bot is online and properly started

**Music not playing:**
- Verify Lavalink server is running and accessible
- Check voice channel permissions
- Ensure audio sources are accessible

**Database connection issues:**
- Verify MongoDB connection string
- Check MongoDB server status
- Ensure proper network connectivity

### Logs
Logs are stored in `logs/` directory organized by date:
```
logs/
└── 2024/
    └── January/
        └── bot-log-2024-01-15.log
```

## 📊 Performance

### Recommended System Requirements
- **CPU**: 1+ cores
- **RAM**: 1GB minimum, 4GB recommended
- **Storage**: 10GB available space
- **Network**: Stable internet connection with low latency

### Optimization Tips
- Use SSD storage for better database performance
- Deploy Lavalink server close to bot instance
- Monitor memory usage with built-in analytics
- Use CDN for dashboard assets

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Discord.js](https://discord.js.org/) - Discord API library
- [Lavalink](https://github.com/freyacodes/Lavalink) - Audio delivery system
- [Magmastream](https://github.com/Blackfort-Hosting/magmastream) - Lavalink client
- [MongoDB](https://www.mongodb.com/) - Database system

## 📞 Support

- **Discord Server**: [Join our support server](https://discord.gg/XzE9hSbsNb)
- **Issues**: [GitHub Issues](https://github.com/muralianand12345/Pepper-Bot/issues)
- **Documentation**: [Wiki](https://github.com/muralianand12345/Pepper-Bot/wiki)

---

**Made with ❤️ by MRBotZ**

*Pepper Bot - Bringing high-quality music to Discord servers worldwide*