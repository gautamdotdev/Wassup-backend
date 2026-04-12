import express from 'express';
import rateLimit from 'express-rate-limit';
import { requestOtp, verifyOtp, logout, getMe } from './auth.controller.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Specific limiter for authentication routes (e.g., OTP requests)
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 5, // Limit each IP to 5 OTP requests per hour
    message: 'Too many OTP requests, please try again after an hour',
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

router.post('/request-otp', authLimiter, requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/logout', logout);

router.get('/me', protectRoute, getMe);

export default router;

