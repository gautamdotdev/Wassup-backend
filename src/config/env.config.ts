import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config();

const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5000', 10),
    
    mongo: {
        uri: process.env.MONGO_URI || '',
    },
    
    jwt: {
        secret: process.env.JWT_SECRET || 'fallback_secret',
        expiresIn: process.env.JWT_EXPIRE || process.env.JWT_EXPIRES_IN || '7d',
    },
    
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || '',
    },
    
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
        apiKey: process.env.CLOUDINARY_API_KEY || '',
        apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    },
    
    cors: {
        clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
    },
    
    smtp: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
    }
};

export default config;
