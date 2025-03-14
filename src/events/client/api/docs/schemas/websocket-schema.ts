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