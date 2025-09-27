# Contributing to Pepper Bot

Thank you for your interest in contributing to Pepper Music Bot! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Contributing to Pepper Bot](#contributing-to-pepper-bot)
  - [Table of Contents](#table-of-contents)
  - [Code of Conduct](#code-of-conduct)
  - [Getting Started](#getting-started)
    - [Development Environment Setup](#development-environment-setup)
    - [Project Structure](#project-structure)
  - [How to Contribute](#how-to-contribute)
    - [Reporting Bugs](#reporting-bugs)
    - [Suggesting Features](#suggesting-features)
    - [Pull Requests](#pull-requests)
  - [Coding Standards](#coding-standards)
    - [TypeScript Guidelines](#typescript-guidelines)
    - [Style Guide](#style-guide)
    - [Documentation](#documentation)
  - [Testing](#testing)
  - [Commit Guidelines](#commit-guidelines)
  - [Release Process](#release-process)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone. Be kind, considerate, and constructive in your communication and feedback.

## Getting Started

### Development Environment Setup

1. **Fork and Clone the Repository**

```bash
git clone https://github.com/muralianand12345/Pepper-Bot.git
cd Pepper-Bot
```

2. **Install Dependencies**

```bash
npm i -g yarn
yarn
```

3. **Set Up Configuration Files**

```bash
cp .example.env .env.dev
cp config/config.example.yml config/config.yml
```

Edit these files with your development credentials.

4. **Build and Run**

```bash
yarn build
yarn start
```

### Project Structure

```
src/
├── commands/        # Bot commands (slash and message)
│   ├── msg/         # Traditional message commands
│   └── slash/       # Discord slash commands
├── events/          # Event handlers for Discord events
│   ├── client/      # Client-related events
│   ├── database/    # Database-related events
│   ├── log/         # Logging events
│   ├── music/       # Music-related events
├── handlers/        # Command and event handlers
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
│   ├── music/       # Music-related utilities
├── index.ts         # Entry point
├── main.ts          # Main application logic
└── pepper.ts        # Client configuration
```

## How to Contribute

### Reporting Bugs

If you find a bug, please submit an issue with:

- A clear and descriptive title
- Detailed steps to reproduce the bug
- Expected vs actual behavior
- Screenshots (if applicable)
- Any relevant logs or error messages
- Environment details (OS, Node.js version, etc.)

### Suggesting Features

We welcome feature suggestions! Please include:

- A clear and detailed description of the feature
- The problem it would solve
- Any alternatives you've considered
- Any examples from other projects (if applicable)

### Pull Requests

1. **Create a Branch**

```bash
git checkout -b feature/your-feature-name
```

2. **Make Your Changes**

3. **Run Tests and Linting**

4. **Commit Your Changes** (following [commit guidelines](#commit-guidelines))

5. **Push to Your Fork**

```bash
git push origin feature/your-feature-name
```

6. **Submit a Pull Request**
   - Provide a clear description of your changes
   - Link any related issues
   - Explain your approach and design decisions

## Coding Standards

### TypeScript Guidelines

- Use TypeScript for all new code
- Ensure strong typing for all functions and variables
- Avoid using `any` type; use proper interfaces or type aliases
- Use enums for sets of related constants

### Style Guide

- Use 4 spaces for indentation
- Use arrow functions for all new functions
- End files with a newline
- Limit line length to 100 characters
- Use trailing commas in arrays and objects
- Use single quotes for strings
- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
- Use ALL_CAPS for constants

Example:

```typescript
// Good example
const fetchUserData = async (userId: string): Promise<UserData> => {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
};

// Bad example
function fetchUserData(userId) {
    return apiClient.get('/users/' + userId).then(function(response) {
        return response.data;
    });
}
```

### Documentation

- Add JSDoc comments for all public methods and classes
- Keep comments up-to-date when changing code
- Document complex algorithms with detailed comments
- Include examples in documentation for complex functions

Example:

```typescript
/**
 * Formats milliseconds to a readable time string (HH:MM:SS)
 *
 * @param ms - The number of milliseconds to convert
 * @returns Formatted time string in HH:MM:SS format
 * @example
 * ```typescript
 * Formatter.msToTime(3661000); // Returns "01:01:01"
 * ```
 */
public static msToTime(ms: number): string {
    // Implementation...
}
```

## Testing

Currently, the project doesn't have automated tests. If you're adding new features, please consider adding tests as well. We plan to implement a testing framework in the future.

## Commit Guidelines

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Fix bug" not "Fixes bug")
- Limit the first line to 72 characters
- Reference issues and pull requests in the body

Commit types:
- `feat:` - A new feature
- `fix:` - A bug fix
- `docs:` - Documentation changes
- `style:` - Changes that don't affect code meaning (formatting, etc.)
- `refactor:` - Code changes that neither fix a bug nor add a feature
- `perf:` - Performance improvements
- `test:` - Adding or fixing tests
- `chore:` - Changes to the build process or tools

Example:
```
feat: add support for Spotify playlist recommendations

- Implement playlist recommendation algorithm
- Add new command for getting recommendations
- Update documentation

Closes #123
```

## Release Process

1. Ensure all changes for the release are merged to the main branch
2. Update version in `package.json`
3. Run `yarn update-version` to update version across the codebase
4. Create a tag for the new version
5. Push the tag to trigger the release process

Thank you for contributing to Pepper Music Bot!
