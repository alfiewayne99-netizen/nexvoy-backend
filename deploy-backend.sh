#!/bin/bash
# deploy-backend.sh - Backend deployment helper

echo "==================================="
echo "  NEXVOY BACKEND DEPLOYMENT"
echo "==================================="
echo ""

# Check if we have required files
if [ ! -f "app.js" ]; then
    echo "❌ Error: app.js not found in current directory"
    exit 1
fi

echo "✅ Backend files found"
echo ""

echo "Choose deployment platform:"
echo "1) Render (Recommended - Free tier)"
echo "2) Railway"
echo "3) Manual deployment"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "📦 Preparing for Render deployment..."
        echo ""
        echo "Next steps:"
        echo "1. Go to https://dashboard.render.com"
        echo "2. Click 'New +' → 'Web Service'"
        echo "3. Connect your GitHub repo"
        echo "4. Use these settings:"
        echo "   - Build Command: npm install"
        echo "   - Start Command: node app.js"
        echo ""
        echo "Or use the render.yaml file in this directory"
        echo ""
        cat render.yaml
        ;;
    2)
        echo ""
        echo "📦 Preparing for Railway deployment..."
        echo ""
        echo "Next steps:"
        echo "1. Go to https://railway.app"
        echo "2. Click 'New Project' → 'Deploy from GitHub'"
        echo "3. Railway will auto-detect and deploy"
        echo ""
        echo "Railway config (railway.json):"
        cat railway.json
        ;;
    3)
        echo ""
        echo "📦 Manual deployment selected"
        echo ""
        echo "Make sure you have:"
        echo "✅ Node.js 18+ installed"
        echo "✅ All environment variables set"
        echo ""
        echo "To start locally:"
        echo "  npm install"
        echo "  npm start"
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "==================================="
echo "Don't forget to set environment variables!"
echo "See DEPLOYMENT.md for the full checklist"
echo "==================================="
