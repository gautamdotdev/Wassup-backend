import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface IChat extends Document {
  chatType: "direct" | "group";
  chatName?: string;
  description?: string;
  avatar?: string;
  participants: mongoose.Types.ObjectId[];
  latestMessage?: mongoose.Types.ObjectId;
  admins: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  // Mute
  mutedBy: mongoose.Types.ObjectId[];
  // Block
  blockedBy?: mongoose.Types.ObjectId; // user who blocked in this chat
  // Clear – tracks per-user clear timestamp so they don't see old msgs
  clearedAt: Array<{ user: mongoose.Types.ObjectId; at: Date }>;
  // Theme
  theme?: string;
  // Lock – per-user lock password hash
  locks: Array<{ user: mongoose.Types.ObjectId; passwordHash: string }>;
  // Read Pointers – tracks per-user last read message
  readPointers: Array<{ user: mongoose.Types.ObjectId; lastReadMessageId?: mongoose.Types.ObjectId; lastReadAt: Date }>;
  // Settings
  groupSettings: {
    canSendMessage: "all" | "admins";
    canAddMembers: "all" | "admins";
  };
  // Verify lock password helper
  verifyLockPassword(userId: string, plain: string): Promise<boolean>;
}

const ChatSchema: Schema = new Schema(
  {
    chatType: { type: String, enum: ["direct", "group"], default: "direct" },
    chatName: { type: String },
    description: { type: String },
    avatar: { type: String },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    latestMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    mutedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    blockedBy: { type: Schema.Types.ObjectId, ref: "User" },
    clearedAt: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        at: { type: Date },
      },
    ],
    theme: { type: String, default: "default" },
    locks: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        passwordHash: { type: String },
      },
    ],
    readPointers: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        lastReadMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
        lastReadAt: { type: Date, default: Date.now },
      },
    ],
    groupSettings: {
      canSendMessage: { type: String, enum: ["all", "admins"], default: "all" },
      canAddMembers: { type: String, enum: ["all", "admins"], default: "all" },
    },
  },
  {
    timestamps: true,
  },
);

/** Instance helper – verify a user's lock password */
ChatSchema.methods.verifyLockPassword = async function (
  userId: string,
  plain: string,
): Promise<boolean> {
  const lock = this.locks.find((l: any) => l.user.toString() === userId);
  if (!lock) return false;
  return bcrypt.compare(plain, lock.passwordHash);
};

export default mongoose.model<IChat>("Chat", ChatSchema);
