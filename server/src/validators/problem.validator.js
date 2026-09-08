export const validateUpdateProblem = (req, res, next) => {
    const data = req.body;
  
    if (Object.keys(data).length === 0) {
      const err = new Error("Provide update data");
      err.statusCode = 400;
      return next(err);
    }
  
    if (data?.userLearningInfo?.confidence === undefined) {
      const err = new Error("Confidence is required");
      err.statusCode = 400;
      return next(err);
    }
  
    const { confidence } = data.userLearningInfo;
  
    if (typeof confidence !== "number") {
      const err = new Error("Confidence must be a number");
      err.statusCode = 400;
      return next(err);
    }
  
    if (confidence < 0 || confidence > 5) {
      const err = new Error("Confidence must be between 0 and 5");
      err.statusCode = 400;
      return next(err);
    }
  
    next();
};