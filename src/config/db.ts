import mongoose from 'mongoose';
import config from './env.config.js';

const connectDB = async () => {
    try {
        await mongoose.connect(config.mongo.uri);
        console.log('MongoDB Connected Successfully!');
    } catch (error) {
        console.error('MongoDB Connection Error: ', error);
        process.exit(1);
    }
};

export default connectDB;
