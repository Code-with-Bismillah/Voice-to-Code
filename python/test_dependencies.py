#!/usr/bin/env python3
"""
Test script to check all dependencies and their versions
"""

import sys
import subprocess

def test_dependency(module_name, import_name=None):
    """Test if a dependency is available and get its version"""
    if import_name is None:
        import_name = module_name
    
    try:
        module = __import__(import_name)
        version = getattr(module, '__version__', 'Unknown version')
        print(f"✓ {module_name}: {version}")
        return True
    except ImportError as e:
        print(f"✗ {module_name}: Not installed ({e})")
        return False

def test_ffmpeg():
    """Test if ffmpeg is available"""
    try:
        result = subprocess.run(['ffmpeg', '-version'], 
                              stdout=subprocess.PIPE, 
                              stderr=subprocess.PIPE, 
                              text=True)
        if result.returncode == 0:
            # Extract version from output
            lines = result.stdout.split('\n')
            version_line = lines[0] if lines else "Unknown version"
            print(f"✓ ffmpeg: {version_line}")
            return True
        else:
            print(f"✗ ffmpeg: Command failed")
            return False
    except FileNotFoundError:
        print(f"✗ ffmpeg: Not found in PATH")
        return False
    except Exception as e:
        print(f"✗ ffmpeg: Error ({e})")
        return False

def main():
    print("Voice to Code - Dependency Check")
    print("=" * 40)
    print(f"Python version: {sys.version}")
    print("=" * 40)
    
    # Test required dependencies
    print("\nRequired Dependencies:")
    speech_recognition_ok = test_dependency("SpeechRecognition", "speech_recognition")
    pydub_ok = test_dependency("pydub")
    
    # Test optional dependencies
    print("\nOptional Dependencies:")
    moviepy_ok = test_dependency("moviepy")
    ffmpeg_python_ok = test_dependency("ffmpeg-python", "ffmpeg")
    ffmpeg_ok = test_ffmpeg()
    
    print("\n" + "=" * 40)
    
    if speech_recognition_ok and pydub_ok:
        print("✓ All required dependencies are installed!")
        
        if ffmpeg_ok:
            print("✓ FFmpeg is available for video processing")
        elif moviepy_ok:
            print("⚠ FFmpeg not found, but MoviePy is available as fallback")
        else:
            print("⚠ No video processing capability (install FFmpeg or MoviePy)")
            
        print("\nYou can now use the Voice to Code extension!")
        
    else:
        print("✗ Missing required dependencies!")
        print("\nTo install missing dependencies, run:")
        
        missing = []
        if not speech_recognition_ok:
            missing.append("SpeechRecognition")
        if not pydub_ok:
            missing.append("pydub")
        if not moviepy_ok and not ffmpeg_ok:
            missing.append("moviepy")
            
        print(f"pip install {' '.join(missing)}")

if __name__ == "__main__":
    main()
