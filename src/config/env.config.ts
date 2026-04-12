import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  
  MONGO_URI: z.string().min(1, "MONGO_URI is required").url(),
  
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters"),

  JWT_EXPIRE: z.string().default('7d'),
  
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional().default(''),
  
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  
  SMTP_HOST: z.string().default('smtp-relay.brevo.com'),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),
  EMAIL_FROM: z.string().default('Wassup App <noreply@wassup.app>'),
});


const envFound = envSchema.safeParse(process.env);

if (!envFound.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(envFound.error.format(), null, 2));
  process.exit(1);
}

const env = envFound.data;

const config = {
    env: env.NODE_ENV,
    port: env.PORT,
    
    mongo: {
        uri: env.MONGO_URI,
    },
    
    jwt: {
        secret: env.JWT_SECRET,
        expiresIn: env.JWT_EXPIRE,
    },
    
    redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
    },
    
    cloudinary: {
        cloudName: env.CLOUDINARY_CLOUD_NAME,
        apiKey: env.CLOUDINARY_API_KEY,
        apiSecret: env.CLOUDINARY_API_SECRET,
    },
    
    cors: {
        clientUrl: env.CLIENT_URL,
    },
    
    smtp: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.EMAIL_FROM,
    }
};

export default config;

