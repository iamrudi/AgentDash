import { randomBytes } from 'crypto';

interface PrintToken {
  proposalId: string;
  userId: string;
  agencyId: string;
  role: string;
  expiresAt: number;
  used: boolean;
}

const printTokens = new Map<string, PrintToken>();

const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of Array.from(printTokens.entries())) {
    if (data.expiresAt < now || data.used) {
      printTokens.delete(token);
    }
  }
}, CLEANUP_INTERVAL_MS);

export function generatePrintToken(
  proposalId: string,
  userId: string,
  agencyId: string,
  role: string
): string {
  const token = randomBytes(32).toString('hex');
  
  printTokens.set(token, {
    proposalId,
    userId,
    agencyId,
    role,
    expiresAt: Date.now() + TOKEN_EXPIRY_MS,
    used: false,
  });
  
  return token;
}

export function validatePrintToken(token: string, proposalId: string): PrintToken | null {
  const data = printTokens.get(token);
  
  if (!data) {
    return null;
  }
  
  if (data.used) {
    return null;
  }
  
  if (data.expiresAt < Date.now()) {
    printTokens.delete(token);
    return null;
  }
  
  if (data.proposalId !== proposalId) {
    return null;
  }
  
  data.used = true;
  
  return data;
}
