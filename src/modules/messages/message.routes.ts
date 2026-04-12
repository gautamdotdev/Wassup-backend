import express from 'express';
import { sendMessage, fetchMessages } from './message.controller.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/', protectRoute, sendMessage);
router.get('/:chatId', protectRoute, fetchMessages);

export default router;
