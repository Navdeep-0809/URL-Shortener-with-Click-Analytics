import app from "./app.js";
import { config } from "./config/env.js";
import { connectToDatabase } from "./config/database.js";

async function startServer() {
  if (!config.mongodbUri) {
    throw new Error("MONGODB_URI is required. Set it in backend/.env before starting the API.");
  }
  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET is required. Set a private random value in backend/.env before starting the API.");
  }

  await connectToDatabase();
  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

startServer().catch((error) => {
  console.error(`Unable to start API: ${error.message}`);
  process.exitCode = 1;
});
