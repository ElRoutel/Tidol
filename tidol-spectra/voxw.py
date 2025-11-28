import sys
import os
import json
import warnings
import traceback
import gc
from faster_whisper import WhisperModel

# Suppress warnings
warnings.filterwarnings("ignore")
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

def format_timestamp(seconds):
    """Converts seconds to [MM:SS.xx] format for LRC."""
    minutes = int(seconds // 60)
    remaining_seconds = seconds % 60
    return f"[{minutes:02d}:{remaining_seconds:05.2f}]"

def clean_filename(path):
    """Extracts a clean title from filename for the header."""
    base = os.path.basename(path)
    name, _ = os.path.splitext(base)
    return name.replace("_", " ").replace("-", " - ")

def generate_lrc(audio_path, output_path):
    model = None
    try:
        # Check for GPU
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Usamos 'int8' para máxima compatibilidad
        compute_type = "int8"
        
        print(json.dumps({"status": "progress", "message": f"Loading Whisper (large-v2) on {device} ({compute_type})..."}), flush=True)

        # Cargar modelo Large-v2
        model = WhisperModel("large-v2", device=device, compute_type=compute_type, num_workers=1)

        print(json.dumps({"status": "progress", "message": "Transcribing with Karaoke sync..."}), flush=True)
        
        # --- CONFIGURACIÓN KARAOKE ---
        segments, info = model.transcribe(
            audio_path, 
            beam_size=5,
            vad_filter=False,
            language=None, # Auto-detectar
            # PROMPT PARA ESTRUCTURA
            initial_prompt="Lyrics, song structure, verse by verse, short lines. Letra de canción, versos cortos.",
            # LA CLAVE: Activar timestamps por palabra para poder cortar líneas largas
            word_timestamps=True
        )

        lrc_lines = []
        
        # --- HEADER ESTILO PROFESIONAL ---
        title = clean_filename(audio_path)
        lrc_lines.append(f"[ti:{title}]")
        lrc_lines.append(f"[ar:Spectra AI]")
        lrc_lines.append(f"[la:{info.language}]")
        lrc_lines.append(f"[00:00.00]🎵 {title} (Synced by Spectra VOXW)")

        segment_count = 0
        
        # --- LÓGICA DE CORTE DE LÍNEAS (KARAOKE SPLITTER) ---
        # Whisper devuelve segmentos largos. Nosotros vamos a reconstruir
        # líneas cortas usando las palabras individuales.
        
        max_chars_per_line = 42 # Estándar ideal para lectura rápida
        current_line_words = []
        current_line_len = 0
        line_start_time = 0

        for segment in segments:
            if not segment.words: # Si no hay info de palabras, usar el segmento entero (fallback)
                start = format_timestamp(segment.start)
                text = segment.text.strip()
                if text:
                    lrc_lines.append(f"{start}{text}")
                    segment_count += 1
                continue

            for word in segment.words:
                if not current_line_words:
                    line_start_time = word.start # El tiempo de la línea es el de la primera palabra
                
                word_text = word.word.strip()
                current_line_words.append(word_text)
                current_line_len += len(word_text) + 1 # +1 por el espacio

                # Si la línea es muy larga o la palabra tiene una pausa larga después... cortamos.
                # (Aquí usamos solo longitud para asegurar estética visual)
                if current_line_len > max_chars_per_line:
                    text_line = " ".join(current_line_words)
                    timestamp = format_timestamp(line_start_time)
                    lrc_lines.append(f"{timestamp}{text_line}")
                    segment_count += 1
                    
                    # Resetear para siguiente línea
                    current_line_words = []
                    current_line_len = 0
            
            # Al final del segmento, si quedaron palabras pendientes, imprimirlas
            if current_line_words:
                text_line = " ".join(current_line_words)
                timestamp = format_timestamp(line_start_time)
                lrc_lines.append(f"{timestamp}{text_line}")
                segment_count += 1
                current_line_words = []
                current_line_len = 0

        # Validación final
        if segment_count == 0:
            lrc_lines.append("[00:00.00]🎵 (Instrumental - No vocals detected)")
            print(json.dumps({
                "status": "warning", 
                "message": f"No vocals detected",
                "segments": 0
            }), flush=True)

        # Write LRC file
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lrc_lines))

        print(json.dumps({
            "status": "success", 
            "lrc_path": output_path,
            "language": info.language,
            "segments": segment_count
        }), flush=True)

    except Exception as e:
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(json.dumps({"status": "error", "message": error_msg}), file=sys.stderr, flush=True)
        sys.exit(1)
    finally:
        if model is not None:
            del model
        gc.collect()
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except:
            pass

if __name__ == "__main__":
    if len(sys.argv) < 3:
        # Dummy execution for testing if run directly without args
        print("Usage: python voxw.py <input> <output>")
        sys.exit(1)
    
    generate_lrc(sys.argv[1], sys.argv[2])