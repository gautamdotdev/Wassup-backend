import http from "http";
import { Server } from "socket.io";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { connectRedis } from "./src/config/redis.js";
import config from "./src/config/env.config.js";

import jwt from "jsonwebtoken";

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.io
export const io = new Server(server, {
  cors: {
    origin: true,


    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  },

  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
});

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
        jwt.verify(token, config.jwt.secret, (err: any, decoded: any) => {
            if (err) return next(new Error("Authentication error"));
            socket.data.user = decoded;
            next();
        });
    } else {
        // We can allow connection without token for now if necessary, 
        // but for a chat app, most events should be protected.
        next();
    }
});

console.log("Socket.io initialized and waiting for connections...");




// Track socketId → userId mapping for online presence
const onlineUsers = new Map<string, string>(); // socketId → userId

// Socket Events
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("setup", async (userData) => {
    if (!userData?._id) return;
    const userId = userData._id.toString();
    socket.join(userId);
    socket.data.userId = userId;
    onlineUsers.set(socket.id, userId);

    // Mark user online in DB
    try {
      const User = (await import("./src/modules/users/user.model.js")).default;
      await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
    } catch (e) { /* swallow */ }

    // Deliver all messages that were sent while this user was offline.
    // This upgrades the sender's "sent" (1 tick) → "delivered" (2 ticks grey).
    try {
      const { deliverPendingMessages } = await import("./src/modules/messages/message.controller.js");
      // Run async, don't block the setup response
      deliverPendingMessages(userId).catch(() => {});
    } catch (e) { /* swallow */ }

    // Broadcast online presence to everyone
    io.emit("user-online", userId);
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", async (newMessageRecieved) => {
    const chat = newMessageRecieved.chatId;

    if (!chat || !chat.participants)
      return console.log("chat.participants not defined");

    const chatId = chat._id ? chat._id.toString() : chat.toString();
    const messageId = newMessageRecieved._id?.toString();
    const senderId = newMessageRecieved.senderId?._id
      ? newMessageRecieved.senderId._id.toString()
      : newMessageRecieved.senderId?.toString();

    // Deliver to each participant (except the sender)
    for (const user of chat.participants) {
      const recipientId = user._id ? user._id.toString() : user.toString();
      if (recipientId === senderId) continue;

      // Check if this recipient is currently online (has an active socket)
      const recipientOnline = [...onlineUsers.values()].includes(recipientId);

      // Emit message to recipient's personal room + the shared chat room
      io.to(recipientId).emit("message recieved", newMessageRecieved);
      io.to(chatId).emit("message recieved", newMessageRecieved);

      // If recipient is online → mark as delivered + notify sender
      if (recipientOnline && messageId) {
        try {
          const { markMessageDelivered } = await import("./src/modules/messages/message.controller.js");
          await markMessageDelivered(messageId, recipientId);
        } catch (e) { /* swallow */ }
      }
    }
  });

  socket.on("disconnect", async () => {
    const userId = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);
    console.log("User disconnected:", socket.id);

    if (userId) {
      // Only mark offline if no other sockets remain for this user
      const stillOnline = [...onlineUsers.values()].includes(userId);
      if (!stillOnline) {
        try {
          const User = (await import("./src/modules/users/user.model.js")).default;
          await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() });
        } catch (e) { /* swallow */ }
        io.emit("user-offline", userId);
      }
    }
  });
});

// Initialize server
const startServer = async () => {
  try {
    // Run connections in parallel to speed up startup
    await Promise.all([connectDB(), connectRedis()]);

    server.listen(config.port, "0.0.0.0", () => {

      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
