import express from 'express';
import {
  sendMessage, fetchMessages, markMessagesRead,
  toggleReaction, searchMessages, deleteMessage
} from './message.controller.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// NOTE: specific paths must come before wildcard /:chatId
router.post('/',                     protectRoute, sendMessage);
router.post('/read/:chatId',         protectRoute, markMessagesRead);
router.post('/:id/react',            protectRoute, toggleReaction);
router.delete('/:id',                protectRoute, deleteMessage);
router.get('/:chatId/search',        protectRoute, searchMessages);
router.get('/:chatId',               protectRoute, fetchMessages);

export default router;
