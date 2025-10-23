import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../models/db.js";

const router = express.Router();
const SECRET = "clave-super-secreta";

// Registro
router.post("/register", (req, res) => {
  const { nombre, email, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);

  db.run(
    "INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)",
    [nombre, email, hash],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, nombre, email });
    }
  );
});

// Login
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM usuarios WHERE email = ?", [email], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    const token = jwt.sign({ id: user.id, nombre: user.nombre }, SECRET, {
      expiresIn: "2h"
    });
    res.json({ token, nombre: user.nombre });
  });
});

// Modo invitado
router.get("/guest", (req, res) => {
  res.json({ invitado: true, nombre: "Guest" });
});

export default router;
