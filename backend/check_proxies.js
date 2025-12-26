import db from './models/db.js';

async function checkProxies() {
    const proxies = await db.all("SELECT * FROM proxies");
    console.log(`Total Proxies: ${proxies.length}`);
    proxies.forEach(p => {
        console.log(`- ${p.address} (Active: ${p.active})`);
    });
}

checkProxies();
