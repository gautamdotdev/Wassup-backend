import { Request, Response } from 'express';
import Chat from './chat.model.js';
import User from '../users/user.model.js';
import Connection from '../connections/connection.model.js';

// Access a 1-on-1 chat or create it if it doesn't exist
export const accessChat = async (req: Request | any, res: Response): Promise<void> => {
  const { userId } = req.body; // The user we want to chat with

  if (!userId) {
    res.status(400).json({ error: 'UserId param not sent with request' });
    return;
  }

  try {
    // Check if they are connected
    const connection = await Connection.findOne({
      $or: [
        { senderId: req.user._id, receiverId: userId, status: 'accepted' },
        { senderId: userId, receiverId: req.user._id, status: 'accepted' }
      ]
    });

    if (!connection) {
      res.status(403).json({ error: 'You must be connected to this user to chat' });
      return;
    }

    // Check if chat already exists
    let isChat = await Chat.findOne({
      isGroupChat: false,
      $and: [
        { participants: { $elemMatch: { $eq: req.user._id } } },
        { participants: { $elemMatch: { $eq: userId } } }
      ]
    })
      .populate('participants', '-password')
      .populate('latestMessage');

    if (isChat) {
      res.status(200).json(isChat);
      return;
    }

    // If chat doesn't exist, create a new one
    const chatData = {
      chatName: 'sender',
      isGroupChat: false,
      participants: [req.user._id, userId]
    };

    const createdChat = await Chat.create(chatData);
    const fullChat = await Chat.findOne({ _id: createdChat._id }).populate('participants', '-password');

    res.status(200).json(fullChat);
  } catch (error: any) {
    console.error('Error accessing chat:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Fetch all chats for the logged-in user
export const fetchChats = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const chats = await Chat.find({ participants: { $elemMatch: { $eq: req.user._id } } })
      .populate('participants', '-password')
      .populate('latestMessage')
      .populate('admin', '-password')
      .sort({ updatedAt: -1 });

    res.status(200).json(chats);
  } catch (error: any) {
    console.error('Error fetching chats:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
