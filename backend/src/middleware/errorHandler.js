export default function errorHandler(error, _request, response, _next) {
  if (error.type === "entity.parse.failed") {
    return response.status(400).json({ error: "Request body must contain valid JSON." });
  }

  if (error.name === "ValidationError" || error.name === "CastError") {
    return response.status(400).json({ error: "Request contains invalid data." });
  }

  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : Number.isInteger(error.status)
      ? error.status
      : 500;
  if (statusCode >= 500) {
    console.error("Request failed:", error);
    return response.status(statusCode).json({ error: "The request could not be completed." });
  }

  return response.status(statusCode).json({ error: error.message });
}
