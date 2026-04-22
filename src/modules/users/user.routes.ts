import express from 'express';
import { allUsers, getUser, saveFcmToken, updateSettings } from './user.controller.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// DEBUG LOG: This will run every time any request hits /api/users
router.use((req, res, next) => {
  console.log(`[Users Router] ${req.method} ${req.url}`);
  next();
});

router.patch('/update-settings', protectRoute, updateSettings);
router.patch('/settings', protectRoute, updateSettings); // Alias just in case
router.post('/save-fcm-token', protectRoute, saveFcmToken);
router.get('/',    protectRoute, allUsers);
router.get('/:id', protectRoute, getUser);

export default router;
