import express from 'express';
import { requestOtp, verifyOtp, logout, getMe } from './auth.controller.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/logout', logout);

router.get('/me', protectRoute, getMe);

export default router;
