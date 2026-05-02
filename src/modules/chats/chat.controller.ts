import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import Chat from './chat.model.js';
import User from '../users/user.model.js';
import Connection from '../connections/connection.model.js';
import Message from '../messages/message.model.js';
import { io } from '../../../server.js';

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
    // Check if they are connected OR share a common group
    const connection = await Connection.findOne({
      $or: [
        { senderId: req.user._id, receiverId: targetId, status: 'accepted' },
        { senderId: targetId, receiverId: req.user._id, status: 'accepted' }
      ]
    });

    if (!connection) {
      // Allow if they share at least one group chat
      const sharedGroup = await Chat.findOne({
        chatType: 'group',
        participants: { $all: [req.user._id, targetId] }
      });

      if (!sharedGroup) {
        res.status(403).json({ error: 'You must be connected to this user to chat' });
        return;
      }
    }

    // Check if chat already exists
    let isChat = await Chat.findOne({
      chatType: 'direct',
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
      chatType: 'direct',
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
      .populate('admins', '-password')
      .populate('createdBy', '-password')
      .sort({ updatedAt: -1 });

    const Message = (await import('../messages/message.model.js')).default;
    const chatsWithMeta = await Promise.all(
      chats.map(async (chat) => {
        const pointer = chat.readPointers?.find((p: any) => p.user.toString() === uid.toString());
        
        const unreadQuery: any = {
          chatId: chat._id,
          senderId: { $ne: uid },
        };

        if (pointer?.lastReadAt) {
          unreadQuery.createdAt = { $gt: pointer.lastReadAt };
        } else {
          // Fallback to individual readBy check if no pointer exists yet
          unreadQuery.readBy = { $ne: uid };
        }

        const unreadCount = await Message.countDocuments(unreadQuery);
        
        const obj: any = chat.toObject();
        obj.unreadCount = unreadCount;
        obj.isMuted = chat.mutedBy?.some((m: any) => m.toString() === uid.toString()) ?? false;
        obj.isLocked = chat.locks?.some((l: any) => l.user.toString() === uid.toString()) ?? false;

        if (obj.latestMessage) {
          const { deriveStatus } = await import('../messages/message.controller.js');
          const latestSenderId = (obj.latestMessage.senderId?._id || obj.latestMessage.senderId)?.toString();
          obj.latestMessage.tickStatus = deriveStatus(obj.latestMessage, latestSenderId);
        }

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
    
    let systemMsg = null;
    // Only show "changed theme" system message in GROUP chats
    if (chat?.chatType === 'group') {
      systemMsg = await Message.create({
        chatId,
        senderId: req.user._id,
        text: `${req.user.name} changed the chat theme`,
        isSystem: true,
        readBy: [req.user._id],
      });
    }

    // Notify all participants
    io.to(chatId.toString()).emit('theme-updated', { chatId, theme, systemMsg });

    res.status(200).json({ theme: chat?.theme, systemMsg });
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

// ─── CREATE GROUP CHAT ───
export const createGroup = async (req: Request | any, res: Response): Promise<void> => {
  const { participants, name, description, avatar } = req.body;

  if (!participants || !name) {
    res.status(400).json({ error: 'Please fill all the fields' });
    return;
  }

  const users = JSON.parse(participants);
  if (users.length < 2) {
    res.status(400).json({ error: 'More than 2 users are required to form a group chat' });
    return;
  }

  // Current user is always a participant and admin/creator
  users.push(req.user);

  try {
    const groupChat = await Chat.create({
      chatName: name,
      participants: users,
      chatType: 'group',
      admins: [req.user._id],
      createdBy: req.user._id,
      description: description || '',
      avatar: avatar || '',
      groupSettings: {
        canSendMessage: 'all',
        canAddMembers: 'all'
      }
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate('participants', '-password')
      .populate('admins', '-password')
      .populate('createdBy', '-password');

    // Create system message for group creation
    await Message.create({
      chatId: groupChat._id,
      senderId: req.user._id,
      text: `${req.user.name} created the group "${name}"`,
      isSystem: true,
      readBy: [req.user._id],
    });

    // Notify all participants about the new group
    fullGroupChat?.participants.forEach((p: any) => {
      io.to(p._id.toString()).emit('group-created', fullGroupChat);
    });

    res.status(200).json(fullGroupChat);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// ─── RENAME / UPDATE GROUP ───
export const updateGroup = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId, chatName, description, avatar } = req.body;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
       res.status(404).json({ error: 'Chat Not Found' });
       return;
    }

    // Only admins can update group info
    const isAdmin = chat.admins.some(a => a.toString() === req.user._id.toString());
    if (!isAdmin) {
      res.status(403).json({ error: 'Only admins can update group info' });
      return;
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { chatName, description, avatar },
      { new: true }
    )
      .populate('participants', '-password')
      .populate('admins', '-password')
      .populate('createdBy', '-password');

    // Notify all participants
    io.to(chatId.toString()).emit('group-updated', updatedChat);
    updatedChat?.participants.forEach((p: any) => {
      io.to(p._id.toString()).emit('group-updated', updatedChat);
    });

    res.status(200).json(updatedChat);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// ─── ADD TO GROUP ───
export const addToGroup = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId, userId } = req.body;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat Not Found' });
      return;
    }

    // Check settings: who can add members
    const isAdmin = chat.admins.some(a => a.toString() === req.user._id.toString());
    if (chat.groupSettings.canAddMembers === 'admins' && !isAdmin) {
      res.status(403).json({ error: 'Only admins can add members to this group' });
      return;
    }

    const added = await Chat.findByIdAndUpdate(
      chatId,
      { $addToSet: { participants: userId } },
      { new: true }
    )
      .populate('participants', '-password')
      .populate('admins', '-password')
      .populate('createdBy', '-password');

    // Create system message for adding member
    const targetUser = await User.findById(userId).select('name');
    const systemMsg = await Message.create({
      chatId,
      senderId: req.user._id,
      text: `${req.user.name} added ${targetUser?.name || 'someone'} to the group`,
      isSystem: true,
      readBy: [req.user._id],
    });

    // Notify all participants
    io.to(chatId.toString()).emit('member-added', { chatId, userId, chat: added, systemMsg });
    added?.participants.forEach((p: any) => {
       io.to(p._id.toString()).emit('member-added', { chatId, userId, chat: added, systemMsg });
    });

    res.status(200).json(added);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// ─── REMOVE FROM GROUP ───
export const removeFromGroup = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId, userId } = req.body;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat Not Found' });
      return;
    }

    // Only admins can remove members
    const isAdmin = chat.admins.some(a => a.toString() === req.user._id.toString());
    if (!isAdmin) {
      res.status(403).json({ error: 'Only admins can remove members' });
      return;
    }

    // Cannot remove the creator
    if (chat.createdBy.toString() === userId) {
      res.status(400).json({ error: 'Cannot remove the group creator' });
      return;
    }

    const removed = await Chat.findByIdAndUpdate(
      chatId,
      { 
        $pull: { 
          participants: userId,
          admins: userId
        } 
      },
      { new: true }
    )
      .populate('participants', '-password')
      .populate('admins', '-password')
      .populate('createdBy', '-password');

    // Create system message for removing member
    const targetUser = await User.findById(userId).select('name');
    const systemMsg = await Message.create({
      chatId,
      senderId: req.user._id,
      text: `${req.user.name} removed ${targetUser?.name || 'someone'} from the group`,
      isSystem: true,
      readBy: [req.user._id],
    });

    // Notify all participants including the removed one
    io.to(chatId.toString()).emit('member-removed', { chatId, userId, systemMsg });
    io.to(userId.toString()).emit('member-removed', { chatId, userId, systemMsg });
    removed?.participants.forEach((p: any) => {
       io.to(p._id.toString()).emit('member-removed', { chatId, userId, systemMsg });
    });

    res.status(200).json(removed);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// ─── LEAVE GROUP ───
export const leaveGroup = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId } = req.body;
  const uid = req.user._id;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat Not Found' });
      return;
    }

    // Creator cannot leave (they must delete)
    if (chat.createdBy.toString() === uid.toString()) {
      res.status(400).json({ error: 'Creator cannot leave. Please delete the group instead.' });
      return;
    }

    const updated = await Chat.findByIdAndUpdate(
      chatId,
      { 
        $pull: { 
          participants: uid,
          admins: uid
        } 
      },
      { new: true }
    );

    // Create system message for leaving group
    const systemMsg = await Message.create({
      chatId,
      senderId: uid,
      text: `${req.user.name} left the group`,
      isSystem: true,
      readBy: [uid],
    });

    // Notify others
    io.to(chatId.toString()).emit('user-left', { chatId, userId: uid, systemMsg });
    chat.participants.forEach((p: any) => {
      io.to(p._id.toString()).emit('user-left', { chatId, userId: uid, systemMsg });
    });

    res.status(200).json({ left: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// ─── DELETE GROUP ───
export const deleteGroup = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId } = req.params;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat Not Found' });
      return;
    }

    // Only creator can delete
    if (chat.createdBy.toString() !== req.user._id.toString()) {
      res.status(403).json({ error: 'Only the group creator can delete this group' });
      return;
    }

    await Chat.findByIdAndDelete(chatId);
    // Also delete all messages in this chat
    const Message = (await import('../messages/message.model.js')).default;
    await Message.deleteMany({ chatId });

    // Notify all participants
    chat.participants.forEach((p: any) => {
      io.to(p._id.toString()).emit('group-deleted', chatId);
    });

    res.status(200).json({ deleted: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// ─── UPDATE GROUP SETTINGS ───
export const updateGroupSettings = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId, canSendMessage, canAddMembers } = req.body;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat Not Found' });
      return;
    }

    // Only creator can update fundamental settings
    if (chat.createdBy.toString() !== req.user._id.toString()) {
      res.status(403).json({ error: 'Only the group creator can update these settings' });
      return;
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { 
        'groupSettings.canSendMessage': canSendMessage,
        'groupSettings.canAddMembers': canAddMembers
      },
      { new: true }
    );

    // Create system message for settings update
    const systemMsg = await Message.create({
      chatId,
      senderId: req.user._id,
      text: `${req.user.name} updated group settings`,
      isSystem: true,
      readBy: [req.user._id],
    });

    // Notify all participants
    io.to(chatId.toString()).emit('settings-updated', { chatId, settings: updatedChat?.groupSettings, systemMsg });

    res.status(200).json({ chat: updatedChat, systemMsg });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
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
