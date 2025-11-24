import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../models/db.js";

// ============ CONFIG DINÁMICA ============
// ❗ Nunca guardes el secreto en variable global
const getSecret = () => process.env.JWT_SECRET;

// Expiración JWT
const TOKEN_EXPIRE = "1h";
const VALID_ROLES = ["user", "admin", "tester", "owner"];

// Sanitizador simple (evitar XSS / SQL)
const sanitize = (str) =>
    String(str)
        .trim()
        .replace(/[<>$'"`]/g, "");

// Logs bonitos
function logStatus(name, ok, info = "") {
    console.log(`${ok ? "✅" : "❌"} ${name} ${info}`);
}

// ==================== VALIDATE TOKEN =====================
export const validateToken = (req, res) => {
    try {
        const authHeader = req.headers["authorization"];
        if (!authHeader)
            return res.status(401).json({ message: "No autorizado" });

        const token = authHeader.split(" ")[1];
        const payload = jwt.verify(token, getSecret());

        res.json({
            id: payload.id,
            username: payload.username,
            role: payload.role,
        });

    } catch (err) {
        return res.status(401).json({ message: "Token inválido" });
    }
};

// ==================== REGISTER =====================
export const registerUser = async (req, res) => {
    try {
        let { username, password } = req.body;
        username = sanitize(username);

        const role = "user";

        if (!username || !password)
            return res.status(400).json({ message: "Datos inválidos" });

        if (password.length < 6)
            return res.status(400).json({ message: "Contraseña demasiado corta (mínimo 6)" });

        if (!/^[a-zA-Z0-9._-]{3,20}$/.test(username))
            return res.status(400).json({ message: "Formato de usuario inválido" });

        const exists = await db.get(
            "SELECT id FROM usuarios WHERE nombre = ? LIMIT 1",
            [username]
        );

        if (exists)
            return res.status(400).json({ message: "El usuario ya existe" });

        const hashed = await bcrypt.hash(password, 12);

        await db.run(
            "INSERT INTO usuarios (nombre, password, role) VALUES (?, ?, ?)",
            [username, hashed, role]
        );

        logStatus("Registro", true, username);

        res.status(201).json({ message: "Usuario registrado correctamente" });

    } catch (err) {
        logStatus("Registro", false, err.message);
        res.status(500).json({ message: "Error interno" });
    }
};

// ==================== LOGIN =====================
export const loginUser = async (req, res) => {
    try {
        let { username, password } = req.body;
        username = sanitize(username);

        if (!username || !password)
            return res.status(400).json({ message: "Datos inválidos" });

        const user = await db.get(
            "SELECT id, nombre, password, role FROM usuarios WHERE nombre = ?",
            [username]
        );

        if (!user)
            return res.status(400).json({ message: "Usuario o contraseña inválidos" });

        const valid = await bcrypt.compare(password, user.password);

        if (!valid)
            return res.status(401).json({ message: "Usuario o contraseña inválidos" });

        const token = jwt.sign(
            {
                id: user.id,
                username: user.nombre,
                role: user.role,
            },
            getSecret(),
            { expiresIn: TOKEN_EXPIRE }
        );

        logStatus("Login", true, `${username} (${user.role})`);

        res.json({
            token,
            username: user.nombre,
            role: user.role,
            redirectPage: "/",
        });

    } catch (err) {
        logStatus("Login", false, err.message);
        return res.status(500).json({ message: "Error interno" });
    }
};

// ==================== USER INFO =====================
export const getUserInfo = async (req, res) => {
    try {
        const authHeader = req.headers["authorization"];
        if (!authHeader)
            return res.status(401).json({ message: "No autorizado" });

        const token = authHeader.split(" ")[1];
        const payload = jwt.verify(token, getSecret());

        const user = await db.get(
            `
                SELECT 
                    id,
                    nombre AS username,
                    email,
                    role,
                    profile_img
                FROM usuarios
                WHERE id = ?
                LIMIT 1
            `,
            [payload.id]
        );

        if (!user)
            return res.status(404).json({ message: "Usuario no encontrado" });

        res.json(user);

    } catch (err) {
        if (err.name === "JsonWebTokenError")
            return res.status(401).json({ message: "Token inválido" });

        console.error("Error getUserInfo:", err);
        return res.status(500).json({ message: "Error interno" });
    }
};
