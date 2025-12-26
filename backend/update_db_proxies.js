import db from './models/db.js';

const ACTIVE_PORTS = Array.from({ length: 30 }, (_, i) => 8881 + i);

async function updateProxies() {
    console.log("🚀 Actualizando base de datos de proxies...");

    // Limpiar tabla
    await db.run("DELETE FROM proxies");

    const stmt = await db.prepare("INSERT INTO proxies (address, active, last_used) VALUES (?, 1, ?)");

    for (const port of ACTIVE_PORTS) {
        const address = `http://127.0.0.1:${port}`;
        await stmt.run(address, Date.now());
        console.log(`   ✅ Proxy registrado: ${address}`);
    }

    console.log(`⚡ Total: ${ACTIVE_PORTS.length} proxies activos registrados.`);
}

updateProxies();
