import { z } from "zod";

const updateProblemSchema = z.object({
  userLearningInfo: z
    .object({
      confidence: z.number().min(0).max(5).optional(),
      whatILearned: z.string().optional(),
      whatIStruggledWith: z.string().optional(),
      mistake: z.string().optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0),
});

export const validateUpdateProblem = (req, res, next) => {

  const result = updateProblemSchema.safeParse(req.body);

  if (!result.success) {
    const err = new Error("Invalid data");
    err.statusCode = 400;
    return next(err);
  }

  next();
};