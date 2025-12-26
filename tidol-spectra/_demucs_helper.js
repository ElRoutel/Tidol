// Helper function to run ONLY Demucs separation (for Karaoke mode)
// This is separate from runDemucsAndWhisper to allow independent Karaoke generation
function runDemucsOnly(track, inputPath) {
    return new Promise(async (resolve, reject) => {
        const STEMS_DIR = path.join(__dirname, 'uploads', 'stems');
        const filenameNoExt = path.basename(inputPath, path.extname(inputPath));
        const trackStemsDir = path.join(STEMS_DIR, filenameNoExt);
        const vocalsPath = path.join(trackStemsDir, 'vocals.wav');
        const accompanimentPath = path.join(trackStemsDir, 'accompaniment.wav');

        let processTimeout;

        const cleanup = () => {
            if (processTimeout) clearTimeout(processTimeout);
        };

        try {
            // Set timeout (5 minutes for Demucs only)
            processTimeout = setTimeout(() => {
                console.error(`⏱️ Demucs timeout for Track #${track.id}`);
                cleanup();
                reject(new Error('Demucs timeout (5 minutes)'));
            }, 5 * 60 * 1000);

            // Check if stems already exist
            if (fs.existsSync(vocalsPath) && fs.existsSync(accompanimentPath)) {
                console.log(`🎤 [Demucs] Voces ya existen, usando caché.`);
                cleanup();
                resolve({
                    vocals: vocalsPath,
                    accompaniment: accompanimentPath
                });
                return;
            }

            console.log(`🎤 [Demucs] Separando voces para: ${track.title || filenameNoExt}...`);

            const demucsProcess = spawn('python', ['vox_demucs.py', inputPath, STEMS_DIR]);

            let dOutput = '';
            let dError = '';

            demucsProcess.stdout.on('data', (data) => {
                const line = data.toString();
                dOutput += line;
                console.log(`Demucs: ${line.trim()}`);
            });

            demucsProcess.stderr.on('data', (data) => {
                dError += data.toString();
            });

            demucsProcess.on('close', (code) => {
                cleanup();

                if (code === 0) {
                    try {
                        const result = JSON.parse(dOutput);
                        if (result.status === 'success') {
                            console.log(`✅ [Demucs] Separación exitosa`);
                            resolve({
                                vocals: result.vocals,
                                accompaniment: result.accompaniment
                            });
                        } else {
                            reject(new Error(result.message || 'Demucs failed'));
                        }
                    } catch (e) {
                        reject(new Error('Invalid Demucs output'));
                    }
                } else {
                    reject(new Error(`Demucs failed with code ${code}: ${dError.substring(0, 200)}`));
                }
            });

        } catch (error) {
            cleanup();
            reject(error);
        }
    });
}
