import mongoose from 'mongoose';
import config from './env.config.js';

const connectDB = async () => {
    try {
        const start = Date.now();
        console.log('Connecting to MongoDB...');
        
        await mongoose.connect(config.mongo.uri, {
            serverSelectionTimeoutMS: 5000, 
            socketTimeoutMS: 45000, 
            family: 4, // Force IPv4 to avoid slow DNS resolution of SRV records
        });


        const end = Date.now();
        console.log(`MongoDB Connected Successfully in ${(end - start) / 1000}s!`);
    } catch (error: any) {
        console.error('MongoDB Connection Error: ', error.message);
        process.exit(1);
    }
};


export default connectDB;
