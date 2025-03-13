/**
 * @swagger
 * components:
 *   schemas:
 *     CommandBase:
 *       type: object
 *       required:
 *         - name
 *         - description
 *         - type
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the command
 *         description:
 *           type: string
 *           description: The description of the command
 *         type:
 *           type: string
 *           enum: [SLASH, MESSAGE]
 *           description: The type of command
 *         cooldown:
 *           type: integer
 *           description: Cooldown in seconds
 *         ownerOnly:
 *           type: boolean
 *           description: Whether command is restricted to bot owners
 *         premiumOnly:
 *           type: boolean
 *           description: Whether command requires premium access
 *         guildOnly:
 *           type: boolean
 *           description: Whether command can only be used in servers
 *
 *     CommandOption:
 *       type: object
 *       required:
 *         - name
 *         - description
 *         - type
 *       properties:
 *         name:
 *           type: string
 *           description: Option name
 *         description:
 *           type: string
 *           description: Option description
 *         type:
 *           type: integer
 *           description: Discord API option type
 *         required:
 *           type: boolean
 *           description: Whether the option is required
 *         options:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CommandOption'
 *           description: Nested options (for subcommands)
 *         choices:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CommandChoice'
 *           description: Predefined choices for the option
 *
 *     CommandChoice:
 *       type: object
 *       required:
 *         - name
 *         - value
 *       properties:
 *         name:
 *           type: string
 *           description: Display name of the choice
 *         value:
 *           type: [string, number]
 *           description: Value of the choice
 *
 *     CommandArgument:
 *       type: object
 *       required:
 *         - name
 *         - description
 *         - type
 *       properties:
 *         name:
 *           type: string
 *           description: Argument name
 *         description:
 *           type: string
 *           description: Argument description
 *         type:
 *           type: string
 *           description: Argument type
 *         required:
 *           type: boolean
 *           description: Whether the argument is required
 *         choices:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CommandChoice'
 *           description: Predefined choices for the argument
 *
 *     SlashCommand:
 *       allOf:
 *         - $ref: '#/components/schemas/CommandBase'
 *         - type: object
 *           properties:
 *             options:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CommandOption'
 *               description: Command options
 *
 *     MessageCommand:
 *       allOf:
 *         - $ref: '#/components/schemas/CommandBase'
 *         - type: object
 *           properties:
 *             arguments:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CommandArgument'
 *               description: Command arguments
 *
 *     CommandsResponse:
 *       type: object
 *       required:
 *         - status
 *         - timestamp
 *         - count
 *         - data
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         timestamp:
 *           type: string
 *           format: date-time
 *         count:
 *           type: integer
 *           description: Total number of commands
 *         data:
 *           type: object
 *           properties:
 *             slash:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SlashCommand'
 *             message:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MessageCommand'
 *           description: Command data grouped by type
 *
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
 */