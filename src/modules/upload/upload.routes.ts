import express from 'express';
import { uploadMedia } from './upload.controller.js';
import { upload } from '../../config/multer.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Route expects a single file named 'file'
router.post('/', protectRoute, upload.single('file'), uploadMedia);

export default router;
