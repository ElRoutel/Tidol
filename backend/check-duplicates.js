import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'models', 'database.sqlite');
console.log(`📂 Abriendo base de datos: ${dbPath}\n`);

const db = new Database(dbPath);

// Listar todas las tablas
console.log('📋 Tablas en la base de datos:\n');
const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
`).all();

tables.forEach(table => {
    try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
        console.log(`  - ${table.name} (${count.count} registros)`);
    } catch (e) {
        console.log(`  - ${table.name} (error al contar)`);
    }
});

console.log('\n');

// Buscar duplicados en canciones_externas (Internet Archive)
console.log('🔍 Buscando IDs duplicados en canciones_externas...\n');

const duplicatesExternas = db.prepare(`
    SELECT id, COUNT(*) as count 
    FROM canciones_externas 
    GROUP BY id 
    HAVING count > 1
`).all();

if (duplicatesExternas.length > 0) {
    console.log(`⚠️  Encontrados ${duplicatesExternas.length} IDs duplicados en canciones_externas:\n`);

    duplicatesExternas.forEach(dup => {
        console.log(`\n📌 ID "${dup.id}" (${dup.count} copias):`);

        const songs = db.prepare(`
            SELECT rowid, id, titulo, artista, album, url 
            FROM canciones_externas 
            WHERE id = ?
        `).all(dup.id);

        songs.forEach((song, index) => {
            console.log(`  ${index + 1}. ROWID: ${song.rowid}`);
            console.log(`     Título: ${song.titulo}`);
            console.log(`     Artista: ${song.artista}`);
            console.log(`     Álbum: ${song.album || 'N/A'}`);
            console.log(`     URL: ${song.url ? song.url.substring(0, 60) + '...' : 'N/A'}`);
        });
    });

    if (process.argv.includes('--fix')) {
        console.log('\n🧹 Limpiando duplicados en canciones_externas...\n');

        let totalDeleted = 0;
        const deleteStmt = db.prepare('DELETE FROM canciones_externas WHERE id = ? AND rowid != ?');

        const transaction = db.transaction(() => {
            duplicatesExternas.forEach(dup => {
                const firstSong = db.prepare(`
                    SELECT rowid 
                    FROM canciones_externas 
                    WHERE id = ?
                    ORDER BY rowid ASC
                    LIMIT 1
                `).get(dup.id);

                const result = deleteStmt.run(dup.id, firstSong.rowid);
                totalDeleted += result.changes;

                console.log(`  ✅ ID "${dup.id}": Mantenido ROWID ${firstSong.rowid}, eliminadas ${result.changes} copias`);
            });
        });

        transaction();

        console.log(`\n✅ Limpieza completada. Eliminadas ${totalDeleted} canciones duplicadas.`);
        console.log('   Reinicia el servidor backend para aplicar los cambios.\n');
    }
} else {
    console.log('✅ No se encontraron IDs duplicados en canciones_externas.');
}

if (!process.argv.includes('--fix') && duplicatesExternas.length > 0) {
    console.log('\n\n🔧 Para limpiar los duplicados, ejecuta:');
    console.log('   node check-duplicates.js --fix\n');
    console.log('⚠️  ADVERTENCIA: Esto eliminará todas las copias duplicadas excepto la primera.\n');
}

db.close();
