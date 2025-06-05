#!/bin/bash

# VibeCal Startup Script

echo "🚀 Starting VibeCal..."

# Check if .env exists, if not copy from example
if [ ! -f .env ]; then
    echo "📄 Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  Please review and update .env file with your configuration"
fi

# Build and start services
echo "🔨 Building Docker containers..."
docker-compose build

echo "🐘 Starting database..."
docker-compose up -d postgres

echo "⏳ Waiting for database to be ready..."
sleep 10

echo "🌐 Starting application services..."
docker-compose up -d

echo "✅ VibeCal is starting up!"
echo ""
echo "📍 Access the application at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5000"
echo ""
echo "📊 To view logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 To stop the application:"
echo "   docker-compose down"