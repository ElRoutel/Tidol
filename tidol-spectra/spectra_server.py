import os
import sys
import torch
import gc
import subprocess
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from faster_whisper import WhisperModel
import uvicorn

# --- CONFIGURACIÓN ---
app = FastAPI(title="Spectra Audio Engine")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
# RTX 2080 soporta float16 nativo para mayor velocidad
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"

print(f"🚀 Iniciando Spectra Engine en {DEVICE}...", flush=True)

# VARIABLE GLOBAL PARA EL MODELO
whisper_model = None
model_status = "loading"

def load_model():
    global whisper_model, model_status
    try:
        print(f"⏳ Cargando Whisper Large-v2 en VRAM ({DEVICE}/{COMPUTE_TYPE})...", flush=True)
        whisper_model = WhisperModel("large-v2", device=DEVICE, compute_type=COMPUTE_TYPE)
        model_status = "ready"
        print("✅ Whisper cargado y listo.", flush=True)
    except Exception as e:
        model_status = "error"
        print(f"❌ Error cargando Whisper: {e}", flush=True)

# Cargar modelo al inicio (pero no bloquear el import si se usa como módulo)
if __name__ == "__main__":
    # Lo cargamos antes de iniciar el server para asegurar que esté listo
    load_model()

class ProcessRequest(BaseModel):
    input_path: str
    output_dir_stems: str
    output_path_lrc: str = "" # Opcional si skip_transcription es True
    skip_transcription: bool = False

@app.get("/health")
def health_check():
    return {"status": model_status}

@app.post("/process_track")
async def process_track(req: ProcessRequest):
    global whisper_model
    
    if model_status != "ready":
        raise HTTPException(status_code=503, detail="Model not ready yet")

    try:
        if not os.path.exists(req.input_path):
            print(f"❌ Error: Input file not found: {req.input_path}", flush=True)
            raise HTTPException(status_code=404, detail=f"Input file not found: {req.input_path}")

        filename = os.path.splitext(os.path.basename(req.input_path))[0]
        final_track_dir = os.path.join(req.output_dir_stems, filename)
        vocals_path = os.path.join(final_track_dir, "vocals.wav")
        accompaniment_path = os.path.join(final_track_dir, "accompaniment.wav")
        
        # --- FASE 1: DEMUCS ---
        if not (os.path.exists(vocals_path) and os.path.exists(accompaniment_path)):
            print(f"🎤 [Demucs] Procesando on {DEVICE}: {filename}", flush=True)
            
            cmd = [
                "demucs", "-n", "htdemucs", "--two-stems=vocals", 
                "--device", DEVICE, "-o", req.output_dir_stems, req.input_path
            ]
            
            process = subprocess.run(cmd, capture_output=True, text=True)
            if process.returncode != 0:
                print(f"❌ Demucs stderr: {process.stderr}", flush=True)
                raise Exception(f"Demucs failed: {process.stderr}")

            # Mover archivos de la estructura de Demucs a la nuestra
            # Demucs output structure: <out>/htdemucs/<track_name>/[vocals.wav, no_vocals.wav]
            htdemucs_dir = os.path.join(req.output_dir_stems, "htdemucs")
            if os.path.exists(htdemucs_dir):
                for folder in os.listdir(htdemucs_dir):
                    source_dir = os.path.join(htdemucs_dir, folder)
                    if os.path.isdir(source_dir):
                        if not os.path.exists(final_track_dir): os.makedirs(final_track_dir, exist_ok=True)
                        for f in os.listdir(source_dir):
                            src = os.path.join(source_dir, f)
                            # Normalizar nombres: 'no_vocals.wav' -> 'accompaniment.wav'
                            dst_name = f
                            if f == "no_vocals.wav": dst_name = "accompaniment.wav"
                            
                            dst = os.path.join(final_track_dir, dst_name)
                            if os.path.exists(dst): os.remove(dst)
                            os.replace(src, dst)
                        try: os.rmdir(source_dir)
                        except: pass
                try: 
                    import shutil
                    shutil.rmtree(htdemucs_dir)
                except: pass
            
            print(f"✅ Stems guardados en: {final_track_dir}", flush=True)

        # --- FASE 2: WHISPER ---
        if not req.skip_transcription:
            if not os.path.exists(vocals_path):
                raise Exception("Vocals file not found for transcription")

            print(f"🗣️ [Whisper] Transcribiendo: {filename}", flush=True)
            
            segments, info = whisper_model.transcribe(
                vocals_path,
                beam_size=1,            # Velocidad extrema
                best_of=1,
                vad_filter=True,        # Saltar silencios
                vad_parameters=dict(min_silence_duration_ms=1000),
                condition_on_previous_text=False, # Anti-bucles
                initial_prompt="amor corazón vida siento quiero dolor noche luz (música) (verso 1):",
                temperature=0.2,
                word_timestamps=True
            )

            # Generar LRC
            lrc_lines = []
            lrc_lines.append(f"[ti:{filename}]")
            lrc_lines.append(f"[ar:Spectra AI]")
            lrc_lines.append(f"[la:{info.language}]")
            lrc_lines.append(f"[00:00.00]🎵 {filename} (Synced by Spectra)")

            for segment in segments:
                if not segment.words:
                    continue
                
                # Lógica simplificada de timestamps por palabra/frase
                # Para LRC estándar, usamos el inicio del segmento
                start_time = segment.start
                minutes = int(start_time // 60)
                seconds = start_time % 60
                timestamp = f"[{minutes:02d}:{seconds:05.2f}]"
                lrc_lines.append(f"{timestamp}{segment.text.strip()}")

            # Guardar archivo LRC
            os.makedirs(os.path.dirname(req.output_path_lrc), exist_ok=True)
            with open(req.output_path_lrc, "w", encoding="utf-8") as f:
                f.write("\n".join(lrc_lines))

            # Limpieza parcial de VRAM (opcional, Whisper gestiona bien su cache)
            # torch.cuda.empty_cache() 

        return {
            "status": "success", 
            "file": filename,
            "stems_dir": final_track_dir,
            "lrc_path": req.output_path_lrc if not req.skip_transcription else None
        }

    except Exception as e:
        print(f"❌ Error: {str(e)}\n{traceback.format_exc()}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Workers=1 es CRÍTICO para no cargar el modelo múltiples veces
    uvicorn.run(app, host="127.0.0.1", port=8008, workers=1)
