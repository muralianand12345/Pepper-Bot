/**
 * @swagger
 * /music/ws:
 *   get:
 *     summary: WebSocket endpoint for real-time music control
 *     description: |
 *       Establishes a WebSocket connection for real-time music control and events.
 *
 *       **Note:** This is not a REST endpoint, but a WebSocket connection endpoint.
 *       Use a WebSocket client to connect to this URL.
 *
 *       After connecting, you must authenticate by sending:
 *       ```json
 *       {
 *         "type": "auth",
 *         "data": {
 *           "apiKey": "your-api-key-here"
 *         }
 *       }
 *       ```
 *
 *       For detailed WebSocket usage, see the [WebSocket documentation](/api/v1/music/docs).
 *     tags: [Music]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       101:
 *         description: Switching Protocols - WebSocket connection established
 *     externalDocs:
 *       description: Complete WebSocket API Documentation
 *       url: /api/v1/music/docs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     NowPlayingResponse:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           example: now_playing
 *         data:
 *           type: object
 *           properties:
 *             guildId:
 *               type: string
 *               description: Discord guild ID
 *             playing:
 *               type: boolean
 *               description: Whether playback is active
 *             paused:
 *               type: boolean
 *               description: Whether playback is paused
 *             volume:
 *               type: integer
 *               description: Current volume level (0-100)
 *             track:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                   description: Track title
 *                 author:
 *                   type: string
 *                   description: Track artist/author
 *                 duration:
 *                   type: integer
 *                   description: Track duration in milliseconds
 *                 position:
 *                   type: integer
 *                   description: Current playback position in milliseconds
 *                 uri:
 *                   type: string
 *                   description: Track URI
 *                 sourceName:
 *                   type: string
 *                   description: Source platform (e.g., Spotify, SoundCloud)
 *                 isStream:
 *                   type: boolean
 *                   description: Whether the track is a livestream
 *                 artworkUrl:
 *                   type: string
 *                   description: URL to track artwork image
 *                 requester:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Discord user ID of requester
 *                     username:
 *                       type: string
 *                       description: Username of requester
 *                     discriminator:
 *                       type: string
 *                       description: Discriminator of requester
 *             progressBar:
 *               type: string
 *               description: Formatted progress bar string
 *             progressPercent:
 *               type: integer
 *               description: Playback progress as percentage (0-100)
 *             queueSize:
 *               type: integer
 *               description: Number of tracks in queue
 */

// Add to the section in music-schemas.ts documenting WebSocket events