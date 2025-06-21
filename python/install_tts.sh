#!/bin/bash
# Install text-to-speech for creating test audio

echo "Installing text-to-speech tools..."

# For Ubuntu/Debian (Codespaces)
if command -v apt-get &> /dev/null; then
    echo "Installing espeak for Ubuntu/Debian..."
    sudo apt-get update
    sudo apt-get install -y espeak espeak-data
fi

# For macOS
if command -v brew &> /dev/null; then
    echo "macOS detected - 'say' command should be available"
fi

echo "Testing TTS installation..."
if command -v espeak &> /dev/null; then
    echo "✓ espeak is available"
    espeak "Hello world" 2>/dev/null || echo "⚠ espeak installed but may need audio setup"
elif command -v say &> /dev/null; then
    echo "✓ say command is available (macOS)"
else
    echo "⚠ No TTS found, will use tone generation for testing"
fi

echo "Done!"
