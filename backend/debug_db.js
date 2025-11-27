import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "models", "database.sqlite");

async function test() {
    console.log("📂 Opening DB at:", dbPath);
    try {
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        console.log("✅ Connected to DB.");

        // Check columns in canciones
        const columns = await db.all("PRAGMA table_info(canciones)");
        const columnNames = columns.map(c => c.name);
        console.log("📊 Columns in canciones:", columnNames);

        const missing = ['bit_depth', 'sample_rate', 'bit_rate'].filter(c => !columnNames.includes(c));
        if (missing.length > 0) {
            console.error("❌ MISSING COLUMNS:", missing);
        } else {
            console.log("✅ All columns present.");
        }

        // Try the query
        console.log("🔄 Testing getUserLikes query...");
        const userId = 1;
        await db.all(`SELECT c.id, c.titulo, a.nombre AS artista, c.portada, c.archivo AS url, c.duracion, c.bit_depth, c.sample_rate, c.bit_rate, al.titulo AS album, c.album_id AS albumId, l.id AS likeId FROM likes l JOIN canciones c ON c.id = l.song_id JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id WHERE l.user_id = ? ORDER BY l.id DESC`, [userId]);
        console.log("✅ Query ran successfully.");

    } catch (err) {
        console.error("❌ ERROR:", err.message);
    }
}

test();
