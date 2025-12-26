import { exec } from "child_process";
import path from "path";
import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

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
 * Guarda los datos en la tabla calidad_audio VIA API INTERNA
 * Evita concurrencia directa con SQLite
 */
export const guardarCalidad = async (cancionId, data) => {
  try {
    const secret = process.env.SPECTRA_SECRET;
    if (!secret) {
      throw new Error("SPECTRA_SECRET no definido en variables de entorno");
    }

    // URL del backend (asumimos localhost:3000 por defecto si no se configura otra cosa)
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    const endpoint = `${backendUrl}/api/internal/spectra/analysis`;

    const response = await axios.post(
      endpoint,
      { cancionId, data },
      {
        headers: {
          "x-spectra-secret": secret,
          "Content-Type": "application/json"
        }
      }
    );

    if (response.data && response.data.success) {
      // console.log(`✅ Calidad guardada vía API para canción ${cancionId}`);
    } else {
      console.warn(`⚠️ Respuesta inesperada al guardar calidad para canción ${cancionId}:`, response.data);
    }

  } catch (error) {
    console.error(`❌ Error guardando calidad vía API para canción ${cancionId}:`, error.message);
    if (error.response) {
      console.error("Detalles del error:", error.response.data);
    }
    throw error; // Re-lanzar para que el llamador sepa que falló
  }
};
