export const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const errors = err.errors || null;

  if(err.name === "ValidationError"){
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
  
};
