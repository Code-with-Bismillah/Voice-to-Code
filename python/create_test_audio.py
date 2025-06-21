#!/usr/bin/env python3
"""
Create a test audio file with speech for testing transcription
"""

import sys
import os
from pydub import AudioSegment
from pydub.generators import Sine
import tempfile

def create_test_audio_with_speech():
    """Create a test audio file that says 'Hello World' using text-to-speech if available"""
    try:
        # Try to use system text-to-speech to create a test file
        import subprocess
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        temp_file.close()
        
        # Try different TTS commands based on the system
        tts_commands = [
            # Linux with espeak
            ['espeak', '-w', temp_file.name, 'Hello world, this is a test for voice to code extension'],
            # macOS with say
            ['say', '-o', temp_file.name, '--data-format=LEF32@22050', 'Hello world, this is a test for voice to code extension'],
            # Windows with PowerShell (if available)
            ['powershell', '-Command', f'Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.SetOutputToWaveFile("{temp_file.name}"); $synth.Speak("Hello world, this is a test for voice to code extension"); $synth.Dispose()']
        ]
        
        for cmd in tts_commands:
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                if result.returncode == 0 and os.path.exists(temp_file.name) and os.path.getsize(temp_file.name) > 0:
                    print(f"✓ Test audio created using: {cmd[0]}")
                    print(f"✓ File: {temp_file.name}")
                    print(f"✓ Size: {os.path.getsize(temp_file.name)} bytes")
                    return temp_file.name
            except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.CalledProcessError):
                continue
        
        # If TTS fails, create a simple tone as fallback
        print("⚠ TTS not available, creating simple tone for pipeline test")
        tone = Sine(440).to_audio_segment(duration=3000)  # 3 seconds
        tone.export(temp_file.name, format='wav')
        print(f"✓ Test tone created: {temp_file.name}")
        return temp_file.name
        
    except Exception as e:
        print(f"✗ Error creating test audio: {e}")
        return None

def download_sample_audio():
    """Download a sample audio file from the internet"""
    try:
        import urllib.request
        
        # Sample audio URLs (public domain or creative commons)
        sample_urls = [
            "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav",
            "https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand60.wav"
        ]
        
        for i, url in enumerate(sample_urls):
            try:
                filename = f"sample_audio_{i+1}.wav"
                print(f"Downloading sample audio from: {url}")
                urllib.request.urlretrieve(url, filename)
                
                if os.path.exists(filename) and os.path.getsize(filename) > 0:
                    print(f"✓ Downloaded: {filename}")
                    return filename
                    
            except Exception as e:
                print(f"Failed to download from {url}: {e}")
                continue
                
        return None
        
    except ImportError:
        print("urllib not available for downloading")
        return None

def main():
    print("Creating Test Audio for Voice to Code")
    print("=" * 40)
    
    # Try to create speech audio first
    test_file = create_test_audio_with_speech()
    
    if not test_file:
        # Try to download sample audio
        test_file = download_sample_audio()
    
    if test_file:
        print(f"\n✓ Test audio ready: {test_file}")
        print(f"✓ File size: {os.path.getsize(test_file)} bytes")
        
        # Test the transcription
        print("\nTesting transcription...")
        import subprocess
        try:
            result = subprocess.run([
                sys.executable, 'audio_transcribe.py', 
                test_file, 'en-US', 'false'
            ], capture_output=True, text=True, timeout=30)
            
            print("STDOUT:")
            print(result.stdout)
            print("STDERR:")
            print(result.stderr)
            print(f"Return code: {result.returncode}")
            
        except subprocess.TimeoutExpired:
            print("⚠ Transcription timed out (this might be normal for the first run)")
        except Exception as e:
            print(f"Error running transcription: {e}")
            
    else:
        print("❌ Could not create or download test audio")
        print("\nYou can manually create a test by:")
        print("1. Recording a short audio file (MP3, WAV)")
        print("2. Saving it as 'test_audio.wav' in this directory")
        print("3. Running: python audio_transcribe.py test_audio.wav en-US false")

if __name__ == "__main__":
    main()
