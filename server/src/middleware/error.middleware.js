export const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;

  if(err.name === "ValidationError"){
    statusCode = 400;
  }

  const malformedJson = err.type === "entity.parse.failed";
  const message = statusCode >= 500
    ? "Internal Server Error"
    : malformedJson ? "Invalid JSON body" : err.message || "Request failed";
  const errors = statusCode >= 500 || malformedJson ? null : err.errors || null;

  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
  
};
