import express from 'express';
import { getAlbumes } from '../controllers/albumesController.js';

const router = express.Router();

router.get('/', getAlbumes);

export default router;
