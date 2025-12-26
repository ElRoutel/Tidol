// backend/cleanup_lyrics.js
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'models', 'database.sqlite');
const SPECTRA_DB_PATH = path.join(__dirname, '..', 'tidol-spectra', 'spectra.db');
const LYRICS_DIR = path.join(__dirname, '..', 'tidol-spectra', 'uploads', 'lyrics');

console.log('🧹 Tidol Lyrics Cleanup Utility');
console.log('-------------------------------');

if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Error: No se encontró la base de datos de Tidol.');
    process.exit(1);
}

const db = new Database(DB_PATH);
const spectraDb = fs.existsSync(SPECTRA_DB_PATH) ? new Database(SPECTRA_DB_PATH) : null;

async function syncLyrics() {
    try {
        console.log('🔍 Escaneando archivos .lrc...');
        const files = fs.readdirSync(LYRICS_DIR).filter(f => f.endsWith('.lrc'));
        console.log(`📊 Encontrados ${files.length} archivos físicos.`);

        // 1. Resetear flags en ia_history
        console.log('🔄 Sincronizando historial de IA...');
        const iaSongs = db.prepare('SELECT user_id, ia_identifier, titulo FROM ia_history').all();

        let resetCount = 0;
        for (const song of iaSongs) {
            // Buscamos si hay un archivo que coincida con el título o identificador
            // En Spectra, los nombres suelen ser "Titulo.lrc" o "Autor - Titulo.lrc"
            // Para ser seguros, si no encontramos el archivo, lo marcamos como no-lyrics

            // Verificamos en la base de datos de Spectra cómo se llama el archivo de esta canción
            let filename = null;
            if (spectraDb) {
                const track = spectraDb.prepare('SELECT filepath FROM tracks WHERE original_ia_id = ?').get(song.ia_identifier);
                if (track) {
                    filename = path.basename(track.filepath, path.extname(track.filepath)) + '.lrc';
                }
            }

            const possiblePath = filename ? path.join(LYRICS_DIR, filename) : null;
            const exists = possiblePath && fs.existsSync(possiblePath);

            if (!exists) {
                db.prepare('UPDATE ia_history SET has_lyrics = 0 WHERE user_id = ? AND ia_identifier = ?').run(song.user_id, song.ia_identifier);
                resetCount++;
            }
        }
        console.log(`✅ Se resetearon ${resetCount} entradas en el historial de IA.`);

        // 2. Limpiar tabla lyrics (si existe) que no tengan archivo físico
        // (Asumiendo que la tabla lyrics se llena por Spectra, pero aquí la sincronizamos)
        const hasLyricsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lyrics'").get();
        if (hasLyricsTable) {
            console.log('🧹 Limpiando tabla de letras caché...');
            // Por simplicidad, si el usuario borró los .lrc, borramos la caché de la tabla
            // para que se vuelva a leer del archivo cuando se genere de nuevo.
            db.prepare('DELETE FROM lyrics').run();
            console.log('✅ Tabla lyrics vaciada para consistencia.');
        }

        console.log('\n✨ Operación completada con éxito.');
        console.log('Ahora Tidol volverá a pedir a Spectra las letras cuando las necesite.');

    } catch (err) {
        console.error('❌ Error durante la limpieza:', err.message);
    } finally {
        db.close();
        if (spectraDb) spectraDb.close();
    }
}

syncLyrics();
