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
    base = os.path.basename(path)
    name, _ = os.path.splitext(base)
    return name.replace("_", " ").replace("-", " - ")

def generate_lrc(audio_path, output_path):
    model = None
    try:
        import torch
        # Tu RTX 2080 ama CUDA
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # CAMBIO 1: Float16 es nativo para RTX 2080 y más rápido que int8
        compute_type = "float16" if device == "cuda" else "int8"
        
        print(json.dumps({"status": "progress", "message": f"Loading Whisper (large-v2) on {device} ({compute_type})..."}), flush=True)

        # Cargar modelo
        model = WhisperModel("large-v2", device=device, compute_type=compute_type, num_workers=1)

        print(json.dumps({"status": "progress", "message": "Transcribing with optimized settings..."}), flush=True)
        
        # --- CONFIGURACIÓN OPTIMIZADA ---
        segments, info = model.transcribe(
            audio_path, 
            
            # CAMBIO 2: Velocidad extrema. Para karaoke no necesitamos beam search complejo.
            beam_size=1,
            best_of=1,
            
            # CAMBIO 3: Filtro de voz activado para saltar partes instrumentales largas
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=1000),
            
            language=None, 
            
            # CAMBIO 4: Prompt de "cebado" en lugar de instrucciones, para evitar que lea el prompt
            initial_prompt="amor corazón vida siento quiero dolor noche luz (música) (verso 1):",
            
            # CAMBIO 5: CRÍTICO. Evita los bucles infinitos de 300s+
            condition_on_previous_text=False,
            
            # Temperatura baja para evitar alucinaciones, pero no 0 absoluto
            temperature=0.2,
            
            word_timestamps=True
        )

        lrc_lines = []
        
        # --- HEADER ---
        title = clean_filename(audio_path)
        lrc_lines.append(f"[ti:{title}]")
        lrc_lines.append(f"[ar:Spectra AI]")
        lrc_lines.append(f"[la:{info.language}]")
        lrc_lines.append(f"[00:00.00]🎵 {title} (Synced by Spectra VOXW)")

        segment_count = 0
        
        # --- LOGICA DE PROCESAMIENTO ---
        max_chars_per_line = 42 
        current_line_words = []
        current_line_len = 0
        line_start_time = 0

        for segment in segments:
            # Fallback si no hay palabras (raro en whisper moderno)
            if not segment.words: 
                start = format_timestamp(segment.start)
                text = segment.text.strip()
                if text:
                    lrc_lines.append(f"{start}{text}")
                    segment_count += 1
                continue

            for word in segment.words:
                if not current_line_words:
                    line_start_time = word.start 
                
                word_text = word.word.strip()
                current_line_words.append(word_text)
                current_line_len += len(word_text) + 1 

                # Corte de línea por longitud
                if current_line_len > max_chars_per_line:
                    text_line = " ".join(current_line_words)
                    timestamp = format_timestamp(line_start_time)
                    lrc_lines.append(f"{timestamp}{text_line}")
                    segment_count += 1
                    
                    current_line_words = []
                    current_line_len = 0
            
            # Vaciar buffer al final del segmento
            if current_line_words:
                text_line = " ".join(current_line_words)
                timestamp = format_timestamp(line_start_time)
                lrc_lines.append(f"{timestamp}{text_line}")
                segment_count += 1
                current_line_words = []
                current_line_len = 0

        # Output vacío o instrumental
        if segment_count == 0:
            lrc_lines.append("[00:00.00]🎵 (Instrumental - No vocals detected)")
            print(json.dumps({
                "status": "warning", 
                "message": f"No vocals detected",
                "segments": 0
            }), flush=True)

        # Guardar archivo
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
        # Limpieza de VRAM agresiva
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
        print("Usage: python voxw.py <input> <output>")
        sys.exit(1)
    
    generate_lrc(sys.argv[1], sys.argv[2])