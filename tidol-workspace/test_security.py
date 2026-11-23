import os
import pymysql
import jwt
import requests
import time
import uuid

# Credenciales desde el entorno (antes estaban escritas aquí y se versionaron;
# hubo que rotarlas). Ejemplo: DB_URL=mysql://usuario:clave@127.0.0.1/tidol
DB_URL = os.environ["DB_URL"]
JWT_SECRET = os.environ["JWT_SECRET"]

def setup_data():
    # Credenciales desde DB_URL (antes usuario y contraseña escritos aquí).
    from urllib.parse import urlparse, unquote
    u = urlparse(DB_URL)
    conn = pymysql.connect(
        host=u.hostname or 'localhost',
        port=u.port or 3306,
        user=unquote(u.username or ''),
        password=unquote(u.password or ''),
        database=(u.path or '/tidol').lstrip('/') or 'tidol'
    )
    cursor = conn.cursor()

    # Create dummy users
    cursor.execute("INSERT IGNORE INTO users (id, username, password_hash) VALUES (998, 'test_user1', 'xxx'), (999, 'test_user2', 'xxx')")
    
    dev1 = str(uuid.uuid4())
    dev2 = str(uuid.uuid4())
    cursor.execute("INSERT IGNORE INTO devices (id, user_id, device_name, device_type) VALUES (%s, 998, 'dev1', 'web')", (dev1,))
    cursor.execute("INSERT IGNORE INTO devices (id, user_id, device_name, device_type) VALUES (%s, 999, 'dev2', 'web')", (dev2,))
    
    # Create dummy tracks
    cursor.execute("INSERT IGNORE INTO track_links (mbid, title, artist) VALUES ('mbid-track-1', 'Track 1', 'Artist 1'), ('mbid-track-2', 'Track 2', 'Artist 2')")
    
    # Add history
    cursor.execute("INSERT INTO play_history (track_mbid, user_id) VALUES ('mbid-track-1', 998)")
    cursor.execute("INSERT INTO play_history (track_mbid, user_id) VALUES ('mbid-track-2', 999)")
    
    conn.commit()
    return dev1, dev2

def main():
    dev1, dev2 = setup_data()
    
    token1 = jwt.encode({"sub": 998, "device_id": dev1, "exp": 9999999999, "iat": 0}, JWT_SECRET, algorithm="HS256")
    token2 = jwt.encode({"sub": 999, "device_id": dev2, "exp": 9999999999, "iat": 0}, JWT_SECRET, algorithm="HS256")

    print(f"Token 1 (User 998): {token1}")
    print(f"Token 2 (User 999): {token2}")

    print("\n--- Testing API with Token 1 ---")
    res1 = requests.get("http://localhost:3000/api/v1/home", headers={"Authorization": f"Bearer {token1}"})
    print(res1.json())

    print("\n--- Testing API with Token 2 ---")
    res2 = requests.get("http://localhost:3000/api/v1/home", headers={"Authorization": f"Bearer {token2}"})
    print(res2.json())

if __name__ == '__main__':
    main()
