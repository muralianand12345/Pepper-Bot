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
 *     MusicHistoryDto:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: Track title
 *         author:
 *           type: string
 *           description: Track artist/author
 *         sourceName:
 *           type: string
 *           description: Source platform (e.g., Spotify, SoundCloud)
 *         uri:
 *           type: string
 *           description: Track URI
 *         playCount:
 *           type: integer
 *           description: Number of times the track was played
 *         lastPlayed:
 *           type: string
 *           format: date-time
 *           description: Last time the track was played
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
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               description: Current page number
 *             pageSize:
 *               type: integer
 *               description: Number of items per page
 *             total:
 *               type: integer
 *               description: Total number of items
 *             totalPages:
 *               type: integer
 *               description: Total number of pages
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MusicHistoryDto'
 * 
 *     RecommendationResponse:
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
 *             seedSong:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                   description: Title of the seed song
 *                 author:
 *                   type: string
 *                   description: Artist of the seed song
 *                 uri:
 *                   type: string
 *                   description: URI of the seed song
 *                 artworkUrl:
 *                   type: string
 *                   description: URL to the song's artwork
 *             recommendations:
 *               type: array
 *               description: List of recommended songs
 *               items:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                     description: Song title
 *                   author:
 *                     type: string
 *                     description: Song artist
 *                   uri:
 *                     type: string
 *                     description: Song URI
 *                   sourceName:
 *                     type: string
 *                     description: Source platform (e.g., Spotify, SoundCloud)
 *                   artworkUrl:
 *                     type: string
 *                     description: URL to song artwork image
 */