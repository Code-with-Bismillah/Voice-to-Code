#!/usr/bin/env python3
"""
Enhanced audio/video file transcription script for VS Code extension
Transcribes audio and video files to text using speech recognition
Supports multiple formats including MP4, AVI, MKV, OPUS, etc.
"""

import speech_recognition as sr
import sys
import os
import tempfile
import subprocess
import traceback

def check_dependencies():
    """Check if required dependencies are available"""
    missing_deps = []
    available_deps = []
    
    try:
        import speech_recognition
        available_deps.append("SpeechRecognition")
    except ImportError:
        missing_deps.append("SpeechRecognition")
    
    try:
        import pydub
        available_deps.append("pydub")
    except ImportError:
        missing_deps.append("pydub")
    
    # Check for ffmpeg (optional but recommended)
    ffmpeg_available = False
    try:
        result = subprocess.run(['ffmpeg', '-version'], 
                              stdout=subprocess.DEVNULL, 
                              stderr=subprocess.DEVNULL, 
                              check=True)
        ffmpeg_available = True
        available_deps.append("ffmpeg")
    except (subprocess.CalledProcessError, FileNotFoundError):
        missing_deps.append("ffmpeg (optional)")
    
    # Check for moviepy as fallback
    try:
        import moviepy
        available_deps.append("moviepy")
    except ImportError:
        if not ffmpeg_available:
            missing_deps.append("moviepy")
    
    print(f"Available dependencies: {', '.join(available_deps)}", file=sys.stderr, flush=True)
    
    if missing_deps:
        print(f"Missing dependencies: {', '.join(missing_deps)}", file=sys.stderr, flush=True)
        if "SpeechRecognition" in missing_deps or "pydub" in missing_deps:
            print("Critical dependencies missing. Please install with:", file=sys.stderr, flush=True)
            print("pip install SpeechRecognition pydub", file=sys.stderr, flush=True)
            return False
    
    return True

class MediaTranscriber:
    def __init__(self, language='en-US'):
        self.language = language
        self.recognizer = sr.Recognizer()
        
        # Set recognition parameters
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True
        
        # Check for ffmpeg
        self.ffmpeg_available = self.check_ffmpeg()
        print(f"FFmpeg available: {self.ffmpeg_available}", file=sys.stderr, flush=True)

    def check_ffmpeg(self):
        """Check if ffmpeg is available"""
        try:
            subprocess.run(['ffmpeg', '-version'], 
                         stdout=subprocess.DEVNULL, 
                         stderr=subprocess.DEVNULL, 
                         check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def extract_audio_from_video_simple(self, video_file_path):
        """Simple audio extraction using pydub only"""
        try:
            from pydub import AudioSegment
            
            print(f"Extracting audio using pydub: {video_file_path}", file=sys.stderr, flush=True)
            
            # Create temporary audio file
            temp_audio = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            temp_audio_path = temp_audio.name
            temp_audio.close()
            
            # Try to load video file directly with pydub
            audio = AudioSegment.from_file(video_file_path)
            
            # Convert to mono and set sample rate for better recognition
            audio = audio.set_channels(1).set_frame_rate(16000)
            
            # Export as WAV
            audio.export(temp_audio_path, format='wav')
            
            return temp_audio_path
            
        except Exception as e:
            print(f"Error extracting audio with pydub: {e}", file=sys.stderr, flush=True)
            raise

    def extract_audio_from_video_ffmpeg(self, video_file_path):
        """Extract audio from video file using ffmpeg"""
        try:
            print(f"Extracting audio using ffmpeg: {video_file_path}", file=sys.stderr, flush=True)
            
            # Create temporary audio file
            temp_audio = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            temp_audio_path = temp_audio.name
            temp_audio.close()
            
            # Use ffmpeg to extract audio
            cmd = [
                'ffmpeg', '-i', video_file_path,
                '-vn',  # No video
                '-acodec', 'pcm_s16le',  # PCM 16-bit
                '-ar', '16000',  # 16kHz sample rate
                '-ac', '1',  # Mono
                '-y',  # Overwrite output file
                temp_audio_path
            ]
            
            print(f"Running ffmpeg command: {' '.join(cmd)}", file=sys.stderr, flush=True)
            
            result = subprocess.run(cmd, 
                                  stdout=subprocess.PIPE, 
                                  stderr=subprocess.PIPE, 
                                  text=True)
            
            if result.returncode != 0:
                print(f"FFmpeg stderr: {result.stderr}", file=sys.stderr, flush=True)
                raise Exception(f"FFmpeg failed with return code {result.returncode}")
            
            return temp_audio_path
            
        except Exception as e:
            print(f"Error extracting audio with ffmpeg: {e}", file=sys.stderr, flush=True)
            raise

    def convert_to_wav(self, media_file_path):
        """Convert media file to WAV format for speech recognition"""
        try:
            from pydub import AudioSegment
            
            # Get file extension
            file_ext = os.path.splitext(media_file_path)[1].lower()
            print(f"Processing file with extension: {file_ext}", file=sys.stderr, flush=True)
            
            # Video formats - extract audio first
            video_formats = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp']
            if file_ext in video_formats:
                if self.ffmpeg_available:
                    try:
                        return self.extract_audio_from_video_ffmpeg(media_file_path)
                    except Exception as e:
                        print(f"FFmpeg failed, trying pydub: {e}", file=sys.stderr, flush=True)
                        return self.extract_audio_from_video_simple(media_file_path)
                else:
                    return self.extract_audio_from_video_simple(media_file_path)
            
            # Already WAV
            if file_ext == '.wav':
                print("File is already WAV format", file=sys.stderr, flush=True)
                return media_file_path
            
            # Audio formats
            print(f"Converting audio file: {media_file_path}", file=sys.stderr, flush=True)
            
            # Load audio file with pydub
            audio = None
            
            try:
                if file_ext == '.mp3':
                    audio = AudioSegment.from_mp3(media_file_path)
                elif file_ext == '.m4a':
                    audio = AudioSegment.from_file(media_file_path, format="m4a")
                elif file_ext == '.ogg':
                    audio = AudioSegment.from_ogg(media_file_path)
                elif file_ext == '.flac':
                    audio = AudioSegment.from_file(media_file_path, format="flac")
                elif file_ext == '.opus':
                    audio = AudioSegment.from_file(media_file_path, format="opus")
                elif file_ext == '.aac':
                    audio = AudioSegment.from_file(media_file_path, format="aac")
                elif file_ext == '.wma':
                    audio = AudioSegment.from_file(media_file_path, format="wma")
                elif file_ext == '.webm':
                    audio = AudioSegment.from_file(media_file_path, format="webm")
                else:
                    # Try to load as generic audio file
                    print(f"Trying to load {file_ext} as generic audio file", file=sys.stderr, flush=True)
                    audio = AudioSegment.from_file(media_file_path)
                
                if audio is None:
                    raise Exception("Could not load audio file")
                
                print(f"Audio loaded successfully. Duration: {len(audio)}ms", file=sys.stderr, flush=True)
                
                # Convert to mono and set sample rate for better recognition
                audio = audio.set_channels(1).set_frame_rate(16000)
                
                # Create temporary WAV file
                temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                audio.export(temp_wav.name, format='wav')
                
                print(f"Audio converted to WAV: {temp_wav.name}", file=sys.stderr, flush=True)
                return temp_wav.name
                
            except Exception as e:
                print(f"Error loading audio with pydub: {e}", file=sys.stderr, flush=True)
                raise Exception(f"Could not load audio file: {e}")
            
        except ImportError as e:
            print(f"Import error: {e}", file=sys.stderr, flush=True)
            raise Exception("pydub not available")
        except Exception as e:
            print(f"Error converting media file: {e}", file=sys.stderr, flush=True)
            raise

    def transcribe_media_file(self, media_file_path):
        """Transcribe a media file to text"""
        temp_wav_path = None
        
        try:
            print(f"Starting transcription of: {media_file_path}", file=sys.stderr, flush=True)
            
            # Check if file exists
            if not os.path.exists(media_file_path):
                raise Exception(f"File not found: {media_file_path}")
            
            # Get file size
            file_size = os.path.getsize(media_file_path)
            print(f"File size: {file_size} bytes ({file_size / (1024*1024):.2f} MB)", file=sys.stderr, flush=True)
            
            # Convert to WAV if necessary
            wav_file_path = self.convert_to_wav(media_file_path)
            if wav_file_path != media_file_path:
                temp_wav_path = wav_file_path
            
            print(f"Using WAV file: {wav_file_path}", file=sys.stderr, flush=True)
            
            # Load audio file for recognition
            with sr.AudioFile(wav_file_path) as source:
                print("Loading audio file for recognition...", file=sys.stderr, flush=True)
                
                # Get audio info
                print(f"Audio duration: {source.DURATION} seconds", file=sys.stderr, flush=True)
                print(f"Sample rate: {source.SAMPLE_RATE} Hz", file=sys.stderr, flush=True)
                print(f"Sample width: {source.SAMPLE_WIDTH} bytes", file=sys.stderr, flush=True)
                
                # Adjust for noise
                print("Adjusting for ambient noise...", file=sys.stderr, flush=True)
                self.recognizer.adjust_for_ambient_noise(source, duration=1.0)
                
                # Read the entire audio file
                print("Reading audio data...", file=sys.stderr, flush=True)
                audio_data = self.recognizer.record(source)
            
            print("Starting speech recognition...", file=sys.stderr, flush=True)
            
            # Recognize speech using Google Speech Recognition
            text = self.recognizer.recognize_google(audio_data, language=self.language)
            
            if text.strip():
                print("TRANSCRIPTION_START", flush=True)
                print(text, flush=True)
                print("TRANSCRIPTION_END", flush=True)
            else:
                print("No speech detected in media file", file=sys.stderr, flush=True)
                
        except sr.UnknownValueError:
            print("Could not understand audio in the file", file=sys.stderr, flush=True)
        except sr.RequestError as e:
            print(f"Could not request results from speech recognition service: {e}", 
                  file=sys.stderr, flush=True)
        except Exception as e:
            print(f"Error transcribing media file: {e}", file=sys.stderr, flush=True)
            print(f"Traceback: {traceback.format_exc()}", file=sys.stderr, flush=True)
        finally:
            # Clean up temporary file
            if temp_wav_path and os.path.exists(temp_wav_path):
                try:
                    os.unlink(temp_wav_path)
                    print(f"Cleaned up temporary file: {temp_wav_path}", file=sys.stderr, flush=True)
                except Exception as e:
                    print(f"Could not clean up temporary file: {e}", file=sys.stderr, flush=True)

def main():
    print("Audio transcription script starting...", file=sys.stderr, flush=True)
    print(f"Python version: {sys.version}", file=sys.stderr, flush=True)
    print(f"Arguments: {sys.argv}", file=sys.stderr, flush=True)
    
    if len(sys.argv) < 2:
        print("Usage: python audio_transcribe.py <media_file_path> [language] [chunk_mode]", file=sys.stderr)
        sys.exit(1)
    
    # Check dependencies first
    print("Checking dependencies...", file=sys.stderr, flush=True)
    if not check_dependencies():
        print("Dependencies check failed", file=sys.stderr, flush=True)
        sys.exit(1)
    
    media_file_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else 'en-US'
    chunk_mode = sys.argv[3] if len(sys.argv) > 3 else 'false'
    
    print(f"Media file: {media_file_path}", file=sys.stderr, flush=True)
    print(f"Language: {language}", file=sys.stderr, flush=True)
    print(f"Chunk mode: {chunk_mode}", file=sys.stderr, flush=True)
    
    if not os.path.exists(media_file_path):
        print(f"Media file not found: {media_file_path}", file=sys.stderr)
        sys.exit(1)
    
    try:
        transcriber = MediaTranscriber(language)
        
        if chunk_mode.lower() == 'true':
            print("Using chunk mode (not implemented in this version)", file=sys.stderr, flush=True)
            transcriber.transcribe_media_file(media_file_path)
        else:
            transcriber.transcribe_media_file(media_file_path)
            
        print("Transcription completed successfully", file=sys.stderr, flush=True)
            
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr, flush=True)
        print(f"Traceback: {traceback.format_exc()}", file=sys.stderr, flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
