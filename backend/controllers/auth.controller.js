import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../models/db.js";

function logStatus(name, success, info = "") {
    const icon = success ? "✅" : "❌";
    console.log(`${icon} ${name} ${info}`);
}

export const validateToken = (req, res) => {
    const token = req.headers["x-token"];
    const SECRET = process.env.JWT_SECRET;
    console.log("/api/validate token recibido:"); // 🔹 log para debug

    if (!token) return res.status(401).json({ message: "No autorizado" });

    try {
        const payload = jwt.verify(token, SECRET);
        console.log("👽 Payload verificado:"); // 🔹 log para debug
        res.json({ username: payload.username, role: payload.role });
    } catch (err) {
        console.error("Error verificando token:", err.message); // 🔹 log para debug
        res.status(401).json({ message: "Token inválido" });
    }
};

export const registerUser = async (req, res) => {
    const { username, password, role } = req.body; // role opcional
    try {
        if (!username || !password)
            return res.status(400).json({ message: "Datos inválidos" });

        const SECRET = process.env.JWT_SECRET;
        const exists = await db.get("SELECT * FROM usuarios WHERE nombre = ?", [username]);
        if (exists) return res.status(400).json({ message: "El usuario ya existe" });

        const hashed = await bcrypt.hash(password, 12);
        await db.run(
            "INSERT INTO usuarios (nombre, password, role) VALUES (?, ?, ?)",
            [username, hashed, role || "user"]
        );
        logStatus("Registro de usuario", true, username);
        res.json({ message: "Usuario registrado" });
    } catch (err) {
        logStatus("Registro de usuario", false, err.message);
        res.status(500).json({ message: "Error en el servidor" });
    }
};

export const loginUser = async (req, res) => {
    const { username, password } = req.body;
    const SECRET = process.env.JWT_SECRET;
    try {
        const user = await db.get("SELECT * FROM usuarios WHERE nombre = ?", [username]);
        if (!user) return res.status(400).json({ message: "Usuario no encontrado" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ message: "Contraseña incorrecta" });

        const token = jwt.sign({ id: user.id, username: user.nombre, role: user.role }, SECRET, { expiresIn: "1h" });

        let redirectPage = "/";
        if (["admin", "tester", "owner"].includes(user.role)) {
            redirectPage = "/";
        }

        logStatus("Login", true, `${username} (${user.role})`);
        res.json({ token, username: user.nombre, role: user.role, redirectPage });
    } catch (err) {
        logStatus("Login", false, err.message);
        res.status(500).json({ message: "Error en el servidor" });
    }
};

export const getUserInfo = (req, res) => {
    const authHeader = req.headers["authorization"] || req.headers["x-token"];
    const SECRET = process.env.JWT_SECRET;
    if (!authHeader) return res.status(401).json({ message: "No autorizado" });

    const token = authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : authHeader;

    try {
        const payload = jwt.verify(token, SECRET);

        db.get(
            "SELECT id, nombre, role, profile_img FROM usuarios WHERE nombre = ?",
            [payload.username],
            (err, user) => {
                if (err) return res.status(500).json({ message: "Error de base de datos" });
                if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
                res.json(user);
            }
        );
    } catch (err) {
        res.status(401).json({ message: "Token inválido" });
    }
};
