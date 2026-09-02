import express from "express";

const app = express();

const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};

app.use(express.json());

app.use(logger);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Recall API is running",
  });
});

app.post("/api/test", (req, res) => {
    console.log(req.body);
    res.json(req.body);
})

export default app;
