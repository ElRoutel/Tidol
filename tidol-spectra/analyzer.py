import sys
import json
import numpy as np
import librosa
import warnings
from collections import Counter

# Ignoramos warnings de librerías para mantener limpio el JSON de salida
warnings.filterwarnings('ignore')

def get_key(y, sr):
    """ Función auxiliar para detectar Key en un fragmento usando perfiles teóricos """
    try:
        # 1. Separación Armónica: Nos quedamos solo con la melodía (quitamos batería)
        y_harmonic = librosa.effects.hpss(y)[0]
        
        # 2. Detección de Afinación (Tuning Offset)
        # Esto corrige si la canción está acelerada o desafinada (común en rips de vinilo/radio)
        tuning_offset = librosa.estimate_tuning(y=y_harmonic, sr=sr)
        
        # 3. Chromagrama ajustado
        chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr, tuning=tuning_offset)
        
        # 4. Perfiles Krumhansl-Schmuckler (La "huella digital" de las escalas)
        maj_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
        min_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
        
        chroma_vals = np.sum(chroma, axis=1)
        pitches = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        
        key_correlations = []
        for i in range(12):
            # Rotamos el perfil y calculamos correlación
            key_test = np.roll(chroma_vals, -i)
            coef_maj = np.corrcoef(maj_profile, key_test)[0, 1]
            coef_min = np.corrcoef(min_profile, key_test)[0, 1]
            key_correlations.append((pitches[i] + " Major", coef_maj))
            key_correlations.append((pitches[i] + " Minor", coef_min))
        
        # Devuelve la tonalidad con mayor coincidencia
        return max(key_correlations, key=lambda x: x[1])[0]
    except:
        return "Unknown"

def analyze_track(file_path):
    try:
        # 1. OBTENER DURACIÓN TOTAL (Rápido)
        total_duration = librosa.get_duration(path=file_path)
        
        # 2. ESTRATEGIA DE MUESTREO (Multi-Pass)
        # Saltamos el intro (10s) y dividimos el resto en puntos estratégicos
        if total_duration < 60:
            offsets = [total_duration / 2] 
        else:
            # Ejemplo: Canción de 3 min -> Analiza en seg 20, 80, 140
            step = (total_duration - 20) / 3 
            offsets = [20, 20 + step, 20 + (step * 2)]

        bpm_votes = []
        key_votes = []
        
        # 3. BUCLE DE ANÁLISIS
        for offset in offsets:
            # Cargamos solo 15 segundos por trozo (sr=22050 es estándar de calidad/velocidad)
            y_chunk, sr = librosa.load(file_path, sr=22050, offset=offset, duration=15.0)
            
            # --- VOTO DE BPM (Usando capa percusiva) ---
            y_perc = librosa.effects.hpss(y_chunk)[1]
            onset_env = librosa.onset.onset_strength(y=y_perc, sr=sr)
            tempo, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
            # IMPORTANTE: float() para evitar error de numpy en JSON
            bpm_votes.append(round(float(tempo), 1))
            
            # --- VOTO DE KEY ---
            key_vote = get_key(y_chunk, sr)
            key_votes.append(key_vote)

        # 4. CONTEO DE VOTOS (Consenso)
        
        # Para BPM: Buscamos la Moda (el valor que más se repite)
        bpm_rounded = [round(b) for b in bpm_votes]
        bpm_count = Counter(bpm_rounded)
        most_common_bpm = bpm_count.most_common(1)[0]
        
        if most_common_bpm[1] > 1: 
            final_bpm = most_common_bpm[0]
        else:
            final_bpm = np.mean(bpm_votes) # Si no hay consenso, usamos promedio

        # Para Key: Mayoría simple
        final_key = Counter(key_votes).most_common(1)[0][0]

        # 5. GENERAR WAVEFORM COMPLETO (Visualizador)
        # Truco de optimización: Cargamos todo el archivo a MUY baja calidad (4000hz)
        # Suficiente para dibujar la forma, pero 5x más rápido de procesar
        y_full, _ = librosa.load(file_path, sr=4000) 
        hop_length = int(len(y_full) / 250) # Queremos ~250 barras en la UI
        rms = librosa.feature.rms(y=y_full, hop_length=hop_length)[0]
        
        # Normalizar entre 0 y 1
        if np.max(rms) > 0:
            waveform_normalized = (rms - np.min(rms)) / (np.max(rms) - np.min(rms))
        else:
            waveform_normalized = rms # Caso silencio absoluto

        # Convertir a lista de floats simples para JSON
        waveform_data = [round(float(x), 3) for x in waveform_normalized]

        # 6. RESULTADO FINAL
        result = {
            "bpm": round(float(final_bpm), 1),
            "key": final_key,
            "waveform": waveform_data,
            "status": "success"
        }
        
        print(json.dumps(result))

    except Exception as e:
        error_res = {"status": "error", "message": str(e)}
        print(json.dumps(error_res))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_track(sys.argv[1])
    else:
        print(json.dumps({"status": "error", "message": "No file provided"}))