import http from "http";
import { Server } from "socket.io";
import app from "./src/app.js"; // Notice .js extensions for ESNext
import connectDB from "./src/config/db.js";
import { connectRedis } from "./src/config/redis.js";
const PORT = process.env.PORT || 5000;
// Create HTTP server
const server = http.createServer(app);
// Setup Socket.io
export const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});
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
    let chat = newMessageRecieved.chatId;
    if (!chat || !chat.participants)
      return console.log("chat.participants not defined");
    chat.participants.forEach((user) => {
      if (user._id === newMessageRecieved.senderId._id) return;
      socket.in(user._id).emit("message recieved", newMessageRecieved);
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
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};
startServer();
