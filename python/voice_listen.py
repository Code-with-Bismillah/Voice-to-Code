#!/usr/bin/env python3
"""
Voice listening script for VS Code extension
Converts speech to text using speech recognition
"""

import speech_recognition as sr
import sys
import json
import time
import threading
from queue import Queue
import signal

class VoiceListener:
    def __init__(self, language='en-US'):
        self.language = language
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        self.audio_queue = Queue()
        self.is_listening = True
        
        # Adjust for ambient noise
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source, duration=1)
        
        # Set recognition parameters
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.8
        self.recognizer.operation_timeout = None
        self.recognizer.phrase_threshold = 0.3
        self.recognizer.non_speaking_duration = 0.8

    def audio_callback(self, recognizer, audio):
        """Callback function to handle audio data"""
        self.audio_queue.put(audio)

    def start_listening(self):
        """Start continuous listening in background"""
        try:
            # Start background listening
            self.stop_listening = self.recognizer.listen_in_background(
                self.microphone, 
                self.audio_callback,
                phrase_time_limit=5
            )
            
            print("Voice listening started. Speak now...", flush=True)
            
            # Process audio queue
            while self.is_listening:
                try:
                    if not self.audio_queue.empty():
                        audio = self.audio_queue.get(timeout=1)
                        self.process_audio(audio)
                    else:
                        time.sleep(0.1)
                except Exception as e:
                    print(f"Error processing audio: {e}", file=sys.stderr, flush=True)
                    
        except Exception as e:
            print(f"Error starting voice recognition: {e}", file=sys.stderr, flush=True)
            sys.exit(1)

    def process_audio(self, audio):
        """Process audio and convert to text"""
        try:
            # Recognize speech using Google Speech Recognition
            text = self.recognizer.recognize_google(audio, language=self.language)
            if text.strip():
                print(text, flush=True)
                
        except sr.UnknownValueError:
            # Speech was unintelligible
            pass
        except sr.RequestError as e:
            print(f"Could not request results from speech recognition service: {e}", 
                  file=sys.stderr, flush=True)
        except Exception as e:
            print(f"Error in speech recognition: {e}", file=sys.stderr, flush=True)

    def stop(self):
        """Stop listening"""
        self.is_listening = False
        if hasattr(self, 'stop_listening'):
            self.stop_listening(wait_for_stop=False)

def signal_handler(signum, frame):
    """Handle interrupt signals"""
    print("Stopping voice listener...", file=sys.stderr, flush=True)
    sys.exit(0)

def main():
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Get language from command line argument
    language = sys.argv[1] if len(sys.argv) > 1 else 'en-US'
    
    try:
        # Create and start voice listener
        listener = VoiceListener(language)
        listener.start_listening()
        
    except KeyboardInterrupt:
        print("Voice listening interrupted by user", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr, flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
