const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const axios = require('axios');

// Configuration
const DB_PATH = path.join(__dirname, 'spectra.db');
const UPLOADS_LYRICS_DIR = path.join(__dirname, 'uploads', 'lyrics');
const STEMS_DIR = path.join(__dirname, 'uploads', 'stems');
const MEDIA_DIR = path.join(__dirname, '..', 'backend'); // Adjust if needed for local files

const PYTHON_PORT = 8008;
const PYTHON_SERVER_URL = `http://127.0.0.1:${PYTHON_PORT}`;

// Ensure directories exist
if (!fs.existsSync(UPLOADS_LYRICS_DIR)) fs.mkdirSync(UPLOADS_LYRICS_DIR, { recursive: true });
if (!fs.existsSync(STEMS_DIR)) fs.mkdirSync(STEMS_DIR, { recursive: true });

// Connect to Database
const db = new Database(DB_PATH);

async function checkServerHealth() {
    try {
        const res = await axios.get(`${PYTHON_SERVER_URL}/health`);
        return res.data.status === 'ready';
    } catch (e) {
        return false;
    }
}

async function main() {
    console.log("🚀 Starting Batch Lyrics Processor (Spectra Engine Client)...");

    // 1. Check if Spectra Engine is running
    console.log("📡 Connecting to Spectra Audio Server...");
    const isReady = await checkServerHealth();

    if (!isReady) {
        console.error("❌ Spectra Engine (Python Server) is NOT running or not ready.");
        console.error("   Please run 'node server.js' in another terminal first.");
        process.exit(1);
    }
    console.log("✅ Connected to Spectra Engine.");

    // 2. Fetch all tracks
    const tracks = db.prepare('SELECT * FROM tracks').all();
    console.log(`📋 Found ${tracks.length} tracks in database.`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const filenameNoExt = path.basename(track.filepath, path.extname(track.filepath));
        const lrcPath = path.join(UPLOADS_LYRICS_DIR, `${filenameNoExt}.lrc`);

        // Check if already processed (LRC exists)
        if (fs.existsSync(lrcPath)) {
            skippedCount++;
            continue;
        }

        // Determine input path
        let inputPath;
        if (track.filepath.startsWith('uploads/')) {
            inputPath = path.join(__dirname, track.filepath);
        } else {
            inputPath = path.join(MEDIA_DIR, track.filepath);
        }

        // Resolve absolute path for Python
        inputPath = path.resolve(inputPath);
        const absLrcPath = path.resolve(lrcPath);
        const absStemsDir = path.resolve(STEMS_DIR);

        if (!fs.existsSync(inputPath)) {
            // Try looking in backend uploads if relative
            const backendPath = path.resolve(__dirname, '..', 'backend', track.filepath);
            if (fs.existsSync(backendPath)) {
                inputPath = backendPath;
            } else {
                console.error(`❌ File not found: ${inputPath}`);
                errorCount++;
                continue;
            }
        }

        console.log(`\n[${i + 1}/${tracks.length}] Sending: ${track.title} (${track.artist})...`);
        const startTime = Date.now();

        try {
            // PETICIÓN HTTP AL SERVIDOR PYTHON
            await axios.post(`${PYTHON_SERVER_URL}/process_track`, {
                input_path: inputPath,
                output_dir_stems: absStemsDir,
                output_path_lrc: absLrcPath,
                skip_transcription: false
            });

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`✅ Done in ${duration}s`);
            processedCount++;

        } catch (error) {
            console.error(`❌ Error processing ${track.title}:`);
            if (error.response) {
                console.error(`   Server says: ${JSON.stringify(error.response.data)}`);
            } else {
                console.error(`   ${error.message}`);
            }
            errorCount++;
        }
    }

    console.log("\n🎉 Batch Processing Completed!");
    console.log(`Processed: ${processedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
}

main();
