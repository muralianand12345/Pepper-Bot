# 🎵 Pepper Music Bot

![Version](https://img.shields.io/badge/version-4.12.1-blue)
![License](https://img.shields.io/badge/license-Apache%202.0-green)
![Discord.js](https://img.shields.io/badge/discord.js-v14-7289da)
![TypeScript](https://img.shields.io/badge/typescript-v5.2.2-blue)

A modern, feature-rich music bot for Discord with advanced queue management, music analytics, personalized recommendations, and a secure API interface.

![Pepper Bot Banner](https://images-ext-1.discordapp.net/external/2gT4PoVob9xz18PqYFy__v34bJDXlCjyx-L_anpKAUI/%3Furl%3Dhttps%253A%252F%252F1401372451-files.gitbook.io%252F%257E%252Ffiles%252Fv0%252Fb%252Fgitbook-x-prod.appspot.com%252Fo%252Fspaces%25252FbVBhQoZcw8F4L1D8Cxry%25252Fsocialpreview%25252FwrXaqBE6Ipo7kCICpatB%25252Fimage.png%253Falt%253Dmedia%2526token%253D5b7eb3aa-a107-4d1f-9c71-bb9a0ad87cad%26width%3D1200%26height%3D630%26sign%3Dbce4f03f%26sv%3D2/https/docs-pepper.mrbotz.com/~gitbook/image?format=webp&width=1232&height=806)

## ✨ Features

- **High-Quality Music Playback** - Support for Spotify, SoundCloud, and more
- **Advanced Queue Management** - Skip, pause, resume, shuffle, and loop functionality
- **Music Analytics** - Track listening history and view detailed statistics
- **Personalized Recommendations** - Get song suggestions based on listening history
- **RESTful API** - Control the bot programmatically with a secure API
- **WebSocket Integration** - Real-time music control and events
- **Swagger Documentation** - Interactive API documentation
- **Sharding Support** - Scales across multiple servers efficiently
- **Premium User Features** - Special commands for premium users
- **Detailed Logging** - Comprehensive logging for monitoring and debugging

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB
- Lavalink server(s)
- Discord Bot Token
- Spotify Developer credentials (for Spotify integration)
- Last.fm API key (for recommendation features)

### Installation

1. Clone the repository

```bash
git clone https://github.com/muralianand12345/Pepper-Bot.git
cd Pepper-Bot
```

2. Install dependencies

```bash
npm i -g yarn
yarn
```

3. Configure environment variables

```bash
cp .example.env .env.prod
# Edit .env.prod with your configuration
```

4. Configure the bot settings

```bash
cp config/config.example.yml config/config.yml
# Edit config.yml with your configuration
```

5. Build the TypeScript code

```bash
yarn build
```

6. Run the bot

```bash
yarn start
```

## 📚 Documentation

- [API Documentation](./src/events/client/api/README.md) - Details about the RESTful API
- [WebSocket Protocol](./static/README.md) - Documentation for WebSocket integration

## 🧩 Architecture

Pepper Bot is built with a modular architecture that separates concerns and makes maintenance easier:

```
src/
├── commands/        # Bot commands (slash and message)
├── events/          # Event handlers
├── handlers/        # Command and event handlers
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

### Key Components

- **Music System**: Built on [Magmastream](https://github.com/Magmastream-NPM/magmastream) (Lavalink wrapper)
- **Database**: MongoDB with Mongoose for storing music history and user preferences
- **API**: Express.js with authentication and rate limiting
- **WebSocket**: Real-time event system for dynamic music control

## 🛠️ Advanced Configuration

### Cloudflare Tunnel Setup

To securely expose your API, you can use Cloudflare Tunnels:

1. Install `cloudflared`: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

2. Create a config file:

```yml
tunnel: tunnel-id
credentials-file: /Users/username/.cloudflared/tunnel-id.json

ingress:
  - hostname: pepper.domain.in
    service: http://localhost:3000
  - service: http_status:404
```

3. Execute in terminal/cmd:

```bash
# One Time Local only
cloudflared tunnel login
cloudflared tunnel create pepper-api
cloudflared tunnel route dns pepper-api peppermusic.domain.in

# Run the tunnel
cloudflared tunnel --config ~/.cloudflared/config.yml run pepper-api
```

### Lavalink Configuration

Configure Lavalink nodes in `config.yml`:

```yml
music:
  lavalink:
    default_search: spsearch
    nodes: [
        {
          "identifier": "Node 1",
          "host": "lavalink.example.com",
          "port": 443,
          "password": "your-password",
          "secure": true,
          # Additional options...
        },
        # More nodes...
      ]
```

## 📊 API & WebSocket Usage

### REST API

The bot includes a full RESTful API for programmatic control:

```javascript
// Example API request to get active players
fetch("https://pepper.domain.in/api/v1/music/players", {
  headers: {
    "x-api-key": "your-api-key",
  },
})
  .then((response) => response.json())
  .then((data) => console.log(data));
```

### WebSocket

For real-time control and events:

```javascript
// Connect to WebSocket
const ws = new WebSocket("wss://pepper.domain.in/api/v1/music/ws");

// Authenticate
ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: "auth",
      data: { apiKey: "your-api-key" },
    })
  );
};

// Play a song
ws.send(
  JSON.stringify({
    type: "play",
    data: {
      guildId: "123456789012345678",
      query: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
      userId: "987654321098765432",
    },
  })
);

// Listen for events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`Event: ${data.type}`, data);
};
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgements

- [Discord.js](https://discord.js.org/) - Discord API wrapper
- [Magmastream](https://github.com/Magmastream-NPM/magmastream) - Lavalink client for Node.js
- [Express](https://expressjs.com/) - Web framework for Node.js
- [Mongoose](https://mongoosejs.com/) - MongoDB object modeling
- [Swagger](https://swagger.io/) - API documentation
- All contributors who have helped improve this project

## 📧 Contact

For any questions or concerns, please open an issue or contact the maintainer:

- GitHub: [muralianand12345](https://github.com/muralianand12345)
- Discord: murlee#0
