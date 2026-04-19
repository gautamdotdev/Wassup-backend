import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import config from "./config/env.config.js";
import { globalErrorHandler } from "./utils/errors.js";

const app = express();

app.set("trust proxy", 1);

// 1. Permissive CORS (Priority #1)
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "ngrok-skip-browser-warning",
    ],
    credentials: true,
  }),
);

// 2. Relaxed Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  }),
);

// Development logging
if (config.env === "development") {
  app.use(morgan("dev"));
}

// Rate Limiting (General)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // Limit each IP to 300 requests per `window` (here, per 15 minutes)
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again after 15 minutes",
});
app.use("/api", limiter);

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Basic route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "API is running", env: config.env });
});

// Routes
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import chatRoutes from "./modules/chats/chat.routes.js";
import messageRoutes from "./modules/messages/message.routes.js";
import connectionRoutes from "./modules/connections/connection.routes.js";
import notificationRoutes from "./modules/notifications/notification.routes.js";
import uploadRoutes from "./modules/upload/upload.routes.js";

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/upload", uploadRoutes);

// Global Error Handler
app.use(globalErrorHandler);

export default app;
