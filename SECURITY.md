# Security Policy

## Supported Versions

Use this section to inform users about which versions of Pepper Music Bot are currently receiving security updates.

| Version | Supported          |
| ------- | ------------------ |
| 4.11.x  | :white_check_mark: |
| 4.10.x  | :white_check_mark: |
| < 4.10  | :x:                |

## Reporting a Vulnerability

We take the security of Pepper Music Bot seriously. If you believe you've found a security vulnerability, please follow these steps:

### How to Report

1. **DO NOT** disclose the vulnerability publicly until it has been addressed.
2. Email the vulnerability details to [Murali Anand](mailto:smurali1607@gmail.com).
3. Include the following information in your report:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Any suggested fixes (if applicable)

### What to Expect

- You will receive an acknowledgment of your report within 48 hours.
- We will investigate and provide an initial assessment within 7 days.
- We will keep you informed about the progress toward addressing the vulnerability.
- After the issue is resolved, we will publicly acknowledge your responsible disclosure (unless you prefer to remain anonymous).

## Security Best Practices

### For Bot Administrators

1. **API Keys & Tokens**:
   - Never share your Discord bot token or other API keys.
   - Rotate API keys regularly, especially if you suspect they may have been compromised.
   - Use environment variables or secure configuration files to store sensitive credentials.

2. **Permissions**:
   - Follow the principle of least privilege when configuring bot permissions.
   - Regularly audit the bot's permissions across all servers.

3. **Bot Hosting**:
   - Keep your bot's hosting environment up-to-date with the latest security patches.
   - Enable firewalls and restrict network access to trusted sources.
   - Use HTTPS for all API communications.

4. **MongoDB Security**:
   - Secure your MongoDB instance with strong authentication.
   - Do not expose your database to the public internet.
   - Regularly back up your database.

### For Users

1. **Commands & Input**:
   - Be cautious about the commands you run, especially in public channels.
   - Report any suspicious bot behavior to server administrators.

2. **Personal Data**:
   - Be aware that the bot stores listening history for recommendation features.
   - Use the `/chart personal` command to review what data is being stored.

## Security Features

- **API Authentication**: All API endpoints are protected with API key authentication.
- **Rate Limiting**: Protection against brute force and DoS attacks.
- **Input Validation**: All user inputs are validated before processing.
- **Secure WebSocket Communications**: WebSocket connections use secure wss:// protocol.
- **User Data Protection**: User data is only used for bot functionality and never shared with third parties.

## Recent Security Updates

- **4.11.9**: Enhanced rate limiting for API endpoints
- **4.11.8**: Fixed potential security issue in authentication flow
- **4.11.7**: Improved input validation for music commands

## Acknowledgments

We would like to thank the following individuals for responsibly disclosing security vulnerabilities:

- [List will be updated as contributions are received]

## License

This security policy is part of the Pepper Music Bot project, licensed under the Apache License 2.0.
