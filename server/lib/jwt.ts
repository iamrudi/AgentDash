import jwt from "jsonwebtoken";

// SECURITY: JWT_SECRET should be separate from SESSION_SECRET in production
// In production, JWT_SECRET MUST be set independently for security
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Strict validation: require JWT_SECRET in production
if (NODE_ENV === 'production' && !JWT_SECRET) {
  throw new Error(
    "PRODUCTION ERROR: JWT_SECRET environment variable must be set and must be different from SESSION_SECRET. " +
    "Generate a secure secret using: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
  );
}

// Development/test fallback with warning
const SECRET: string = JWT_SECRET || SESSION_SECRET || '';

if (!SECRET) {
  throw new Error(
    "JWT_SECRET or SESSION_SECRET environment variable must be set. " +
    "Generate a secure secret using: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
  );
}

// Warn if using fallback in development
if (!JWT_SECRET && SESSION_SECRET && NODE_ENV !== 'production') {
  console.warn(
    "⚠️  WARNING: Using SESSION_SECRET as JWT_SECRET fallback. " +
    "For production, set a separate JWT_SECRET environment variable."
  );
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  agencyId?: string; // For Admin/Staff users - provides tenant isolation
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, SECRET) as JWTPayload;
}
