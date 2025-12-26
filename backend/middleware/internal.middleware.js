import dotenv from 'dotenv';
dotenv.config();

export const internalOnly = (req, res, next) => {
    // 1. Validar IP (Localhost)
    // ::1 es IPv6 localhost, 127.0.0.1 es IPv4
    const allowedIps = ['::1', '127.0.0.1', '::ffff:127.0.0.1'];
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!allowedIps.includes(clientIp)) {
        console.warn(`⚠️ Intento de acceso no autorizado a API interna desde IP: ${clientIp}`);
        return res.status(403).json({ error: 'Forbidden: Internal Access Only' });
    }

    // 2. Validar Secret Header
    const secret = req.headers['x-spectra-secret'];
    const expectedSecret = process.env.SPECTRA_SECRET;

    if (!expectedSecret) {
        console.error("❌ FATAL: SPECTRA_SECRET no está definido en el .env del backend");
        return res.status(500).json({ error: 'Server Misconfiguration' });
    }

    if (secret !== expectedSecret) {
        console.warn(`⚠️ Intento de acceso con secreto inválido desde localhost.`);
        return res.status(403).json({ error: 'Forbidden: Invalid Secret' });
    }

    next();
};
