import express from "express";
import { registerUserController } from "../controllers/auth.controller.js";
import { validateRegistration } from "../validators/auth.validator.js";
import { registrationRateLimiter } from "../middleware/auth-rate-limit.middleware.js";

const router = express.Router();

router.post("/register", registrationRateLimiter, validateRegistration, registerUserController);

export default router;
