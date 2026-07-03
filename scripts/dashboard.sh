#!/bin/bash

# Tab & Bookmark Manager Dashboard
# This script runs the CLI dashboard to show key metrics

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$DIR/../backend"

echo "Starting Tab & Bookmark Manager Dashboard..."
cd "$BACKEND_DIR"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

# Run the dashboard
npm run dashboard
