import express from 'express';
import { allUsers, getUser, saveFcmToken } from './user.controller.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/',    protectRoute, allUsers);
router.get('/:id', protectRoute, getUser);
router.post('/save-fcm-token', protectRoute, saveFcmToken);

export default router;
