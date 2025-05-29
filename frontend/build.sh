#!/bin/bash

# Install dependencies
npm install

# Create production build
npm run build

# Create a .env.production file if it doesn't exist
if [ ! -f .env.production ]; then
  echo "Creating .env.production file..."
  cat > .env.production << EOL
# Production API URLs - Update these with your Render URLs
REACT_APP_DJANGO_API_URL=https://your-django-app.onrender.com
REACT_APP_SOCKET_URL=https://your-socket-app.onrender.com
REACT_APP_ENV=production
EOL
fi

echo "Build complete! You can now deploy the 'build' directory to Render."
echo "Make sure to update the API URLs in .env.production with your actual Render URLs."