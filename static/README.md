# Pepper Music WebSocket API

This WebSocket API allows for real-time communication with Pepper's music system, enabling you to control and monitor music playback across Discord guilds.

## Connection

Connect to the WebSocket endpoint at:

```
ws://your-server:port/api/v1/music/ws
```

Upon connection, you'll receive a welcome message. You must first authenticate using your API key before performing any operations.

## Authentication

Send an authentication message immediately after connecting:

```json
{
  "type": "auth",
  "data": {
    "apiKey": "your-api-key-here"
  }
}
```

The server will respond with:

```json
{
  "type": "auth_success",
  "data": {
    "message": "Successfully authenticated"
  }
}
```

If authentication fails, you'll receive an error message and your commands will be rejected.

## Message Format

All WebSocket messages follow this format:

```json
{
  "type": "message_type",
  "data": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

## Client Commands

### Play a Song/Playlist

Play a song or playlist in a guild:

```json
{
  "type": "play",
  "data": {
    "guildId": "1234567890",
    "query": "bohemian rhapsody",
    "userId": "9876543210" // Optional
  }
}
```

The `query` can be a search term or a direct URL (Spotify, SoundCloud, etc.).

### Pause Playback

Pause the currently playing song:

```json
{
  "type": "pause",
  "data": {
    "guildId": "1234567890"
  }
}
```

### Resume Playback

Resume a paused song:

```json
{
  "type": "resume",
  "data": {
    "guildId": "1234567890"
  }
}
```

### Skip Current Song

Skip to the next song in queue:

```json
{
  "type": "skip",
  "data": {
    "guildId": "1234567890"
  }
}
```

### Stop Playback

Stop playback and disconnect from voice channel:

```json
{
  "type": "stop",
  "data": {
    "guildId": "1234567890"
  }
}
```

### Set Volume

Adjust the playback volume (0-100):

```json
{
  "type": "volume",
  "data": {
    "guildId": "1234567890",
    "volume": 50
  }
}
```

### Get Queue

Retrieve the current queue:

```json
{
  "type": "queue",
  "data": {
    "guildId": "1234567890"
  }
}
```

### Get Recommendations

Get song recommendations based on a user's listening history:

```json
{
  "type": "recommend",
  "data": {
    "guildId": "1234567890",
    "userId": "9876543210",
    "count": 10 // Optional
  }
}
```

## Server Events

The server will send various events that your client can listen for:

### Track Started

```json
{
  "type": "track_start",
  "data": {
    "guildId": "1234567890",
    "timestamp": "2025-03-14T15:00:00.000Z",
    "track": {
      "title": "Bohemian Rhapsody",
      "author": "Queen",
      "duration": 367000,
      "uri": "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv",
      "sourceName": "spotify",
      "artworkUrl": "https://i.scdn.co/image/ab67616d0000b273..."
    },
    "position": 0,
    "volume": 50
  }
}
```

### Track Ended

```json
{
  "type": "track_end",
  "data": {
    "guildId": "1234567890",
    "timestamp": "2025-03-14T15:06:07.000Z",
    "track": {
      "title": "Bohemian Rhapsody",
      "author": "Queen",
      "duration": 367000,
      "uri": "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv"
    }
  }
}
```

### Queue Ended

```json
{
  "type": "queue_end",
  "data": {
    "guildId": "1234567890",
    "timestamp": "2025-03-14T15:30:00.000Z"
  }
}
```

### Player Paused

```json
{
  "type": "player_paused",
  "data": {
    "guildId": "1234567890",
    "timestamp": "2025-03-14T15:02:30.000Z",
    "position": 150000
  }
}
```

### Player Resumed

```json
{
  "type": "player_resumed",
  "data": {
    "guildId": "1234567890",
    "timestamp": "2025-03-14T15:03:45.000Z",
    "position": 150000
  }
}
```

### Player Destroyed

```json
{
  "type": "player_destroy",
  "data": {
    "guildId": "1234567890",
    "timestamp": "2025-03-14T15:40:00.000Z"
  }
}
```

### Player Created

```json
{
  "type": "player_create",
  "data": {
    "guildId": "1234567890",
    "timestamp": "2025-03-14T15:00:00.000Z",
    "voiceChannelId": "1234567890123456",
    "textChannelId": "0987654321098765",
    "volume": 50
  }
}
```

### Volume Changed

```json
{
  "type": "player_volume_changed",
  "data": {
    "guildId": "1234567890",
    "timestamp": "2025-03-14T15:05:00.000Z",
    "volume": 75
  }
}
```

## Success Responses

When a command is successfully processed, you'll receive one of these responses:

### Track Added

```json
{
  "type": "track_added",
  "data": {
    "track": {
      "title": "Bohemian Rhapsody",
      "author": "Queen",
      "duration": 367000,
      "uri": "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv",
      "sourceName": "spotify",
      "artworkUrl": "https://i.scdn.co/image/ab67616d0000b273..."
    },
    "position": 1,
    "playing": true,
    "voiceChannelId": "1234567890123456"
  }
}
```

### Playlist Added

```json
{
  "type": "playlist_added",
  "data": {
    "playlist": {
      "name": "Greatest Hits",
      "trackCount": 20,
      "duration": 4800000,
      "tracks": [
        {
          "title": "Bohemian Rhapsody",
          "author": "Queen",
          "duration": 367000,
          "uri": "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv"
        },
        // More tracks...
      ]
    },
    "playing": true,
    "voiceChannelId": "1234567890123456"
  }
}
```

### Paused/Resumed/Stopped/Skipped

```json
{
  "type": "paused",
  "data": {
    "guildId": "1234567890"
  }
}
```

```json
{
  "type": "resumed",
  "data": {
    "guildId": "1234567890"
  }
}
```

```json
{
  "type": "stopped",
  "data": {
    "guildId": "1234567890"
  }
}
```

```json
{
  "type": "skipped",
  "data": {
    "guildId": "1234567890",
    "skipped": {
      "title": "Bohemian Rhapsody",
      "author": "Queen"
    },
    "nextSong": {
      "title": "Another One Bites the Dust",
      "author": "Queen"
    }
  }
}
```

### Volume Set

```json
{
  "type": "volume_set",
  "data": {
    "guildId": "1234567890",
    "volume": 75
  }
}
```

### Queue Information

```json
{
  "type": "queue",
  "data": {
    "guildId": "1234567890",
    "playing": true,
    "paused": false,
    "volume": 50,
    "repeatMode": "off",
    "currentSong": {
      "title": "Bohemian Rhapsody",
      "author": "Queen",
      "duration": 367000,
      "position": 120000,
      "uri": "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv",
      "sourceName": "spotify",
      "artworkUrl": "https://i.scdn.co/image/ab67616d0000b273..."
    },
    "queueSize": 3,
    "queue": [
      {
        "title": "Another One Bites the Dust",
        "author": "Queen",
        "duration": 214000,
        "uri": "https://open.spotify.com/track/57JVGBtBLCfHw2muk5416J",
        "sourceName": "spotify",
        "artworkUrl": "https://i.scdn.co/image/ab67616d0000b273..."
      },
      // More tracks...
    ]
  }
}
```

### Recommendations

```json
{
  "type": "recommendations",
  "data": {
    "guildId": "1234567890",
    "userId": "9876543210",
    "seedSong": {
      "title": "Bohemian Rhapsody",
      "author": "Queen",
      "uri": "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv",
      "artworkUrl": "https://i.scdn.co/image/ab67616d0000b273..."
    },
    "recommendations": [
      {
        "title": "We Will Rock You",
        "author": "Queen",
        "uri": "https://open.spotify.com/track/4pbJqGIASGPr0ZpGpnWkDn",
        "sourceName": "spotify",
        "artworkUrl": "https://i.scdn.co/image/ab67616d0000b273..."
      },
      // More recommendations...
    ]
  }
}
```

## Error Handling

If a command fails, you'll receive an error message:

```json
{
  "type": "error",
  "data": {
    "message": "Error message describing what went wrong",
    "code": 400
  }
}
```

Common error codes:
- 400: Bad request (invalid parameters)
- 401: Unauthorized (authentication failed)
- 404: Not found (guild, player, etc. not found)
- 500: Server error

## Connection States

The WebSocket connection may close due to various reasons. It's recommended to implement reconnection logic with exponential backoff.

## Usage Examples

### JavaScript Client

```javascript
// Connect to the WebSocket
const ws = new WebSocket('ws://your-server:port/api/v1/music/ws');

// Handle connection open
ws.onopen = () => {
  console.log('Connected to Pepper Music WebSocket');
  
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    data: {
      apiKey: 'your-api-key-here'
    }
  }));
};

// Handle incoming messages
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'auth_success':
      console.log('Authentication successful');
      break;
      
    case 'error':
      console.error(`Error: ${message.data.message} (${message.data.code})`);
      break;
      
    case 'track_start':
      console.log(`Now playing: ${message.data.track.title} by ${message.data.track.author}`);
      break;
      
    // Handle other message types...
  }
};

// Handle errors and reconnection
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log(`Connection closed: ${event.code} ${event.reason}`);
  // Implement reconnection logic here
};

// Example: Play a song
function playSong(guildId, query) {
  ws.send(JSON.stringify({
    type: 'play',
    data: {
      guildId,
      query
    }
  }));
}
```

## Rate Limiting

To prevent abuse, excessive messages may be rate limited. Implement proper error handling to respect rate limits.

## Best Practices

1. **Authentication**: Always authenticate immediately after connecting
2. **Error Handling**: Implement proper error handling for all commands
3. **Reconnection**: Use exponential backoff when reconnecting
4. **Event Listening**: Listen for all relevant events to keep your application state in sync
5. **Command Validation**: Validate inputs before sending commands