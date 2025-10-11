import jwt from "jsonwebtoken";

// Use JWT_SECRET if available, otherwise fall back to SESSION_SECRET
// NOTE: In production, JWT_SECRET should be different from SESSION_SECRET for security
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET or SESSION_SECRET environment variable must be set. This is required for secure authentication.");
}

// Type assertion after validation
const SECRET: string = JWT_SECRET;

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, SECRET) as JWTPayload;
}
