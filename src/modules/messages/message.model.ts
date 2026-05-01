import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  chatId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'voice';
  replyTo?: mongoose.Types.ObjectId;
  /**
   * deliveredTo — users who have received the message (online at the time it was sent).
   * The sender is NOT included here. Used to show ✓✓ (grey) ticks.
   */
  deliveredTo: mongoose.Types.ObjectId[];
  /**
   * readBy — users who have opened the chat and seen the message.
   * The sender IS included here (added on creation).
   * Used to show ✓✓ (blue) ticks.
   */
  readBy: mongoose.Types.ObjectId[];
  reactions: Array<{ user: mongoose.Types.ObjectId; emoji: string }>;
  deletedBy: mongoose.Types.ObjectId[];
  isSystem?: boolean;
  isEdited?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema = new Schema({
  chatId:     { type: Schema.Types.ObjectId, ref: 'Chat',    required: true },
  senderId:   { type: Schema.Types.ObjectId, ref: 'User',    required: true },
  text:       { type: String },
  mediaUrl:   { type: String },
  mediaType:  { type: String, enum: ['image', 'video', 'voice'] },
  replyTo:    { type: Schema.Types.ObjectId, ref: 'Message' },
  deliveredTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  readBy:     [{ type: Schema.Types.ObjectId, ref: 'User' }],
  reactions:  [{ user: { type: Schema.Types.ObjectId, ref: 'User' }, emoji: { type: String } }],
  deletedBy:  [{ type: Schema.Types.ObjectId, ref: 'User' }],
  isSystem:   { type: Boolean, default: false },
  isEdited:   { type: Boolean, default: false },
}, {
  timestamps: true,
});

export default mongoose.model<IMessage>('Message', MessageSchema);
