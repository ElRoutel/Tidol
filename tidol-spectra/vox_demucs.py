import sys
import os
import json
import shutil
import subprocess
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

def separate_audio(input_path, output_dir):
    try:
        # Ensure output directory exists
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        filename = os.path.splitext(os.path.basename(input_path))[0]
        
        # Demucs output structure: <output_dir>/htdemucs/<filename>/...
        # We want to flatten this or at least make it predictable for server.js
        # server.js expects: <output_dir>/<filename>/vocals.wav
        
        # Construct the final expected directory by server.js
        final_track_dir = os.path.join(output_dir, filename)
        
        # Run Demucs
        # -n htdemucs: Use Hybrid Transformer model (fast & good)
        # --two-stems=vocals: Only separate vocals and "other" (no_vocals)
        # --int24: Use 24-bit WAV format (avoids torchcodec dependency)
        # --device cuda: Force GPU usage (falls back to CPU if unavailable)
        # -o: Output directory
        cmd = [
            "demucs",
            "-n", "htdemucs",
            "--two-stems=vocals",
            "--int24",
            "--device", "cuda",
            "-o", output_dir,
            input_path
        ]
        
        # print(f"Executing: {' '.join(cmd)}") # Debug
        
        # Run subprocess
        process = subprocess.run(cmd, capture_output=True, text=True)
        
        if process.returncode != 0:
            raise Exception(f"Demucs failed: {process.stderr}")

        # Demucs creates output in: output_dir/htdemucs/filename/
        demucs_output_dir = os.path.join(output_dir, "htdemucs", filename)
        
        if not os.path.exists(demucs_output_dir):
             raise Exception(f"Demucs output directory not found: {demucs_output_dir}")

        # Move files to where server.js expects them: output_dir/filename/
        # server.js expects: output_dir/filename/vocals.wav
        # server.js expects: output_dir/filename/accompaniment.wav
        
        if not os.path.exists(final_track_dir):
            os.makedirs(final_track_dir)

        # Source files (Demucs outputs WAV with --int24)
        src_vocals = os.path.join(demucs_output_dir, "vocals.wav")
        src_no_vocals = os.path.join(demucs_output_dir, "no_vocals.wav")
        
        # Destination files
        dst_vocals = os.path.join(final_track_dir, "vocals.wav")
        dst_accompaniment = os.path.join(final_track_dir, "accompaniment.wav")

        # Simply move the files
        if os.path.exists(src_vocals):
            shutil.move(src_vocals, dst_vocals)
        
        if os.path.exists(src_no_vocals):
            shutil.move(src_no_vocals, dst_accompaniment)
            
        # Cleanup intermediate htdemucs folder if empty or just remove it
        try:
            shutil.rmtree(os.path.join(output_dir, "htdemucs"))
        except:
            pass

        if os.path.exists(dst_vocals) and os.path.exists(dst_accompaniment):
            result = {
                "status": "success",
                "vocals": dst_vocals,
                "accompaniment": dst_accompaniment
            }
        else:
            result = {
                "status": "error",
                "message": "Separation completed but files not found in expected location."
            }

        print(json.dumps(result))

    except Exception as e:
        error_res = {"status": "error", "message": str(e)}
        print(json.dumps(error_res))

if __name__ == "__main__":
    if len(sys.argv) > 2:
        input_file = sys.argv[1]
        output_folder = sys.argv[2]
        separate_audio(input_file, output_folder)
    else:
        print(json.dumps({"status": "error", "message": "Usage: python vox_demucs.py <input_file> <output_dir>"}))
