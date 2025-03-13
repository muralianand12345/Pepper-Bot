/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       required:
 *         - status
 *         - message
 *       properties:
 *         status:
 *           type: string
 *           example: error
 *         message:
 *           type: string
 *           description: Error message
 *         code:
 *           type: integer
 *           description: Optional error code
 *         details:
 *           type: object
 *           description: Optional additional error details
 */