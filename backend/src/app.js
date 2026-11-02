import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config/env.js";
import errorHandler from "./middleware/errorHandler.js";
import { apiRateLimiter, redirectRateLimiter } from "./middleware/rateLimiters.js";
import { redirectToUrl } from "./controllers/redirectController.js";
import authRoutes from "./routes/authRoutes.js";
import urlRoutes from "./routes/urlRoutes.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use("/api", apiRateLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/urls", urlRoutes);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/:code", redirectRateLimiter, redirectToUrl);

app.use((_request, response) => {
  response.status(404).json({ error: "Route not found." });
});

app.use(errorHandler);

export default app;
