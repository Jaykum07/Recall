import dns from "node:dns";
import mongoose from 'mongoose';

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = async () =>{
    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected successfully");
    }catch(err){
        console.log("MongoDB connection failed: ", err);
        throw err;
    }
};

export default connectDB;
