import sys
import os
import json
import warnings
from spleeter.separator import Separator

# Suppress warnings
warnings.filterwarnings('ignore')

def separate_audio(input_path, output_dir):
    try:
        # Ensure output directory exists
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # Initialize Spleeter (2 stems: vocals + accompaniment)
        separator = Separator('spleeter:2stems')

        # Perform separation
        # Spleeter creates a subdirectory with the filename
        separator.separate_to_file(input_path, output_dir)

        # Construct expected paths
        filename = os.path.splitext(os.path.basename(input_path))[0]
        track_dir = os.path.join(output_dir, filename)
        
        vocals_path = os.path.join(track_dir, 'vocals.wav')
        accompaniment_path = os.path.join(track_dir, 'accompaniment.wav')

        if os.path.exists(vocals_path) and os.path.exists(accompaniment_path):
            result = {
                "status": "success",
                "vocals": vocals_path,
                "accompaniment": accompaniment_path
            }
        else:
            result = {
                "status": "error",
                "message": "Separation completed but files not found."
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
        print(json.dumps({"status": "error", "message": "Usage: python vox.py <input_file> <output_dir>"}))
