import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  relatedUserId?: mongoose.Types.ObjectId;
  type: 'missed_voice' | 'missed_video' | 'security' | 'system';
  text: string;
  isRead: boolean;
}

const NotificationSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  relatedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['missed_voice', 'missed_video', 'security', 'system'], required: true },
  text: { type: String, required: true },
  isRead: { type: Boolean, default: false }
}, {
  timestamps: true
});

export default mongoose.model<INotification>('Notification', NotificationSchema);
