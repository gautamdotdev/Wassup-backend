import express from 'express';
import { accessChat, fetchChats } from './chat.controller.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', protectRoute, accessChat);
router.get('/', protectRoute, fetchChats);

export default router;
