import express from 'express';
import { getNotifications, markAsRead } from './notification.controller.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', protectRoute, getNotifications);
router.put('/:id/read', protectRoute, markAsRead);

export default router;
