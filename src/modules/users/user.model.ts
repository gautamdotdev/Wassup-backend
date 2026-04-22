import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  avatar: string;
  status: string;
  lastSeen: Date;
  online: boolean;
  otp?: string;
  otpExpiry?: Date;
  fcmToken?: string;
  pushNotificationsEnabled: boolean;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Optional if using OTP
  avatar: { type: String, default: 'https://i.pravatar.cc/150' },
  status: { type: String, default: 'Hey there! I am using Wassup' },
  lastSeen: { type: Date, default: Date.now },
  online: { type: Boolean, default: false },
  otp: { type: String },
  otpExpiry: { type: Date },
  fcmToken: { type: String },
  pushNotificationsEnabled: { type: Boolean, default: true }
}, {
  timestamps: true
});

export default mongoose.model<IUser>('User', UserSchema);
