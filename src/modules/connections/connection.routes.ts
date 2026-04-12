import express from 'express';
import { sendRequest, respondRequest, getConnections } from './connection.controller.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', protectRoute, getConnections);
router.post('/', protectRoute, sendRequest);
router.put('/:id', protectRoute, respondRequest);

export default router;
