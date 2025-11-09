import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  const SECRET = process.env.JWT_SECRET;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No autorizado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, SECRET);
    req.userId = payload.id;
    next();
  } catch (err) {
    console.error("Token inválido:", err.message);
    res.status(401).json({ message: "Token inválido" });
  }
};

export const authRole = (allowedRoles) => {
  return (req, res, next) => {
    const SECRET = process.env.JWT_SECRET;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "401 No autorizado, falta token" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const payload = jwt.verify(token, SECRET);
      if (!payload?.role) {
        return res.status(401).json({ message: "Token inválido o corrupto" });
      }

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
