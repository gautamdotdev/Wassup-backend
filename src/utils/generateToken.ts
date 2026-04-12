import jwt from 'jsonwebtoken';
import { Response } from 'express';
import config from '../config/env.config.js';

const generateTokenAndSetCookie = (userId: string, res: Response) => {
  const token = jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });

  res.cookie('jwt', token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, 
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
  });

  return token;
};

export default generateTokenAndSetCookie;
