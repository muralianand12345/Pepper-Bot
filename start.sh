#!/bin/bash

if [[ -d .git ]]; then
    echo "Updating from GitHub..."
    git pull
fi

if [ -f package.json ]; then
    echo "Installing dependencies..."
    npm install
fi

if [[ ! -z ${NODE_PACKAGES} ]]; then
    echo "Installing additional packages: ${NODE_PACKAGES}"
    npm install ${NODE_PACKAGES}
fi

echo "Building the TypeScript application..."
npm run build

echo "Running the application..."
node build/index.js