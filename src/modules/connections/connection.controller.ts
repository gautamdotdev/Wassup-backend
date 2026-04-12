import { Request, Response } from 'express';
import Connection from './connection.model.js';
import Notification from '../notifications/notification.model.js';

export const sendRequest = async (req: Request | any, res: Response): Promise<void> => {
  const { receiverId } = req.body;

  if (!receiverId) {
    res.status(400).json({ error: 'Receiver ID is required' });
    return;
  }

  try {
    const existing = await Connection.findOne({
      $or: [
        { senderId: req.user._id, receiverId },
        { senderId: receiverId, receiverId: req.user._id }
      ]
    });

    if (existing) {
      res.status(400).json({ error: 'Connection request already exists or you are already connected.' });
      return;
    }

    const connection = await Connection.create({
      senderId: req.user._id,
      receiverId
    });

    // Let's also create a notification for the receiver
    await Notification.create({
      userId: receiverId,
      relatedUserId: req.user._id,
      type: 'system',
      text: 'wants to chat with you',
      isRead: false
    });

    res.status(201).json(connection);
  } catch (error: any) {
    console.error('Error in sendRequest:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const respondRequest = async (req: Request | any, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body; // 'accepted' or 'rejected'

  if (!['accepted', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  try {
    const conn = await Connection.findById(id);

    if (!conn) {
      res.status(404).json({ error: 'Connection request not found' });
      return;
    }

    // Only the receiver can accept or reject
    if (conn.receiverId.toString() !== req.user._id.toString()) {
      res.status(403).json({ error: 'Not authorized to respond to this request' });
      return;
    }

    conn.status = status;
    await conn.save();

    res.status(200).json(conn);
  } catch (error: any) {
    console.error('Error in respondRequest:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getConnections = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const connections = await Connection.find({
      $or: [{ senderId: req.user._id }, { receiverId: req.user._id }]
    }).populate('senderId', 'name avatar').populate('receiverId', 'name avatar');

    res.status(200).json(connections);
  } catch (error: any) {
    console.error('Error in getConnections:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
