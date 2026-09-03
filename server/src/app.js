import express from "express";
import healthRouter from "./routes/health.routes.js";
import problemRouter from "./routes/problem.routes.js";

const app = express();

const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};

app.use(express.json());

app.use(logger);
app.use("/api", healthRouter);
app.use("/api/problems", problemRouter);

app.post("/api/test", (req, res) => {
  console.log(req.body);
  res.json(req.body);
});

export default app;
