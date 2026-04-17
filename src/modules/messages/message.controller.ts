import { Request, Response } from 'express';
import Message from './message.model.js';
import Chat from '../chats/chat.model.js';
import { io } from '../../../server.js';

export const sendMessage = async (req: Request | any, res: Response): Promise<void> => {
  const { content, chatId, mediaUrl, mediaType } = req.body;

  if (!chatId || (!content && !mediaUrl)) {
    res.status(400).json({ error: 'Invalid data passed into request' });
    return;
  }

  const newMessage = {
    senderId: req.user._id,
    text: content,
    chatId: chatId,
    mediaUrl: mediaUrl,
    mediaType: mediaType,
    readBy: [req.user._id]
  };

  try {
    let message = await Message.create(newMessage);

    // Populate sender and chat info for immediate return
    message = await message.populate('senderId', 'name avatar');
    message = await message.populate({
      path: 'chatId',
      populate: { path: 'participants', select: '-password' }
    });

    // Update the latestMessage in Chat
    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

    res.status(200).json(message);
  } catch (error: any) {
    console.error('Error sending message:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const fetchMessages = async (req: Request | any, res: Response): Promise<void> => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId })
      .populate('senderId', 'name avatar email')
      .populate('chatId')
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error: any) {
    console.error('Error fetching messages:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * POST /messages/read/:chatId
 * Marks all messages in a chat as read by the current user.
 * Emits a "messages read" socket event so the sender's UI can upgrade ticks.
 */
export const markMessagesRead = async (req: Request | any, res: Response): Promise<void> => {
  const { chatId } = req.params;
  const userId = req.user._id;

  try {
    // Add current user to readBy on all messages they haven't read yet
    await Message.updateMany(
      {
        chatId,
        senderId: { $ne: userId },   // only messages from the other user
        readBy: { $ne: userId }       // that haven't been read yet
      },
      { $addToSet: { readBy: userId } }
    );

    // Also update latestMessage on chat so MessengersPage unread logic reflects the change
    const chat = await Chat.findById(chatId)
      .populate('participants', '-password')
      .populate({
        path: 'latestMessage',
        populate: { path: 'senderId', select: 'name avatar' }
      });

    // Tell the sender (the other participant) that their messages were read
    if (chat) {
      const senderId = chat.participants
        .find((p: any) => p._id.toString() !== userId.toString())
        ?._id?.toString();

      if (senderId) {
        // Emit directly to sender's personal socket room
        io.to(senderId).emit('messages read', { chatId, readBy: userId });
      }
    }

    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    console.error('Error marking messages as read:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
