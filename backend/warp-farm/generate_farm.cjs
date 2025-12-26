const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// CONFIGURACIÓN DINÁMICA
const args = process.argv.slice(2);
const PROXY_COUNT = parseInt(args[0]) || 10; // Default a 10 si no se especifica
const START_PORT = 8880;

async function main() {
    console.log(`\n🏭 Construyendo la Granja de WARP (${PROXY_COUNT} Proxies)...`);

    let dockerServices = "";

    for (let i = 1; i <= PROXY_COUNT; i++) {
        const dirName = `node_${i}`;
        const dirPath = path.join(__dirname, dirName);

        // 1. Crear carpeta para este nodo
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);

        // Copiar wgcf.exe ahí para ejecutarlo
        if (!fs.existsSync(path.join(dirPath, 'wgcf.exe'))) {
            // Asumimos que wgcf.exe está en la carpeta actual
            if (fs.existsSync(path.join(__dirname, 'wgcf.exe'))) {
                fs.copyFileSync(path.join(__dirname, 'wgcf.exe'), path.join(dirPath, 'wgcf.exe'));
            } else {
                console.error("❌ No encuentro wgcf.exe en la carpeta actual.");
                return;
            }
        }

        console.log(`\n--- Configurando Nodo ${i} ---`);

        try {
            // 2. Registrar cuenta WARP (Si no existe ya)
            if (!fs.existsSync(path.join(dirPath, 'wgcf-account.toml'))) {
                console.log(`   📝 Registrando cuenta en Cloudflare...`);
                // --accept-tos evita el prompt interactivo
                execSync('wgcf.exe register --accept-tos', { cwd: dirPath, stdio: 'ignore' });
                // Esperar un poco para evitar rate limit agresivo
                await new Promise(r => setTimeout(r, 2000));
            }

            // 3. Generar perfil WireGuard
            if (!fs.existsSync(path.join(dirPath, 'wgcf-profile.conf'))) {
                console.log(`   ⚙️ Generando perfil WireGuard...`);
                execSync('wgcf.exe generate', { cwd: dirPath, stdio: 'ignore' });
            }

            // FIX: Gluetun necesita IP, no dominio. Reemplazamos engage.cloudflareclient.com por su IP.
            // FIX: Gluetun falla con IPv6. Quitamos la dirección IPv6.
            const confPath = path.join(dirPath, 'wgcf-profile.conf');
            if (fs.existsSync(confPath)) {
                let confContent = fs.readFileSync(confPath, 'utf8');

                // 1. Reemplazar Endpoint
                if (confContent.includes('engage.cloudflareclient.com')) {
                    // console.log(`   🔧 Parcheando DNS endpoint...`);
                    confContent = confContent.replace('engage.cloudflareclient.com', '162.159.192.1');
                }

                // 2. Quitar IPv6 de Address (ej: 172.16.0.2/32, 2606:...)
                const lines = confContent.split('\n');
                const newLines = lines.map(line => {
                    if (line.startsWith('Address =')) {
                        // Tomamos solo la parte antes de la coma (IPv4)
                        return line.split(',')[0].trim();
                    }
                    return line;
                });
                confContent = newLines.join('\n');

                fs.writeFileSync(confPath, confContent);
            }

        } catch (e) {
            console.error(`   ❌ Error en nodo ${i} (Posible Rate Limit de Cloudflare). Espera unos minutos.`);
            continue;
        }

        // 4. Agregar al Docker Compose
        // Usamos la imagen qmcgaw/gluetun:latest
        // Mapeamos el puerto HTTP (888x)
        const port = START_PORT + i;

        dockerServices += `
  warp-${i}:
    image: qmcgaw/gluetun
    container_name: warp-proxy-${i}
    cap_add:
      - NET_ADMIN
    devices:
      - /dev/net/tun:/dev/net/tun
    ports:
      - ${port}:8888/tcp # HTTP Proxy
    volumes:
      - ./node_${i}/wgcf-profile.conf:/gluetun/wireguard/wg0.conf:ro
    environment:
      - VPN_SERVICE_PROVIDER=custom
      - VPN_TYPE=wireguard
      - HTTPPROXY=on
      - HTTPPROXY_LOG=off
    restart: always
`;
        console.log(`   ✅ Nodo ${i} listo. Puerto asignado: ${port}`);
    }

    // 5. Generar archivo docker-compose.yml final
    const dockerComposeContent = `version: "3"
services:${dockerServices}
`;

    fs.writeFileSync(path.join(__dirname, 'docker-compose.yml'), dockerComposeContent);
    console.log("\n✅ ¡Granja generada! Archivo 'docker-compose.yml' creado.");
    console.log("👉 Ejecuta: 'docker-compose up -d' para encender los motores.");
}

main();
