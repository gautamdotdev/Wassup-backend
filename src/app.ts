import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import config from './config/env.config.js';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());
app.use(morgan('dev'));

// CORS
const allowedOrigins = [config.cors.clientUrl, 'http://localhost:8080'];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Basic route #
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'API is running' });
});

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import chatRoutes from './modules/chats/chat.routes.js';
import messageRoutes from './modules/messages/message.routes.js';
import connectionRoutes from './modules/connections/connection.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import uploadRoutes from './modules/upload/upload.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);

export default app;
