import { Request, Response } from 'express';
import User from './user.model.js';

export const allUsers = async (req: Request | any, res: Response): Promise<void> => {
  const keyword = req.query.search
    ? {
        name: { $regex: req.query.search, $options: 'i' },
      }
    : {};

  try {
    const users = await User.find(keyword).find({ _id: { $ne: req.user._id } }).select('-password');
    res.status(200).json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /users/:id
 * Get a single user's public profile by ID.
 */
export const getUser = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-password -otp -otpExpiry');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.status(200).json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
