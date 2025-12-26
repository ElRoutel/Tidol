// backend/force_cleanup_lyrics.js
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'models', 'database.sqlite');
const LYRICS_DIR = path.join(__dirname, '..', 'tidol-spectra', 'uploads', 'lyrics');

console.log('☢️ TIDOL - FORCE LYRICS RESET (NUCLEAR)');
console.log('--------------------------------------');

const db = new Database(DB_PATH);

async function forceReset() {
    try {
        // 1. Limpiar físicamente la carpeta de letras
        if (fs.existsSync(LYRICS_DIR)) {
            console.log('🗑️ Borrando archivos físicos .lrc...');
            const files = fs.readdirSync(LYRICS_DIR).filter(f => f.endsWith('.lrc'));
            for (const file of files) {
                fs.unlinkSync(path.join(LYRICS_DIR, file));
            }
            console.log(`✅ ${files.length} archivos borrados.`);
        }

        // 2. Limpiar tabla lyrics (caché línea a línea)
        console.log('🧹 Vaciando tabla de caché "lyrics"...');
        const hasLyricsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lyrics'").get();
        if (hasLyricsTable) {
            db.prepare('DELETE FROM lyrics').run();
            console.log('✅ Tabla lyrics vaciada.');
        }

        // 3. Resetear marcadores en ia_history
        console.log('🔄 Reseteando marcas en Historial IA...');
        // Intentamos resetear las columnas aunque no esten (usamos try/catch por si no existen aun)
        try {
            db.prepare('UPDATE ia_history SET has_lyrics = 0, is_analyzed = 0, has_vocals = 0').run();
            console.log('✅ Marcas de ia_history reseteadas.');
        } catch (e) {
            console.log('⚠️ ia_history no tiene columnas de estado (has_lyrics), saltando...');
        }

        // 4. Resetear marcadores en canciones locales (si existen)
        try {
            db.prepare('UPDATE canciones SET bpm = 0, musical_key = ""').run();
            console.log('✅ Metadatos de canciones locales reseteados.');
        } catch (e) { }

        console.log('\n✨ RESET COMPLETADO. Todo rastro de letras ha sido borrado.');
        console.log('TidOl volverá a generar todo automáticamente al reproducir.');

    } catch (err) {
        console.error('❌ Error durante el reset:', err.message);
    } finally {
        db.close();
    }
}

forceReset();
