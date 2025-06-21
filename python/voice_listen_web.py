#!/usr/bin/env python3
"""
Alternative voice listening script using web-based speech recognition
Works without PyAudio system dependencies
"""

import speech_recognition as sr
import sys
import time
import signal
import threading
from queue import Queue
import json

class WebVoiceListener:
    def __init__(self, language='en-US'):
        self.language = language
        self.recognizer = sr.Recognizer()
        self.is_listening = True
        
        # Try to get microphone, fallback gracefully
        try:
            self.microphone = sr.Microphone()
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
            
        except Exception as e:
            print(f"Microphone initialization failed: {e}", file=sys.stderr, flush=True)
            sys.exit(1)

    def listen_once(self):
        """Listen for a single phrase"""
        try:
            with self.microphone as source:
                print("Listening... (speak now)", file=sys.stderr, flush=True)
                audio = self.recognizer.listen(source, timeout=1, phrase_time_limit=5)
                
            # Recognize speech using Google Speech Recognition
            text = self.recognizer.recognize_google(audio, language=self.language)
            if text.strip():
                print(text, flush=True)
                
        except sr.WaitTimeoutError:
            # No speech detected, continue listening
            pass
        except sr.UnknownValueError:
            # Speech was unintelligible
            pass
        except sr.RequestError as e:
            print(f"Could not request results from speech recognition service: {e}", 
                  file=sys.stderr, flush=True)
        except Exception as e:
            print(f"Error in speech recognition: {e}", file=sys.stderr, flush=True)

    def start_listening(self):
        """Start continuous listening"""
        print("Voice listening started. Speak now...", file=sys.stderr, flush=True)
        
        while self.is_listening:
            try:
                self.listen_once()
                time.sleep(0.1)  # Small delay to prevent excessive CPU usage
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"Error in listening loop: {e}", file=sys.stderr, flush=True)
                time.sleep(1)  # Wait before retrying

    def stop(self):
        """Stop listening"""
        self.is_listening = False

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
        listener = WebVoiceListener(language)
        listener.start_listening()
        
    except KeyboardInterrupt:
        print("Voice listening interrupted by user", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr, flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
