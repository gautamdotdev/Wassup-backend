import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
  isGroupChat: boolean;
  chatName?: string;
  participants: mongoose.Types.ObjectId[];
  latestMessage?: mongoose.Types.ObjectId;
  admin?: mongoose.Types.ObjectId;
}

const ChatSchema: Schema = new Schema({
  isGroupChat: { type: Boolean, default: false },
  chatName: { type: String },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  latestMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  admin: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

export default mongoose.model<IChat>('Chat', ChatSchema);
