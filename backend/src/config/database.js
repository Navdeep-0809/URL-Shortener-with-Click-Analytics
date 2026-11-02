import mongoose from "mongoose";
import { config } from "./env.js";
import Click from "../models/Click.js";
import User from "../models/User.js";
import Url from "../models/Url.js";

export async function connectToDatabase() {
  await mongoose.connect(config.mongodbUri, {
    serverSelectionTimeoutMS: 10000
  });

  await Url.init();
  await User.init();
  await Click.init();
  console.log("Connected to MongoDB and verified application indexes.");
}

export async function disconnectFromDatabase() {
  await mongoose.disconnect();
}
