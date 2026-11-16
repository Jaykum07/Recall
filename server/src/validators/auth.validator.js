import { z } from "zod";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(12).refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    { message: "Password must not exceed 72 UTF-8 bytes" },
  ),
}).strict();

const loginSchema = registrationSchema.pick({ email: true, password: true });

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const err = new Error("Validation failed");
    err.statusCode = 400;
    err.errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return next(err);
  }

  req.validatedBody = result.data;
  next();
};

export const validateRegistration = validateBody(registrationSchema);
export const validateLogin = validateBody(loginSchema);
