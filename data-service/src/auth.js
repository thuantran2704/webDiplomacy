// Bearer token auth middleware.
// Validates Authorization: Bearer <DATA_API_KEY> on every request.

const KEY = process.env.DATA_API_KEY;

if (!KEY) {
  console.error("[auth] DATA_API_KEY is not set — all requests will be rejected.");
}

export function requireAuth(req, res, next) {
  const header = req.headers["authorization"] ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token || token !== KEY) {
    return res.status(401).json({ error: "Missing or invalid token", code: "UNAUTHORIZED" });
  }
  next();
}
