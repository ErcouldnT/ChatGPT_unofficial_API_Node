import process from "node:process";
import dotenv from "dotenv";

dotenv.config();

export function verifyApiKey(req, res, next) {
  // skip API key verification in development mode
  if (process.env.NODE_ENV === "development") {
    return next();
  }
  const clientKey = req.header("ERKUT-API-KEY");
  if (!clientKey || clientKey !== process.env.ERKUT_API_KEY) {
    return res.status(401).json({ error: "invalid api key" });
  }
  next();
}
