const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

const notFound = (req, res, next) =>
  next(new AppError(404, "NOT_FOUND", "Route not found"));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!(err instanceof AppError)) {
    if (err.type === "entity.parse.failed")
      error = new AppError(400, "INVALID_JSON", "Malformed JSON body");
    else if (err.type === "entity.too.large")
      error = new AppError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
    else {
      logger.error("http.unhandled_error", {
        method: req.method,
        path: req.path,
        error: err.message,
        stack: err.stack,
      });
      error = new AppError(500, "INTERNAL_ERROR", "Something went wrong");
    }
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    code: error.code,
    ...(error.details && { details: error.details }),
  });
};

module.exports = { notFound, errorHandler };
