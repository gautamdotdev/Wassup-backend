import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import Chat from './chat.model.js';
import User from '../users/user.model.js';
import Connection from '../connections/connection.model.js';

/* ─── helpers ─── */
function userId(req: any): string { return req.user._id.toString(); }

// ─── access or create 1-on-1 chat ───
export const accessChat = async (req: Request | any, res: Response): Promise<void> => {
  const { userId: targetId } = req.body;

  if (!targetId) {
    res.status(400).json({ error: 'UserId param not sent with request' });
    return;
  }

  try {
    // Check if they are connected
    const connection = await Connection.findOne({
      $or: [
        { senderId: req.user._id, receiverId: targetId, status: 'accepted' },
        { senderId: targetId, receiverId: req.user._id, status: 'accepted' }
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
        { participants: { $elemMatch: { $eq: targetId } } }
      ]
    })
      .populate('participants', '-password')
      .populate('latestMessage');

    if (isChat) {
      res.status(200).json(isChat);
      return;
    }

    const createdChat = await Chat.create({
      chatName: 'sender',
      isGroupChat: false,
      participants: [req.user._id, targetId]
    });
    const fullChat = await Chat.findOne({ _id: createdChat._id }).populate('participants', '-password');

    res.status(200).json(fullChat);
  } catch (error: any) {
    console.error('Error accessing chat:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── fetch all chats for logged-in user ───
export const fetchChats = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const uid = req.user._id;

    const chats = await Chat.find({ participants: { $elemMatch: { $eq: uid } } })
      .populate('participants', '-password')
      .populate({
        path: 'latestMessage',
        populate: { path: 'senderId', select: 'name avatar _id' }
      })
      .populate('admin', '-password')
      .sort({ updatedAt: -1 });

    const Message = (await import('../messages/message.model.js')).default;
    const chatsWithMeta = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          chatId: chat._id,
          senderId: { $ne: uid },
          readBy: { $ne: uid }
        });
        const obj: any = chat.toObject();
        obj.unreadCount = unreadCount;
        obj.isMuted = chat.mutedBy?.some((m: any) => m.toString() === uid.toString()) ?? false;
        obj.isLocked = chat.locks?.some((l: any) => l.user.toString() === uid.toString()) ?? false;
        return obj;
      })
    );

    res.status(200).json(chatsWithMeta);
  } catch (error: any) {
    console.error('Error fetching chats:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── MUTE / UNMUTE notifications ───
export const muteChat = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId } = req.params;
  const uid = req.user._id;
  const { mute } = req.body; // boolean

  try {
    const update = mute
      ? { $addToSet: { mutedBy: uid } }
      : { $pull:    { mutedBy: uid } };

    await Chat.findByIdAndUpdate(chatId, update);
    res.status(200).json({ muted: !!mute });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ─── BLOCK ───
export const blockChatUser = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId } = req.params;
  try {
    await Chat.findByIdAndUpdate(chatId, { blockedBy: req.user._id });
    res.status(200).json({ blocked: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ─── CLEAR chat (per-user) ───
export const clearChat = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId } = req.params;
  const uid = req.user._id.toString();

  try {
    // Remove any existing clearedAt entry for this user, then add fresh one
    await Chat.findByIdAndUpdate(chatId, {
      $pull: { clearedAt: { user: req.user._id } }
    });
    await Chat.findByIdAndUpdate(chatId, {
      $push: { clearedAt: { user: req.user._id, at: new Date() } }
    });
    res.status(200).json({ cleared: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ─── SET THEME ───
export const setChatTheme = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId } = req.params;
  const { theme } = req.body;

  try {
    const chat = await Chat.findByIdAndUpdate(chatId, { theme }, { new: true });
    res.status(200).json({ theme: chat?.theme });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ─── SET LOCK PASSWORD ───
export const setChatLock = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId } = req.params;
  const { password } = req.body; // null = remove lock
  const uid = req.user._id.toString();

  try {
    // Remove existing lock entry for this user
    await Chat.findByIdAndUpdate(chatId, { $pull: { locks: { user: req.user._id } } });

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await Chat.findByIdAndUpdate(chatId, {
        $push: { locks: { user: req.user._id, passwordHash: hash } }
      });
    }

    res.status(200).json({ locked: !!password });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ─── VERIFY LOCK PASSWORD ───
export const verifyChatLock = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId } = req.params;
  const { password } = req.body;
  const uid = req.user._id.toString();

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) { res.status(404).json({ error: 'Chat not found' }); return; }

    const lock = chat.locks?.find((l: any) => l.user.toString() === uid);
    if (!lock) { res.status(200).json({ verified: true }); return; } // no lock

    const ok = await bcrypt.compare(password, lock.passwordHash);
    res.status(200).json({ verified: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET CHAT MEDIA ───
export const getChatMedia = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId } = req.params;
  try {
    const Message = (await import('../messages/message.model.js')).default;
    const media = await Message.find({
      chatId,
      mediaUrl: { $exists: true, $ne: null }
    }).select('mediaUrl mediaType createdAt senderId').sort({ createdAt: -1 });

    res.status(200).json(media);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
