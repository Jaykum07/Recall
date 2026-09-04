import dotenv from "dotenv";
dotenv.config();
import app from "./app.js";
import connectDB from "./config/database.js";

const PORT = process.env.PORT;

const startServer = async () => {
  try{
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  }catch(err){
    console.log("server startup fail");
  }
}

startServer();