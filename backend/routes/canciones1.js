import express from "express";
import multer from "multer";
import path from "path";
import db from "../models/db.js";
import { leerMetadata } from "../utils/metadata.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: "./backend/uploads/musica/",
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Subir canción
router.post("/upload", upload.single("cancion"), async (req, res) => {
  const filePath = req.file.path;
  const meta = await leerMetadata(filePath);

  db.run(
    "INSERT INTO canciones (titulo, archivo, duracion, portada) VALUES (?, ?, ?, ?)",
    [meta.titulo, filePath, meta.duracion, meta.portada],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        id: this.lastID,
        titulo: meta.titulo,
        archivo: filePath,
        duracion: meta.duracion,
        portada: meta.portada
      });
    }
  );
});

// Listar canciones (ordenadas por más recientes)
router.get("/", (req, res) => {
  db.all("SELECT * FROM canciones ORDER BY fecha_subida DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

export default router;
