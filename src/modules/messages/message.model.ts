import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  chatId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'voice';
  replyTo?: mongoose.Types.ObjectId;
  readBy: mongoose.Types.ObjectId[];
  reactions: Array<{ user: mongoose.Types.ObjectId; emoji: string }>;
}

const MessageSchema: Schema = new Schema({
  chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String },
  mediaUrl: { type: String },
  mediaType: { type: String, enum: ['image', 'video', 'voice'] },
  replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  reactions: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String }
  }]
}, {
  timestamps: true
});

export default mongoose.model<IMessage>('Message', MessageSchema);
