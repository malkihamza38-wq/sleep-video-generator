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
# 4. Stable Diffusion A1111 (if not running)
# ============================================
if ! curl -s http://127.0.0.1:7860/sdapi/v1/sd-models > /dev/null 2>&1; then
    echo ""
    echo "🎨 Stable Diffusion A1111 is not running."
    echo "   You need to start it separately with:"
    echo ""
    echo "   Option A: Use a Vast.ai template with A1111 pre-installed"
    echo "   Option B: Install manually:"
    echo "     git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git"
    echo "     cd stable-diffusion-webui"
    echo "     ./webui.sh --api --listen --no-half"
    echo ""
    echo "   Then download the LoRA:"
    echo "     Download Line_Art_SDXL.safetensors from CivitAI"
    echo "     Place in stable-diffusion-webui/models/Lora/"
    echo ""
else
    echo "✅ Stable Diffusion A1111 is running at http://127.0.0.1:7860"
fi

# ============================================
# 5. Project dependencies
# ============================================
echo ""
echo "📦 Installing project dependencies..."
npm install

# ============================================
# 6. Create public directory for Remotion static files
# ============================================
mkdir -p public/voice

# ============================================
# 7. Verify installation
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
echo "  1. Start Stable Diffusion (if not running)"
echo "  2. Edit prompts.json with your scene prompts"
echo "  3. Place your narration in script.txt"
echo "  4. (Optional) Place a voice sample in assets/voice-sample.wav"
echo "  5. Run the pipeline step by step:"
echo ""
echo "     npm run generate-images       # Generate line art"
echo "     → Review & delete bad images"
echo "     npm run vectorize             # PNG → SVG"
echo "     npm run preview               # Preview animations"
echo "     npm run generate-voice -- --script script.txt --preview  # Test voice"
echo "     npm run generate-voice -- --script script.txt            # Full voice"
echo "     npm run render                # Final MP4"
echo ""
echo "═══════════════════════════════════════════"
