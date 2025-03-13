/**
 * @swagger
 * components:
 *   schemas:
 *     Track:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: Track title
 *         author:
 *           type: string
 *           description: Track artist/author
 *         duration:
 *           type: integer
 *           description: Track duration in milliseconds
 *         position:
 *           type: integer
 *           description: Current playback position in milliseconds
 *         uri:
 *           type: string
 *           description: Track URI
 *         sourceName:
 *           type: string
 *           description: Source platform (e.g., Spotify, SoundCloud)
 *         artworkUrl:
 *           type: string
 *           description: URL to track artwork image
 *
 *     PlayerResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         timestamp:
 *           type: string
 *           format: date-time
 *         count:
 *           type: integer
 *           description: Number of active players
 *         data:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               guildId:
 *                 type: string
 *               guildName:
 *                 type: string
 *               playing:
 *                 type: boolean
 *               paused:
 *                 type: boolean
 *               volume:
 *                 type: integer
 *               currentTrack:
 *                 $ref: '#/components/schemas/Track'
 *               queueSize:
 *                 type: integer
 *
 *     DetailedPlayerResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         timestamp:
 *           type: string
 *           format: date-time
 *         data:
 *           type: object
 *           properties:
 *             guildId:
 *               type: string
 *             guildName:
 *               type: string
 *             playing:
 *               type: boolean
 *             paused:
 *               type: boolean
 *             volume:
 *               type: integer
 *             trackRepeat:
 *               type: boolean
 *             queueRepeat:
 *               type: boolean
 *             currentTrack:
 *               $ref: '#/components/schemas/Track'
 *             queueSize:
 *               type: integer
 *             queue:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Track'
 *
 *     MusicHistoryResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         timestamp:
 *           type: string
 *           format: date-time
 *         count:
 *           type: integer
 *         data:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               author:
 *                 type: string
 *               sourceName:
 *                 type: string
 *               uri:
 *                 type: string
 *               playCount:
 *                 type: integer
 *               lastPlayed:
 *                 type: string
 *                 format: date-time
 *               artworkUrl:
 *                 type: string
 */