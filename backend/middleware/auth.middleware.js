import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  const SECRET = process.env.JWT_SECRET;
  const token = req.headers["x-token"];
  if (!token) return res.status(401).json({ message: "No autorizado" });

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch (err) {
    console.error("Token inválido:", err.message);
    res.status(401).json({ message: "Token inválido" });
  }
};

export const authRole = (allowedRoles) => {
  return (req, res, next) => {
    const SECRET = process.env.JWT_SECRET;
    const token = req.headers["x-token"];
    if (!token)
      return res.status(401).json({ message: "401 No autorizado, falta token" });

    try {
      const payload = jwt.verify(token, SECRET);
      if (!payload || !payload.role)
        return res.status(401).json({ message: "Token inválido o corrupto" });

      if (!allowedRoles.includes(payload.role)) {
        console.log(`🚫 Acceso denegado: ${payload.username} (${payload.role})`);
        return res.status(403).json({ message: "Acceso denegado" });
      }

      req.user = payload;
      next();
    } catch (err) {
      console.error("❌ Error verificando token:", err.message);
      res.status(401).json({ message: "Token inválido o expirado" });
    }
  };
};
