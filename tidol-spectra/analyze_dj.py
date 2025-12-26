import sys
import json
import os
import traceback

# Add mix-engine to path if needed, or assume installed
try:
    from mix_engine.preloader import d_Song
except ImportError:
    # Fallback if installed in editable mode but not in path
    sys.path.append(os.path.join(os.path.dirname(__file__), 'mix-engine', 'src'))
    from mix_engine.preloader import d_Song

def analyze_song(file_path):
    try:
        if not os.path.exists(file_path):
            return {"error": "File not found"}

        # Load song using mix-engine's d_Song
        song = d_Song(file_path)
        
        # 1. BPM (Tempo)
        bpm = song.get_tempo()
        
        # 2. Key (Pitch)
        # d_Song uses librosa internally, get_pitch returns pitch class
        # We might need to map it to Camelot or OpenKey if possible, but raw is fine for now
        key = song.get_pitch() 
        
        # 3. Cue Points (Intro/Outro windows)
        # compute_windows calculates the best segments for mixing
        song.compute_windows()
        
        # song.windows is a tuple: ( (intro_start, intro_end), (outro_start, outro_end) )
        # Indices are in SAMPLES. We need to convert to SECONDS.
        sr = song.sr if hasattr(song, 'sr') else 44100
        
        # Intro window (Best place to mix IN)
        intro_window = song.windows[0] 
        cue_in = intro_window[0] / sr # Start of intro
        
        # Outro window (Best place to mix OUT)
        outro_window = song.windows[1]
        cue_out = outro_window[0] / sr # Start of outro
        
        return {
            "bpm": float(bpm),
            "musical_key": str(key),
            "cue_in": float(cue_in),
            "cue_out": float(cue_out),
            "duration": song.duration if hasattr(song, 'duration') else 0
        }

    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file provided"}))
        sys.exit(1)

    file_path = sys.argv[1]
    result = analyze_song(file_path)
    print(json.dumps(result))
