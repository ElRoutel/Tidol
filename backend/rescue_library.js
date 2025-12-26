import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';

// Config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'musica');
const DB_PATH = path.join(__dirname, 'models', 'database.sqlite');

async function rescueLibrary() {
    console.log("🚑 Iniciando Operación de Rescate de Biblioteca...");
    console.log(`📂 Escaneando: ${UPLOADS_DIR}`);

    if (!fs.existsSync(UPLOADS_DIR)) {
        console.error("❌ No se encontró la carpeta de música!");
        return;
    }

    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    const files = fs.readdirSync(UPLOADS_DIR).filter(f =>
        f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.wav') || f.endsWith('.m4a')
    );

    console.log(`🎵 Archivos encontrados: ${files.length}`);

    // 1. Crear Artista "Desconocido" y Álbum "Rescatado" por defecto
    const defaultArtistRes = await db.run(`INSERT OR IGNORE INTO artistas (nombre) VALUES ('Artista Rescatado')`);
    const defaultArtistId = (await db.get(`SELECT id FROM artistas WHERE nombre = 'Artista Rescatado'`)).id;

    const defaultAlbumRes = await db.run(`INSERT OR IGNORE INTO albumes (titulo, artista_id) VALUES ('Álbum Rescatado', ?)`, [defaultArtistId]);
    const defaultAlbumId = (await db.get(`SELECT id FROM albumes WHERE titulo = 'Álbum Rescatado'`)).id;

    let recoveredCount = 0;

    for (const file of files) {
        try {
            // Intentar parsear nombre si tiene formato "Artista - Titulo.ext"
            // O simplemente usar el nombre del archivo como título
            let title = file;
            let artistId = defaultArtistId;

            // Limpiar extensión
            title = title.replace(/\.[^/.]+$/, "");

            // Verificar si ya existe en DB (por nombre de archivo)
            const existing = await db.get(`SELECT id FROM canciones WHERE archivo = ?`, [`/uploads/musica/${file}`]);

            if (!existing) {
                await db.run(`
                    INSERT INTO canciones (titulo, archivo, artista_id, album_id, duracion, fecha_subida)
                    VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
                `, [title, `/uploads/musica/${file}`, artistId, defaultAlbumId]);

                process.stdout.write(".");
                recoveredCount++;
            }
        } catch (err) {
            console.error(`\n❌ Error con ${file}:`, err.message);
        }
    }

    console.log(`\n\n✅ Operación completada.`);
    console.log(`✨ Canciones recuperadas: ${recoveredCount}`);
    console.log(`💾 Base de datos actualizada.`);

    await db.close();
}

rescueLibrary();
