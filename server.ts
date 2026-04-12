import http from "http";
import { Server } from "socket.io";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { connectRedis } from "./src/config/redis.js";
import config from "./src/config/env.config.js";

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.io
export const io = new Server(server, {
  cors: {
    origin: [config.cors.clientUrl, "http://localhost:8080", "http://127.0.0.1:5173", "http://127.0.0.1:8080"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ['websocket', 'polling']
});

console.log("Socket.io initialized and waiting for connections...");



// Socket Events
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageRecieved) => {
    const chat = newMessageRecieved.chatId;

    if (!chat || !chat.participants)
      return console.log("chat.participants not defined");

    // Emit to the entire chat room
    const chatId = chat._id ? chat._id.toString() : chat.toString();
    io.to(chatId).emit("message recieved", newMessageRecieved);

    // Also emit to each participant's individual room for notifications
    chat.participants.forEach((user: any) => {
      const participantId = user._id ? user._id.toString() : user.toString();
      const senderId = newMessageRecieved.senderId._id
        ? newMessageRecieved.senderId._id.toString()
        : newMessageRecieved.senderId.toString();

      if (participantId === senderId) return;
      io.to(participantId).emit("message recieved", newMessageRecieved);
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Initialize server
const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

    server.listen(config.port, "0.0.0.0", () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
