import { Request, Response } from 'express';
import Notification from './notification.model.js';

export const getNotifications = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .populate('relatedUserId', 'name avatar')
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (error: any) {
    console.error('Error fetching notifications:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const markAsRead = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const notif = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notif) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.status(200).json(notif);
  } catch (error: any) {
    console.error('Error marking notification as read:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
