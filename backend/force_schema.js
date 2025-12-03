import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "models", "database.sqlite");
const schemaPath = path.join(__dirname, "models", "schema.sql");

async function forceApplySchema() {
    console.log("🔧 Forzando aplicación de esquema...");

    try {
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        const schema = fs.readFileSync(schemaPath, "utf-8");

        // Split schema into statements to execute one by one (safer)
        const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);

        for (const stmt of statements) {
            try {
                await db.exec(stmt);
            } catch (e) {
                // Ignore "table already exists" errors
                if (!e.message.includes('already exists')) {
                    console.error("Error executing statement:", e.message);
                }
            }
        }

        console.log("✅ Esquema aplicado correctamente. Tablas creadas.");
        await db.close();

    } catch (err) {
        console.error("❌ Error fatal:", err);
    }
}

forceApplySchema();
