import { exec } from "child_process";
import path from "path";
import fs from "fs";
import db from "./models/db.js";

const SPECTRO_DIR = "./uploads/spectros"; // carpeta para los PNG
if (!fs.existsSync(SPECTRO_DIR)) fs.mkdirSync(SPECTRO_DIR, { recursive: true });

/**
 * Ejecuta ffprobe y devuelve metadatos del audio
 */
export const analizarCancion = (filePath) => {
  return new Promise((resolve, reject) => {
    const cmd = `ffprobe -v error -show_entries stream=codec_name,channels,sample_rate,bit_rate,bits_per_sample -of json "${filePath}"`;
    exec(cmd, (err, stdout) => {
      if (err) return reject(err);
      try {
        const info = JSON.parse(stdout);
        const stream = info.streams[0] || {};
        const bitDepth = parseInt(stream.bits_per_sample) || 16;
        const sampleRate = parseInt(stream.sample_rate) || 44100;
        const bitRate = parseInt(stream.bit_rate) || 0;
        const codec = stream.codec_name || "unknown";
        resolve({ bitDepth, sampleRate, bitRate, codec });
      } catch (e) {
        reject(e);
      }
    });
  });
};

/**
 * Genera un espectrograma PNG usando ffmpeg
 */
export const generarEspectrograma = (filePath) => {
  return new Promise((resolve, reject) => {
    const filename = path.basename(filePath, path.extname(filePath)) + ".png";
    const output = path.join(SPECTRO_DIR, filename);

    const cmd = `ffmpeg -y -i "${filePath}" -lavfi showspectrumpic=s=640x360:legend=1 "${output}"`;
    exec(cmd, (err) => {
      if (err) return reject(err);
      resolve(output);
    });
  });
};

export const clasificarCalidad = ({ bitDepth, sampleRate, codec }) => {
  // Hi-Res: 24-bit o superior con 48kHz+
  if (bitDepth >= 24 && sampleRate >= 48000) return "Hi-Res";

  // CD Quality: 16-bit con 44.1kHz+ (típicamente FLAC, WAV)
  if (bitDepth >= 16 && sampleRate >= 44100) return "CD";

  // Lossy: MP3, AAC, etc.
  const lossyCodecs = ["mp3", "aac", "vorbis", "opus"];
  if (lossyCodecs.includes(codec.toLowerCase())) return "Lossy";

  // Por defecto, si no coincide con nada, probablemente sea lossy
  return "Lossy";
};

/**
 * Guarda los datos en la tabla calidad_audio
 */
export const guardarCalidad = async (cancionId, data) => {
  const { bitDepth, sampleRate, bitRate, codec, clasificacion, espectrograma, sospechoso } = data;
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
};
