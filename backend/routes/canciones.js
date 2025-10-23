import multer from "multer";
import path from "path";
import express from "express";
import db from "../models/db.js";

const router = express.Router();

// 🔹 Búsqueda de canciones
router.get("/search", async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === "") {
    return res.json([]); // Si no hay búsqueda, devolver vacío
  }

  try {
    const query = `
      SELECT id, titulo, archivo, 
             COALESCE(cover, 'NoImageSong.png') as cover
      FROM canciones
      WHERE titulo LIKE ? OR artista LIKE ? OR album LIKE ?
      ORDER BY id DESC
    `;
    const results = await db.all(query, [`%${q}%`, `%${q}%`, `%${q}%`]);

    res.json(results);
  } catch (err) {
    console.error("❌ Error en búsqueda:", err);
    res.status(500).json({ error: "Error interno en búsqueda" });
  }
});


// 🔹 Configuración de subida
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/musica"); // aquí se guardan los archivos
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// 🔹 Endpoint para subir canción
router.post("/upload/musica", upload.single("song"), async (req, res) => {
  try {
    const { titulo, artista, album } = req.body;
    const archivo = req.file.filename;

    const cover = "NoImageSong.png"; // por ahora default

    await db.run(
      "INSERT INTO canciones (titulo, artista, album, archivo, cover) VALUES (?, ?, ?, ?, ?)",
      [titulo, artista, album, archivo, cover]
    );

    res.json({ message: "✅ Canción subida con éxito" });
  } catch (err) {
    console.error("❌ Error al subir canción:", err);
    res.status(500).json({ error: "Error al subir canción" });
  }
});

export default router;
