#!/bin/bash
#
# setup-vastai.sh
#
# Run this script on your Vast.ai instance to install everything.
# Usage: bash setup-vastai.sh
#

set -e

echo "═══════════════════════════════════════════"
echo "  Sleep Video Generator — Vast.ai Setup"
echo "═══════════════════════════════════════════"

# ============================================
# 1. System dependencies
# ============================================
echo ""
echo "📦 Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq \
    potrace \
    imagemagick \
    ffmpeg \
    chromium-browser \
    curl \
    git \
    2>/dev/null

# ============================================
# 2. Node.js (if not already installed)
# ============================================
if ! command -v node &> /dev/null; then
    echo ""
    echo "📦 Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi

echo "   Node.js: $(node --version)"
echo "   npm: $(npm --version)"

# ============================================
# 3. Python dependencies (Kokoro TTS)
# ============================================
echo ""
echo "🐍 Installing Kokoro TTS..."
pip install -q "kokoro>=0.9" soundfile 2>/dev/null || pip3 install -q "kokoro>=0.9" soundfile

# ============================================
# 4. Project dependencies
# ============================================
echo ""
echo "📦 Installing project dependencies..."
npm install

# ============================================
# 5. Create public directory for Remotion static files
# ============================================
mkdir -p public/voice

# ============================================
# 6. Verify installation
# ============================================
echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Setup Complete! Verification:"
echo "═══════════════════════════════════════════"
echo ""
echo "  Node.js:      $(node --version)"
echo "  npm:          $(npm --version)"
echo "  Python:       $(python3 --version)"
echo "  potrace:      $(potrace --version 2>&1 | head -1)"
echo "  ffmpeg:       $(ffmpeg -version 2>&1 | head -1)"
echo "  ImageMagick:  $(convert --version 2>&1 | head -1)"

# Test Kokoro import
python3 -c "from kokoro import KPipeline; print('  Kokoro TTS:   OK')" 2>/dev/null || echo "  Kokoro TTS:   ❌ Failed"

echo ""
echo "═══════════════════════════════════════════"
echo "  NEXT STEPS:"
echo "═══════════════════════════════════════════"
echo ""
echo "  1. Upload your line-art images to output/images/<scene_id>/"
echo "  2. Edit prompts.json with your scene IDs"
echo "  3. Place your narration in script.txt"
echo "  4. Run the pipeline step by step:"
echo ""
echo "     npm run vectorize             # PNG → SVG"
echo "     npm run preview               # Preview animations"
echo "     npm run generate-voice -- --script script.txt --preview  # Test voice"
echo "     npm run generate-voice -- --script script.txt            # Full voice"
echo "     npm run render                # Final MP4"
echo ""
echo "═══════════════════════════════════════════"
