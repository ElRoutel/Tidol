import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "models", "database.sqlite");
const repairedPath = path.join(__dirname, "models", "database_repaired.sqlite");
const corruptPath = path.join(__dirname, "models", `database.sqlite.corrupt.${Date.now()}`);

console.log("🔄 Iniciando restauración de base de datos...");

if (!fs.existsSync(repairedPath)) {
    console.error("❌ No se encuentra database_repaired.sqlite. Ejecuta repair_db.js primero.");
    process.exit(1);
}

try {
    if (fs.existsSync(dbPath)) {
        console.log("📦 Moviendo DB actual a backup corrupto...");
        fs.renameSync(dbPath, corruptPath);
    }

    // --- CRÍTICO: ELIMINAR ARCHIVOS WAL/SHM ANTIGUOS ---
    // Si no se borran, SQLite intenta usarlos con la nueva DB y falla.
    const walPath = path.join(__dirname, "models", "database.sqlite-wal");
    const shmPath = path.join(__dirname, "models", "database.sqlite-shm");

    if (fs.existsSync(walPath)) {
        console.log("🗑️  Eliminando rastro WAL antiguo...");
        try { fs.unlinkSync(walPath); } catch (e) { console.error("⚠️ No se pudo borrar WAL:", e.message); }
    }
    if (fs.existsSync(shmPath)) {
        console.log("🗑️  Eliminando rastro SHM antiguo...");
        try { fs.unlinkSync(shmPath); } catch (e) { console.error("⚠️ No se pudo borrar SHM:", e.message); }
    }

    console.log("✨ Aplicando DB reparada...");
    fs.renameSync(repairedPath, dbPath);

    console.log("✅ ÉXITO: Base de datos restaurada.");
    console.log("🚀 Ahora puedes iniciar el servidor.");

} catch (err) {
    console.error("❌ ERROR: No se pudo mover el archivo.");
    console.error("⚠️  CAUSA PROBABLE: El servidor (node.exe) o Spectra (python) siguen abiertos.");
    console.error("👉 CIERRA TODAS las terminales y procesos de node/python y vuelve a intentar.");
    console.error("Detalles:", err.message);
}
