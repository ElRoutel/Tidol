import db from './models/db.js';

async function check() {
    console.log("🔍 Verificando esquema de base de datos...");

    try {
        const columns = await db.all("PRAGMA table_info(canciones)");
        console.log("📊 Columnas encontradas:", columns.map(c => c.name).join(", "));

        const hasIaId = columns.some(c => c.name === 'ia_id');
        const hasBpm = columns.some(c => c.name === 'bpm');

        if (hasIaId && hasBpm) {
            console.log("✅ Las columnas existen correctamente.");
        } else {
            console.error("❌ FALTAN COLUMNAS IMPORTANTE!");
            if (!hasIaId) console.error("   - Faltan: ia_id");
            if (!hasBpm) console.error("   - Faltan: bpm");
        }
    } catch (error) {
        console.error("❌ Error verificando DB:", error);
    }
}

check();
