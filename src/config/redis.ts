import { createClient } from 'redis';
import config from './env.config.js';

const redisClient = createClient({
    password: config.redis.password,
    socket: {
        host: config.redis.host,
        port: config.redis.port,
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error('Redis max retries reached. Stopping reconnection attempts.');
                return new Error('Redis max retries reached');
            }
            return Math.min(retries * 100, 3000); // Backoff strategy
        }
    }
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err.message));
redisClient.on('connect', () => console.log('Redis connected...'));
redisClient.on('ready', () => console.log('Redis Client Ready'));
redisClient.on('reconnecting', () => console.log('Redis reconnecting...'));

export const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    } catch (err: any) {
        console.error('Failed to connect to Redis initially:', err.message);
        // Note: We don't exit here to allow the app to start without Redis if it's optional,
        // but it will continue trying to reconnect in the background.
    }
}

export default redisClient;

