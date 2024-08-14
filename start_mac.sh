#!/bin/bash

# Update from GitHub if .git directory exists
if [ -d .git ]; then
    echo "Updating from GitHub..."
    git pull
fi

# Install dependencies if package.json exists
if [ -f package.json ]; then
    echo "Installing dependencies..."
    npm install
fi

# Install additional Node packages if NODE_PACKAGES env variable is set
if [ -n "${NODE_PACKAGES}" ]; then
    echo "Installing additional packages: ${NODE_PACKAGES}"
    npm install ${NODE_PACKAGES}
fi

# Build the TypeScript application
echo "Building the TypeScript application..."
npm run build

# Run the application
echo "Running the application..."
node build/index.js