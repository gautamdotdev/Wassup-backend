import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../modules/users/user.model.js';
import config from '../config/env.config.js';

export const protectRoute = async (req: Request | any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      res.status(401).json({ error: 'Unauthorized - No Token Provided' });
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;

    if (!decoded) {
      res.status(401).json({ error: 'Unauthorized - Invalid Token' });
      return;
    }

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    console.error('Error in protectRoute middleware: ', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
