import mongoose from "mongoose";

const parserErrors = {
  "entity.parse.failed": [400, "Invalid JSON body"],
  "entity.too.large": [413, "Request body too large"],
  "charset.unsupported": [415, "Unsupported request charset"],
  "encoding.unsupported": [415, "Unsupported request encoding"],
  "request.size.invalid": [400, "Invalid request body"],
  "request.aborted": [400, "Invalid request body"],
};

const validationMessages = {
  required: "This field is required",
  enum: "Invalid option",
  minlength: "Value is too short",
  maxlength: "Value is too long",
  min: "Value is below the minimum",
  max: "Value exceeds the maximum",
};

// Only messages intentionally produced by our application are public.
const publicMessages = {
  400: ["Validation failed", "Invalid request body", "Bad Request", "No data provided for update"],
  401: ["Invalid email or password", "Authentication required"],
  404: ["Problem not found", "Route not found"],
  409: ["Email is already registered"],
};

const fallbackMessages = {
  400: "Bad Request", 401: "Authentication required", 403: "Forbidden",
  404: "Route not found", 409: "Conflict", 413: "Request body too large",
  415: "Unsupported request format", 429: "Too many requests",
};

export const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const validStatus = (status) => Number.isInteger(status) && status >= 400 && status <= 599;
  let statusCode = [err.statusCode, err.status].find(validStatus) ?? 500;
  let message = statusCode >= 500 ? "Internal Server Error"
    : publicMessages[statusCode]?.includes(err.message) ? err.message
      : fallbackMessages[statusCode] ?? "Request failed";
  let errors = null;

  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = "Validation failed";
    // Neither the parent message nor native field messages/values are serialized.
    errors = Object.values(err.errors).map((detail) => ({
      field: typeof detail.path === "string" ? detail.path : null,
      message: detail instanceof mongoose.Error.CastError ? "Invalid value type"
        : Object.hasOwn(validationMessages, detail.kind) ? validationMessages[detail.kind] : "Invalid value",
    }));
    if (errors.length === 0) errors = null;
  } else if (Object.hasOwn(parserErrors, err.type)) {
    [statusCode, message] = parserErrors[err.type];
  } else if (statusCode === 400 && message === "Validation failed" && Array.isArray(err.errors)) {
    errors = err.errors.filter((detail) => detail && typeof detail.message === "string")
      .map((detail) => ({ field: typeof detail.field === "string" ? detail.field : null, message: detail.message }));
    if (errors.length === 0) errors = null;
  }

  return res.status(statusCode).json({ success: false, message, errors });
};
