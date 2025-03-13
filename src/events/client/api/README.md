# Pepper Bot API

This directory contains the API server implementation for the Pepper Discord Bot. The API provides programmatic access to bot functions and information.

## Features

- **Swagger Documentation**: Interactive API documentation available at `/docs` when the API is running
- **Authentication**: Secure your API with an API key
- **Rate Limiting**: Prevent abuse with configurable rate limits
- **Command Information**: Get details about available bot commands
- **Music Control**: View and manage music players
- **Bot Information**: Access general bot statistics and status

## Configuration

The API can be configured in the `config/config.yml` file:

```yaml
api:
  enabled: true  # Set to false to disable the API
  port: 3000     # Port the API will listen on
  auth:
    enabled: true  # Enable API key authentication
    apiKey: "your-secure-api-key-here"  # Your secret API key
  rateLimit:
    windowMs: 900000  # 15 minutes in milliseconds
    max: 100  # Maximum 100 requests per window
```

## API Endpoints

The API is organized into the following endpoint groups:

- `/api/v1/` - Root endpoint with API status information
- `/api/v1/commands` - Information about bot commands
- `/api/v1/info` - Bot information and statistics
- `/api/v1/health` - API and Discord connection health checks
- `/api/v1/music` - Music player information
- `/docs` - Swagger UI documentation

## Authentication

When authentication is enabled, all API requests require an API key. Include the key in your requests as follows:

```
Header: x-api-key: your-api-key-here
```

## Documentation

Full API documentation is available in the Swagger UI at `/docs` when the API is running.

## Development

The API follows a structured architecture:

- `core/` - Core API server implementation and configuration
- `routes/` - API route definitions
- `controllers/` - Business logic for routes
- `services/` - Services for data access and processing
- `docs/` - Swagger documentation

## Adding New Endpoints

To add new endpoints:

1. Create a new route file in the `routes/` directory
2. Define controller logic in the `controllers/` directory
3. Add service methods in the `services/` directory if needed
4. Add the route to the API server in `core/api-server.ts`
5. Add Swagger documentation using JSDoc comments

## Security Considerations

- Generate a strong, unique API key
- Enable authentication in production
- Configure appropriate rate limits
- Consider using HTTPS in production
- Review permissions for sensitive operations