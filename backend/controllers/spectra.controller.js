import db from "../models/db.js";

export const receiveAnalysis = async (req, res) => {
    try {
        const { cancionId, data } = req.body;

        if (!cancionId || !data) {
            return res.status(400).json({ error: "Missing 'cancionId' or 'data'" });
        }

        const { bitDepth, sampleRate, bitRate, codec, clasificacion, espectrograma, sospechoso } = data;

        // Lógica movida desde audioQuality.js
        const exists = await db.get("SELECT * FROM calidad_audio WHERE cancion_id = ?", [cancionId]);

        if (exists) {
            await db.run(
                `UPDATE calidad_audio
                 SET bit_depth=?, sample_rate=?, bit_rate=?, codec=?, clasificacion=?, espectrograma=?, sospechoso=?, fecha_analisis=CURRENT_TIMESTAMP
                 WHERE cancion_id=?`,
                [bitDepth, sampleRate, bitRate, codec, clasificacion, espectrograma, sospechoso ? 1 : 0, cancionId]
            );
        } else {
            await db.run(
                `INSERT INTO calidad_audio (cancion_id, bit_depth, sample_rate, bit_rate, codec, clasificacion, espectrograma, sospechoso)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [cancionId, bitDepth, sampleRate, bitRate, codec, clasificacion, espectrograma, sospechoso ? 1 : 0]
            );
        }

        console.log(`✅ [Spectra API] Análisis guardado para canción ID: ${cancionId}`);
        res.json({ success: true, message: "Analysis saved successfully" });

    } catch (error) {
        console.error("❌ [Spectra API] Error saving analysis:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
