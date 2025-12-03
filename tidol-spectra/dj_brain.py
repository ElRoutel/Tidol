import sys
import json
import sqlite3
import pandas as pd
import numpy as np

# --- CONFIGURACIÓN DE PONDERACIÓN (La "Receta" del DJ) ---
# Suma total = 1.0
W_BPM = 0.45      # El ritmo es lo más importante para mezclar
W_KEY = 0.35      # La armonía evita que suene desafinado
W_RANDOM = 0.20   # Un toque de variedad para no repetir siempre lo mismo

def get_db_connection():
    # Asegúrate que el nombre de la DB coincida
    return sqlite3.connect('spectra.db')

def calculate_bpm_score(current, candidate):
    if candidate == 0: return 0
    diff = abs(current - candidate)
    # Si está dentro del +/- 5%, es perfecto (1.0). Si se aleja, baja el puntaje.
    # También bonificamos mitades/dobles (ej: 70 bpm va bien con 140 bpm)
    if diff < (current * 0.05): return 1.0
    if abs(current * 2 - candidate) < (candidate * 0.05): return 0.9 # Double time
    if abs(current / 2 - candidate) < (candidate * 0.05): return 0.9 # Half time
    
    # Penalización lineal por distancia
    return max(0, 1.0 - (diff / 30)) # Si se aleja 30 BPM, score es 0

def calculate_key_score(current_key, candidate_key):
    if not current_key or not candidate_key: return 0.5
    # Aquí podríamos implementar la "Camelot Wheel" completa.
    # Por ahora, simplificamos: Mismo Key = 1.0, lo demás = 0.2
    return 1.0 if current_key == candidate_key else 0.2

def recommend(track_id):
    try:
        conn = get_db_connection()
        
        # 1. Cargar datos
        # Solo recomendamos canciones ya analizadas
        df = pd.read_sql_query("SELECT id, title, artist, bpm, key_signature, filepath, coverpath FROM tracks WHERE analysis_status = 'analyzed'", conn)
        conn.close()

        if df.empty:
            print(json.dumps({"error": "Library empty or not analyzed"}))
            return

        # 2. Encontrar track actual
        current = df[df['id'] == int(track_id)]
        if current.empty:
            print(json.dumps({"error": "Current track not found in DB"}))
            return
        
        curr_bpm = current.iloc[0]['bpm']
        curr_key = current.iloc[0]['key_signature']

        # 3. Excluir el track actual de los candidatos
        candidates = df[df['id'] != int(track_id)].copy()

        # 4. CALCULAR SCORES
        candidates['score_bpm'] = candidates['bpm'].apply(lambda x: calculate_bpm_score(curr_bpm, x))
        candidates['score_key'] = candidates['key_signature'].apply(lambda x: calculate_key_score(curr_key, x))
        candidates['score_rnd'] = np.random.random(len(candidates))

        # Fórmula Maestra
        candidates['total_score'] = (
            (candidates['score_bpm'] * W_BPM) +
            (candidates['score_key'] * W_KEY) +
            (candidates['score_rnd'] * W_RANDOM)
        )

        # 5. ELEGIR GANADOR
        # Tomamos el Top 1
        winner = candidates.sort_values(by='total_score', ascending=False).iloc[0]

        result = {
            "success": True,
            "recommendation": {
                "id": int(winner['id']),
                "title": winner['title'],
                "artist": winner['artist'],
                "bpm": float(winner['bpm']),
                "key": winner['key_signature'],
                # Construimos URLs completas para que el frontend las use directo
                "url": f"http://localhost:3001/stream/{winner['id']}", 
                "cover": f"http://localhost:3001/uploads/{winner['coverpath']}" if winner['coverpath'] else None,
                "score": round(float(winner['total_score']), 2)
            }
        }
        
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        recommend(sys.argv[1])
    else:
        print(json.dumps({"error": "No track ID provided"}))
