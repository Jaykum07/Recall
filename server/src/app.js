import express from "express";
import healthRouter from "./routes/health.routes.js";
import problemRouter from "./routes/problem.routes.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import authRouter from "./routes/auth.routes.js";

const app = express();

const logger = (req, res, next) => {
  // Query strings may contain credentials; log only the request path.
  console.log(`${req.method} ${req.path}`);
  next();
};

app.use(express.json());

app.use(logger);
app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/problems", problemRouter);

app.use("/api", (req, res, next) => {
  const error = new Error("Route not found");
  error.statusCode = 404;
  next(error);
});

app.use(errorMiddleware);

export default app;
