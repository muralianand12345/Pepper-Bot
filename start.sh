#!/bin/bash

if [[ -d .git ]]; then
    echo "Updating from GitHub..."
    git pull
fi

if ! command -v yarn &> /dev/null; then
    echo "Yarn is not installed. Installing Yarn..."
    npm install -g yarn
fi

if [ -f package.json ]; then
    echo "Installing dependencies..."
    yarn install
fi

echo "Building the TypeScript application..."
yarn build

echo "Running the application..."
node build/index.js