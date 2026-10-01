export function notFound(req, res) {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || "Server error";

  if (err.name === "CastError") { status = 400; message = "Invalid id"; }
  if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(", ");
  }
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `That ${field} is already in use`;
  }
  if (status >= 500) console.error(err);

  res.status(status).json({
    message,
    ...(err.details ? { errors: err.details } : {}),
    ...(process.env.NODE_ENV !== "production" && status >= 500 ? { stack: err.stack } : {})
  });
}
