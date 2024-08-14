#!/bin/bash

eval "$(ssh-agent -s)"

ssh-add ~/.ssh/id_ed25519

if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Installing Node.js..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
fi

if ! command -v yarn &> /dev/null; then
    echo "Yarn is not installed. Installing Yarn..."
    npm install -g yarn
fi

if [[ -d .git ]]; then
    echo "Updating from GitHub..."
    git pull
fi

echo "Installing dependencies..."
yarn install

echo "Building the TypeScript application..."
yarn build

echo "Running the application..."
node build/index.js