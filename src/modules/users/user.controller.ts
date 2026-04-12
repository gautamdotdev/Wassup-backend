import { Request, Response } from 'express';
import User from './user.model.js';

export const allUsers = async (req: Request | any, res: Response): Promise<void> => {
  const keyword = req.query.search
    ? {
        name: { $regex: req.query.search, $options: 'i' }, // case insensitive
      }
    : {};

  try {
    // Find all users matching keyword EXCEPT the current logged-in user
    const users = await User.find(keyword).find({ _id: { $ne: req.user._id } }).select('-password');
    res.status(200).json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
