import { Router } from "express";
import { registerUser, loginUser, validateToken, getUserInfo } from "../controllers/auth.controller.js";
import rateLimit from "express-rate-limit";

const router = Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Demasiados intentos, inténtalo más tarde." },
});

router.post("/register", registerUser);
router.post("/login", loginLimiter, loginUser);
router.get("/validate", validateToken);
router.get('/me', getUserInfo);

export default router;
