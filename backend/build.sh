#!/bin/bash

# Install dependencies
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file..."
  cat > .env << EOL
NODE_ENV=production
DJANGO_API_URL=https://whos-the-better-human-backend.onrender.com/
FRONTEND_URL=https://whos-the-better-human-v83v.onrender.com
EOL
fi

echo "Build complete!" 