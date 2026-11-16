import { registerUserService } from "../services/auth.service.js";

export const registerUserController = async (req, res, next) => {
  try {
    const user = await registerUserService(req.validatedBody);
    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};
