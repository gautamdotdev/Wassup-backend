import express from 'express';
import { sendMessage, fetchMessages, markMessagesRead } from './message.controller.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// NOTE: /read/:chatId MUST come before /:chatId to prevent Express
// from treating the literal "read" as a chatId parameter.
router.post('/',               protectRoute, sendMessage);
router.post('/read/:chatId',   protectRoute, markMessagesRead);
router.get('/:chatId',         protectRoute, fetchMessages);

export default router;
