import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "database.sqlite");
const schemaPath = path.join(__dirname, "schema.sql");

const db = await open({
  filename: dbPath,
  driver: sqlite3.Database,
});

// Activar claves foráneas
await db.exec("PRAGMA foreign_keys = ON;");

// 1️⃣ Si la DB no existe, crearla y aplicar schema.sql
if (!fs.existsSync(dbPath)) {
  console.warn("⚠️ database.sqlite no existe. Creando...");
  if (fs.existsSync(schemaPath)) {
    try {
      const schema = fs.readFileSync(schemaPath, "utf-8");
      await db.exec(schema);
      console.log("✅ Esquema inicial aplicado");
    } catch (err) {
      console.error("❌ Error al ejecutar schema.sql:", err.message);
    }
  } else {
    console.error("❌ No se encontró schema.sql");
  }
}

// 2️⃣ Migraciones automáticas
try {
  // Agregar columna 'role' si no existe
  try {
    await db.exec(`
      ALTER TABLE usuarios
      ADD COLUMN role TEXT DEFAULT 'nombre';
    `);
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) {
      throw err;
    }
    console.log("ℹ️ Columna 'role' ya existe, se omite");
  }

  // Marcar tu usuario 'Routel' como owner
  await db.exec(`
    UPDATE usuarios
    SET role = 'owner'
    WHERE nombre = 'Routel';
  `);

  // Agregar columna 'profile_img' si no existe
  try {
    await db.exec(`
      ALTER TABLE usuarios
      ADD COLUMN profile_img TEXT DEFAULT '/public/default_cover.png';
    `);
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) {
      throw err;
    }
    console.log("ℹ️ Columna 'profile_img' ya existe, se omite");
  }

  console.log("✅ Migraciones aplicadas correctamente");
} catch (err) {
  console.error("❌ Error al aplicar migraciones:", err.message);
}

export default db;
// Ahora 'db' está listo para usarse en otros módulos