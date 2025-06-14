#!/bin/bash

# Install Python dependencies
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --noinput

# Run migrations
python manage.py migrate

# Create a .env file if it doesn't exist (for deployment)
if [ ! -f .env ]; then
  echo "Creating .env file..."
  cat > .env << EOL
DJANGO_SETTINGS_MODULE=server.settings
PYTHONPATH=/opt/render/project/src/backend/django-backend
EOL
fi 