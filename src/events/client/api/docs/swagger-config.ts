import swaggerJSDoc from 'swagger-jsdoc';
import { version } from '../../../../../package.json';

/**
 * Swagger configuration for API documentation
 */
const swaggerOptions: swaggerJSDoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Pepper Discord Bot API',
            version: version,
            description: 'API documentation for the Pepper Discord Bot',
            license: {
                name: 'Apache 2.0',
                url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
            },
            contact: {
                name: 'GitHub Repository',
                url: 'https://github.com/muralianand12345/Pepper-Bot',
            },
        },
        servers: [
            {
                url: '/api',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-api-key',
                    description: 'API key for authentication',
                },
            },
        },
        security: [
            {
                ApiKeyAuth: [],
            },
        ],
    },
    apis: [
        './src/events/client/api/routes/*.ts',
        './src/events/client/api/docs/schemas/*.ts',
    ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export default swaggerSpec;