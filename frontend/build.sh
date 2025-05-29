#!/bin/bash

# Install dependencies
npm install

# Create a .env.production file if it doesn't exist
if [ ! -f .env.production ]; then
  echo "Creating .env.production file..."
  cat > .env.production << EOL
REACT_APP_DJANGO_API_URL=https://whos-the-better-human-backend.onrender.com/
REACT_APP_SOCKET_URL=https://whos-the-better-human-socket.onrender.com
REACT_APP_ENV=production
EOL
fi

# Create production build
npm run build

# Ensure _redirects file exists in the build directory
echo "/* /index.html 200" > build/_redirects

echo "Build complete! You can now deploy the 'build' directory to Render."