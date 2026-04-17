import { Request, Response } from 'express';
import Message from './message.model.js';
import Chat from '../chats/chat.model.js';
import { io } from '../../../server.js';

/**
 * Derive the tick status for a sent message based on DB fields.
 *   "seen"      → readBy has someone other than sender
 *   "delivered" → deliveredTo has someone
 *   "sent"      → nobody else has received it yet
 */
function deriveStatus(m: any, senderId: string): 'sent' | 'delivered' | 'seen' {
  const readByOthers = (m.readBy || []).some(
    (id: any) => id.toString() !== senderId
  );
  if (readByOthers) return 'seen';

  const delivered = (m.deliveredTo || []).length > 0;
  if (delivered) return 'delivered';

  return 'sent';
}

/* ─────────────────────────────────────────────────────────────────────────── */
export const sendMessage = async (req: Request | any, res: Response): Promise<void> => {
  const { content, chatId, mediaUrl, mediaType, replyTo } = req.body;

  if (!chatId || (!content && !mediaUrl)) {
    res.status(400).json({ error: 'Invalid data passed into request' });
    return;
  }

  try {
    let message = await Message.create({
      senderId: req.user._id,
      text: content,
      chatId,
      mediaUrl,
      mediaType,
      readBy: [req.user._id],   // sender auto-read
      deliveredTo: [],          // starts empty; server.ts fills it when socket delivers
      ...(replyTo ? { replyTo } : {}),
    });

    message = await message.populate('senderId', 'name avatar');
    message = await message.populate({
      path: 'chatId',
      populate: { path: 'participants', select: '-password' },
    });
    if (replyTo) {
      message = await message.populate('replyTo', 'text senderId');
    }

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

    res.status(200).json(message);
  } catch (error: any) {
    console.error('Error sending message:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
export const fetchMessages = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId })
      .populate('senderId', 'name avatar email')
      .populate('chatId')
      .populate('replyTo', 'text senderId')
      .sort({ createdAt: 1 });

    // Attach a computed `tickStatus` to each message so the client can
    // decide which tick icon to show without extra logic.
    const withStatus = messages.map((m: any) => {
      const senderId = (m.senderId?._id || m.senderId)?.toString();
      const obj = m.toObject();
      obj.tickStatus = deriveStatus(obj, senderId);
      return obj;
    });

    res.status(200).json(withStatus);
  } catch (error: any) {
    console.error('Error fetching messages:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/**
 * POST /messages/read/:chatId
 * Marks all unread messages in a chat as read by the current user.
 * Emits "messages read" to the sender so their UI upgrades ticks to blue.
 */
export const markMessagesRead = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId } = req.params;
  const userId = req.user._id;

  try {
    await Message.updateMany(
      {
        chatId,
        senderId: { $ne: userId },
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } }
    );

    const chat = await Chat.findById(chatId)
      .populate('participants', '-password')
      .populate({
        path: 'latestMessage',
        populate: { path: 'senderId', select: 'name avatar' },
      });

    if (chat) {
      const senderId = chat.participants
        .find((p: any) => p._id.toString() !== userId.toString())
        ?._id?.toString();

      if (senderId) {
        io.to(senderId).emit('messages read', { chatId, readBy: userId });
      }
    }

    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    console.error('Error marking messages as read:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/**
 * markMessageDelivered — single message, called when recipient is online at send time.
 * Emits "message delivered" { messageId, chatId } to the sender.
 */
export const markMessageDelivered = async (messageId: string, recipientId: string): Promise<void> => {
  try {
    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        deliveredTo: { $ne: recipientId }, // skip if already delivered
      },
      { $addToSet: { deliveredTo: recipientId } },
      { new: true }
    ).populate('senderId', '_id');

    if (message) {
      const senderId = (message.senderId as any)?._id?.toString() || message.senderId?.toString();
      if (senderId) {
        io.to(senderId).emit('message delivered', {
          messageId: message._id.toString(),
          chatId: message.chatId.toString(),
        });
      }
    }
  } catch (err) {
    console.error('markMessageDelivered error:', err);
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/**
 * deliverPendingMessages — called when a user comes back online (setup event).
 *
 * Finds every message that:
 *   - was NOT sent by this user
 *   - has NOT been delivered to this user yet
 *   - has NOT been read by this user yet  (if already read, seen > delivered)
 *
 * Bulk-marks them as delivered, then groups by (senderId, chatId) and emits
 * one "messages delivered" { chatId, messageIds } event per group to each sender.
 */
export const deliverPendingMessages = async (recipientId: string): Promise<void> => {
  try {
    // Only fetch fields we need — lean() for speed
    const pending = await Message.find({
      senderId:    { $ne: recipientId },
      deliveredTo: { $ne: recipientId },
      readBy:      { $ne: recipientId }, // already-read msgs don't need delivery update
    })
      .select('_id chatId senderId')
      .lean();

    if (pending.length === 0) return;

    const messageIds = pending.map((m: any) => m._id);

    // Bulk update in one DB write
    await Message.updateMany(
      { _id: { $in: messageIds } },
      { $addToSet: { deliveredTo: recipientId } }
    );

    // Group by senderId → chatId so we emit minimal socket events
    const grouped = new Map<string, Map<string, string[]>>();
    // grouped: senderId → chatId → [messageId, ...]

    for (const m of pending as any[]) {
      const senderId = m.senderId.toString();
      const chatId   = m.chatId.toString();
      const msgId    = m._id.toString();

      if (!grouped.has(senderId)) grouped.set(senderId, new Map());
      const byChat = grouped.get(senderId)!;

      if (!byChat.has(chatId)) byChat.set(chatId, []);
      byChat.get(chatId)!.push(msgId);
    }

    // Emit one event per (sender, chat) pair
    for (const [senderId, byChat] of grouped) {
      for (const [chatId, msgIds] of byChat) {
        io.to(senderId).emit('messages delivered', { chatId, messageIds: msgIds });
      }
    }
  } catch (err) {
    console.error('deliverPendingMessages error:', err);
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/**
 * POST /messages/:id/react
 * Body: { emoji: string }
 *
 * Toggles a user's reaction on a message (add if absent, remove if present).
 * Broadcasts 'reaction updated' to the entire chat room for real-time UI.
 */
export const toggleReaction = async (req: Request | any, res: Response): Promise<void> => {
  const { id: messageId } = req.params;
  const { emoji } = req.body;
  const userId = req.user._id.toString();

  if (!emoji) {
    res.status(400).json({ error: 'emoji is required' });
    return;
  }

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const alreadyReacted = message.reactions.some(
      (r: any) => r.user.toString() === userId && r.emoji === emoji
    );

    if (alreadyReacted) {
      await Message.findByIdAndUpdate(messageId, {
        $pull: { reactions: { user: req.user._id, emoji } },
      });
    } else {
      await Message.findByIdAndUpdate(messageId, {
        $push: { reactions: { user: req.user._id, emoji } },
      });
    }

    const updated = await Message.findById(messageId).select('reactions chatId');
    const reactions = updated?.reactions ?? [];

    // Broadcast to every participant in this chat room
    io.to(message.chatId.toString()).emit('reaction updated', {
      messageId: messageId.toString(),
      reactions,
    });

    res.status(200).json({ reactions });
  } catch (err: any) {
    console.error('toggleReaction error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
