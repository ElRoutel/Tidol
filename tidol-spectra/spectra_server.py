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
        filename = os.path.splitext(os.path.basename(req.input_path))[0]
        # Demucs crea una carpeta con el nombre del archivo dentro de output_dir_stems
        # OJO: Demucs estructura: output_dir / htdemucs / filename / vocals.wav
        # Pero tidol espera: output_dir / filename / vocals.wav
        # Ajustaremos para que coincida con lo que espera server.js
        
        final_track_dir = os.path.join(req.output_dir_stems, filename)
        vocals_path = os.path.join(final_track_dir, "vocals.wav")
        accompaniment_path = os.path.join(final_track_dir, "accompaniment.wav")
        
        # --- FASE 1: DEMUCS ---
        # Solo ejecutamos si no existen ya los stems
        if not (os.path.exists(vocals_path) and os.path.exists(accompaniment_path)):
            print(f"🎤 [Demucs] Procesando: {filename}", flush=True)
            
            # Usamos subprocess para llamar a Demucs
            # Es más seguro para la VRAM que cargarlo en el mismo proceso si no se gestiona con cuidado,
            # pero como queremos velocidad, idealmente sería en el mismo proceso.
            # Por ahora, subprocess es robusto y limpia su VRAM al terminar.
            cmd = [
                "demucs", "-n", "htdemucs", "--two-stems=vocals", 
                "--device", "cpu", "-o", req.output_dir_stems, req.input_path
            ]
            
            # Ejecutar Demucs
            process = subprocess.run(cmd, capture_output=True, text=True)
            
            if process.returncode != 0:
                print(f"❌ Demucs stderr: {process.stderr}", flush=True)
                raise Exception(f"Demucs failed: {process.stderr}")

            print(f"✅ Demucs finished. Start stdout:\n{process.stdout}\nEnd stdout", flush=True)
            print(f"Demucs stderr (if any):\n{process.stderr}", flush=True)

            # Mover archivos de la estructura de Demucs a la nuestra
            # Demucs output default: <out>/htdemucs/<track_name>/...
            htdemucs_dir = os.path.join(req.output_dir_stems, "htdemucs")
            
            # Find the output folder dynamically to avoid naming mismatches
            demucs_output_root = None
            if os.path.exists(htdemucs_dir):
                # List directories in htdemucs
                subdirs = [d for d in os.listdir(htdemucs_dir) if os.path.isdir(os.path.join(htdemucs_dir, d))]
                if subdirs:
                    # We assume the most recently created or the only one is ours
                    # Since we process one by one (mostly), taking the first one is a reasonable fallback
                    # But ideally we try to match the filename
                    
                    # Try exact match first
                    if filename in subdirs:
                        demucs_output_root = os.path.join(htdemucs_dir, filename)
                    else:
                        # Fallback: take the first one found
                        print(f"⚠️ Exact match not found for '{filename}' in Demucs output. Using '{subdirs[0]}'")
                        demucs_output_root = os.path.join(htdemucs_dir, subdirs[0])
            
            if demucs_output_root and os.path.exists(demucs_output_root):
                # Crear directorio destino si no existe
                os.makedirs(final_track_dir, exist_ok=True)
                
                # Mover vocals
                src_vocals = os.path.join(demucs_output_root, "vocals.wav")
                if os.path.exists(src_vocals):
                    if os.path.exists(vocals_path): os.remove(vocals_path)
                    os.rename(src_vocals, vocals_path)
                
                # Mover accompaniment
                src_acc = os.path.join(demucs_output_root, "no_vocals.wav") # htdemucs usa 'no_vocals'
                if os.path.exists(src_acc):
                    if os.path.exists(accompaniment_path): os.remove(accompaniment_path)
                    os.rename(src_acc, accompaniment_path)
                
                # Limpiar carpeta temporal htdemucs
                try:
                    import shutil
                    shutil.rmtree(os.path.join(req.output_dir_stems, "htdemucs"))
                except:
                    pass
            else:
                # Fallback: a veces demucs usa el nombre sin extension o con espacios diferentes
                print(f"⚠️ Warning: Demucs output not found at expected path: {demucs_output_root or htdemucs_dir}")

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
    uvicorn.run(app, host="127.0.0.1", port=8000, workers=1)
