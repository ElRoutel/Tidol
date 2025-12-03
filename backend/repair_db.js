import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "models", "database.sqlite.corrupt.1764145684615");
const backupPath = path.join(__dirname, "models", "database.sqlite.backup");
const repairedPath = path.join(__dirname, "models", "database_repaired_old.sqlite");
const tempSource = path.join(__dirname, "models", "database_temp_source.sqlite");

async function repairDatabase() {
    console.log("🔧 Intentando reparar la base de datos...");

    // 0. Limpiar intentos previos
    try {
        if (fs.existsSync(repairedPath)) fs.unlinkSync(repairedPath);
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
        if (fs.existsSync(tempSource)) fs.unlinkSync(tempSource);
    } catch (e) {
        console.error("⚠️ No se pudieron limpiar archivos previos (¿bloqueados?):", e.message);
    }

    // 1. Copiar a un archivo temporal para evitar bloqueos (SQLITE_BUSY)
    try {
        fs.copyFileSync(dbPath, tempSource);
        console.log(`✅ Copia temporal creada para lectura: ${tempSource}`);
    } catch (err) {
        console.error("❌ No se pudo copiar la DB (está muy bloqueada):", err.message);
        return;
    }

    try {
        const db = await open({
            filename: tempSource, // Leemos de la copia
            driver: sqlite3.Database,
        });

        // 2. Intentar exportar los datos recuperables
        console.log("📤 Exportando datos recuperables...");

        const tables = await db.all(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `);

        console.log(`📊 Tablas encontradas: ${tables.map(t => t.name).join(', ')}`);

        // 3. Crear nueva DB limpia con WAL mode
        const newDb = await open({
            filename: repairedPath,
            driver: sqlite3.Database,
        });

        await newDb.exec("PRAGMA journal_mode = WAL;");

        // 4. Copiar esquema
        for (const table of tables) {
            try {
                const schema = await db.get(
                    `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`,
                    [table.name]
                );
                if (schema && schema.sql) {
                    await newDb.exec(schema.sql);
                    console.log(`✅ Esquema copiado: ${table.name}`);
                }
            } catch (err) {
                console.error(`❌ Error copiando esquema de ${table.name}:`, err.message);
            }
        }

        // 5. Copiar datos
        for (const table of tables) {
            try {
                const rows = await db.all(`SELECT * FROM ${table.name}`);
                if (rows.length > 0) {
                    const columns = Object.keys(rows[0]);
                    const placeholders = columns.map(() => '?').join(',');
                    const stmt = await newDb.prepare(
                        `INSERT INTO ${table.name} (${columns.join(',')}) VALUES (${placeholders})`
                    );

                    for (const row of rows) {
                        try {
                            await stmt.run(...columns.map(col => row[col]));
                        } catch (insertErr) {
                            // Ignorar duplicados o errores de constraint individuales
                        }
                    }
                    await stmt.finalize();
                    console.log(`✅ Datos copiados: ${table.name} (${rows.length} filas)`);
                }
            } catch (err) {
                console.error(`⚠️  Error copiando datos de ${table.name}:`, err.message);
            }
        }

        await db.close();
        await newDb.close();

        // Limpiar temp
        try { fs.unlinkSync(tempSource); } catch { }

        console.log("\n✅ Reparación completada!");
        console.log(`📁 Nueva DB recuperada: ${repairedPath}`);
        console.log("ℹ️  Para usar esta DB, renómbrala manualmente a database.sqlite");

    } catch (err) {
        console.error("❌ Error durante la reparación:", err.message);
    }
}

repairDatabase();
