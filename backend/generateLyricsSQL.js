import fs from 'fs';
import path from 'path';
import db from './models/db.js'; // Asegúrate que apunta a tu conexión SQLite

// ---------------- CONFIG ----------------
const songId = 17; //SOLO PARA PRUEBAS: ID de la canción a la que se asocian las letras Y el archivo .lrc 
const lrcFile = path.join('uploads', 'lyrics', 'Bad Bunny - DtMF.lrc'); // Ruta a tu archivo .lrc
// ---------------------------------------

if (!fs.existsSync(lrcFile)) {
    console.error(`❌ Archivo no encontrado: ${lrcFile}`);
    process.exit(1);
}

const lines = fs.readFileSync(lrcFile, 'utf-8').split(/\r?\n/);

(async () => {
    let insertedCount = 0;

    for (const line of lines) {
        const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
        if (!match) continue;

        const minutes = parseInt(match[1], 10);
        const seconds = parseFloat(match[2]);
        const text = match[3].trim();
        if (!text) continue;

        const timeMs = Math.round((minutes * 60 + seconds) * 1000);

        try {
            await db.run(
                "INSERT INTO lyrics (song_id, time_ms, line) VALUES (?, ?, ?)",
                [songId, timeMs, text]
            );
            insertedCount++;
        } catch (err) {
            console.error(`❌ Error insertando línea "${text}":`, err.message);
        }
    }

    console.log(`✅ Letras subidas correctamente. Total de líneas insertadas: ${insertedCount}`);
})();
