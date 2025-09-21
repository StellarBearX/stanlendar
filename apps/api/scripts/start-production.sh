#!/bin/bash

# Production startup script for NestJS API
set -e

echo "🚀 Starting Class Schedule Sync API in production mode..."

# Check required environment variables
required_vars=(
  "DATABASE_URL"
  "REDIS_URL"
  "JWT_SECRET"
  "ENCRYPTION_KEY"
  "GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET"
  "FRONTEND_URL"
)

echo "📋 Checking required environment variables..."
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Error: Required environment variable $var is not set"
    exit 1
  fi
  echo "✅ $var is set"
done

# Validate critical configurations
echo "🔍 Validating configurations..."

# Check JWT secret length (minimum 32 characters)
if [ ${#JWT_SECRET} -lt 32 ]; then
  echo "❌ Error: JWT_SECRET must be at least 32 characters long"
  exit 1
fi

# Check encryption key length (must be 64 hex characters for 32 bytes)
if [ ${#ENCRYPTION_KEY} -ne 64 ]; then
  echo "❌ Error: ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"
  exit 1
fi

echo "✅ Configuration validation passed"

# Run database migrations
echo "🗄️  Running database migrations..."
npm run migration:run || {
  echo "❌ Database migration failed"
  exit 1
}

echo "✅ Database migrations completed"

# Warm up the application
echo "🔥 Warming up application..."
export NODE_ENV=production
export PORT=${PORT:-3001}

# Start the application
echo "🎯 Starting application on port $PORT..."
exec node dist/main.js