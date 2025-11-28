#!/bin/bash

# Mantys API Setup Script for Aster Clinic
# This script creates the .env.local file with your Mantys credentials

echo "🚀 Setting up Mantys API for Aster Clinic..."
echo ""

# Check if .env.local already exists
if [ -f .env.local ]; then
    echo "⚠️  .env.local already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled."
        exit 1
    fi
fi

# Create .env.local file
cat > .env.local << 'EOF'
# Mantys API Configuration for Aster Clinic
MANTYS_API_URL=https://aster.api.mantys.org
MANTYS_API_KEY=api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab
CLINIC_ID_ASTER=92d5da39-36af-4fa2-bde3-3828600d7871
DEFAULT_CLINIC=ASTER
EOF

echo "✅ .env.local created successfully!"
echo ""
echo "📋 Configuration:"
echo "   API URL: https://aster.api.mantys.org"
echo "   Clinic ID: 92d5da39-36af-4fa2-bde3-3828600d7871"
echo ""
echo "🎯 Next Steps:"
echo "   1. Restart your development server:"
echo "      npm run dev"
echo ""
echo "   2. Test the integration:"
echo "      - Go to Dashboard"
echo "      - Search for a patient"
echo "      - Click 'Check Eligibility with Mantys'"
echo ""
echo "✨ Setup complete! Happy eligibility checking! 🏥"

