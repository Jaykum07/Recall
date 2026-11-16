import { loginUserService, registerUserService } from "../services/auth.service.js";

export const loginUserController = async (req, res, next) => {
  try {
    const user = await loginUserService(req.validatedBody);
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

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
