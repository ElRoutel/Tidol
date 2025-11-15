import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../models/db.js";

function logStatus(name, success, info = "") {
    const icon = success ? "✅" : "❌";
    console.log(`${icon} ${name} ${info}`);
}

export const validateToken = (req, res) => {
    const authHeader = req.headers["authorization"];
    const SECRET = process.env.JWT_SECRET;

    if (!authHeader) return res.status(401).json({ message: "No autorizado" });

    const token = authHeader.split(" ")[1]; // Leer el Bearer

    try {
        const payload = jwt.verify(token, SECRET);
        res.json({ username: payload.username, role: payload.role });
    } catch (err) {
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

        const token = jwt.sign({ id: user.id, username: user.nombre, role: user.role }, SECRET, { expiresIn: "24h" });//aqui se puede cambir el tiempo de expiracion

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

export const getUserInfo = async (req, res) => {
    const authHeader = req.headers["authorization"];
    const SECRET = process.env.JWT_SECRET;

    if (!authHeader) {
        return res.status(401).json({ message: "No autorizado" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const payload = jwt.verify(token, SECRET);

        const user = await db.get(
            "SELECT id, nombre AS username, email, role, profile_img FROM usuarios WHERE id = ?",
            [payload.id]
        );

        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.json(user);
    } catch (err) {
        if (err.name === "JsonWebTokenError") {
            return res.status(401).json({ message: "Token inválido" });
        }
        console.error("Error fetching user info:", err);
        res.status(500).json({ message: "Error en el servidor" });
    }
};

