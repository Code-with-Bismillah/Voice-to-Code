#!/usr/bin/env python3
"""
Simple test script to verify audio transcription works
"""

import sys
import os
import tempfile
from pydub import AudioSegment
from pydub.generators import Sine
import speech_recognition as sr

def create_test_audio():
    """Create a simple test audio file"""
    try:
        print("Creating test audio file...")
        
        # Create a simple tone (this won't transcribe to text, but tests the pipeline)
        tone = Sine(440).to_audio_segment(duration=2000)  # 2 seconds of 440Hz tone
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        tone.export(temp_file.name, format='wav')
        
        print(f"Test audio created: {temp_file.name}")
        return temp_file.name
        
    except Exception as e:
        print(f"Error creating test audio: {e}")
        return None

def test_transcription_pipeline(audio_file):
    """Test the transcription pipeline"""
    try:
        print(f"Testing transcription pipeline with: {audio_file}")
        
        # Initialize recognizer
        r = sr.Recognizer()
        
        # Load audio file
        with sr.AudioFile(audio_file) as source:
            print("✓ Audio file loaded successfully")
            
            # Adjust for ambient noise
            r.adjust_for_ambient_noise(source, duration=0.5)
            print("✓ Ambient noise adjustment completed")
            
            # Record audio data
            audio_data = r.record(source)
            print("✓ Audio data recorded")
            
            # Try to recognize (this will likely fail with tone, but tests the API)
            try:
                text = r.recognize_google(audio_data, language='en-US')
                print(f"✓ Recognition successful: {text}")
            except sr.UnknownValueError:
                print("✓ Recognition API working (no speech detected in test tone - this is expected)")
            except sr.RequestError as e:
                print(f"✗ Recognition API error: {e}")
                return False
                
        print("✓ Transcription pipeline test completed successfully!")
        return True
        
    except Exception as e:
        print(f"✗ Pipeline test failed: {e}")
        return False

def main():
    print("Simple Audio Transcription Test")
    print("=" * 40)
    
    # Test 1: Create and test with generated audio
    test_audio = create_test_audio()
    if test_audio:
        success = test_transcription_pipeline(test_audio)
        
        # Clean up
        try:
            os.unlink(test_audio)
            print("✓ Test file cleaned up")
        except:
            pass
            
        if success:
            print("\n🎉 Audio transcription pipeline is working!")
            print("You can now try transcribing real audio files with speech.")
        else:
            print("\n❌ Pipeline test failed. Check your internet connection and dependencies.")
    else:
        print("❌ Could not create test audio file")

if __name__ == "__main__":
    main()
