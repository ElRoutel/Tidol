import { Router } from "express";
import { receiveAnalysis } from "../controllers/spectra.controller.js";
import { internalOnly } from "../middleware/internal.middleware.js";

const router = Router();

// Aplicar middleware de seguridad a todas las rutas de este router
router.use(internalOnly);

router.post("/analysis", receiveAnalysis);

export default router;
