import express from 'express';
import { allUsers, getUser } from './user.controller.js';
import { protectRoute } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/',    protectRoute, allUsers);
router.get('/:id', protectRoute, getUser);

export default router;
