import express from "express";
import { loginUserController, registerUserController } from "../controllers/auth.controller.js";
import { validateLogin, validateRegistration } from "../validators/auth.validator.js";
import { loginRateLimiter, registrationRateLimiter } from "../middleware/auth-rate-limit.middleware.js";

const router = express.Router();

router.post("/register", registrationRateLimiter, validateRegistration, registerUserController);
router.post("/login", loginRateLimiter, validateLogin, loginUserController);

export default router;
