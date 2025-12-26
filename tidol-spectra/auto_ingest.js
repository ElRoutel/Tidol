const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_URL = 'http://localhost:3001';
const MEDIA_DIR = path.join(__dirname, 'media');

// --- CONFIGURACIÓN DE SEGURIDAD ---
const REQUESTS_PER_MINUTE = 10; 
const DELAY_MS = (60000 / REQUESTS_PER_MINUTE); // 6000ms (6 segundos) por canción

// Función de espera (Sleep)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function autoIngest() {
    console.log(`
    =================================================
    🤖 SPECTRA AUTO-INGEST | RATE LIMIT ACTIVADO
    =================================================
    🎯 Objetivo: ${REQUESTS_PER_MINUTE} canciones/minuto
    ⏳ Intervalo: ${DELAY_MS / 1000} segundos entre archivos
    =================================================
    `);

    // 1. Leer archivos de la carpeta
    let files;
    try {
        files = fs.readdirSync(MEDIA_DIR).filter(file => {
            return file.toLowerCase().endsWith('.mp3') || 
                   file.toLowerCase().endsWith('.flac') || 
                   file.toLowerCase().endsWith('.m4a');
        });
    } catch (err) {
        console.error("❌ Error leyendo carpeta media:", err.message);
        return;
    }

    if (files.length === 0) {
        console.log("❌ No encontré archivos de audio en /media.");
        return;
    }

    console.log(`📂 Cola encontrada: ${files.length} archivos.`);
    console.log("---------------------------------------------------\n");

    // 2. Bucle con Freno de Mano
    for (const [index, file] of files.entries()) {
        const startTime = Date.now();
        const currentNum = index + 1;

        try {
            process.stdout.write(`[${currentNum}/${files.length}] 📤 Procesando: "${file.substring(0, 30)}..." `);
            
            // Llamada al servidor (Ingesta + Análisis)
            const response = await axios.post(`${API_URL}/ingest`, {
                filename: file,
                ia_id: "local_batch_" + Date.now(), // ID temporal único
                metadata_override: { 
                    // Limpiamos un poco el nombre quitando la extensión
                    title: file.replace(/\.[^/.]+$/, ""), 
                    artist: "Local Library" 
                }
            });

            if (response.data.success) {
                console.log(`✅ OK (ID: ${response.data.trackId})`);
            } else {
                console.log(`⚠️ (Saltado)`);
            }

        } catch (error) {
            console.log(`❌ ERROR: ${error.message}`);
        }

        // 3. EL FRENO (Rate Limiter)
        // Solo esperamos si NO es el último archivo
        if (currentNum < files.length) {
            const processTime = Date.now() - startTime;
            // Ajustamos el tiempo de espera restando lo que tardó la petición
            const waitTime = Math.max(0, DELAY_MS - processTime); 
            
            console.log(`   ⏳ Esperando ${Math.round(waitTime/1000)}s para enfriar motores...\n`);
            await sleep(waitTime);
        }
    }

    console.log("\n===================================================");
    console.log("✨ ¡PROCESO TERMINADO! ✨");
    console.log("Todas las canciones han sido enviadas a Spectra.");
    console.log(`👉 Revisa el orden BPM en: ${API_URL}/smart-queue/bpm-flow`);
}

autoIngest();