import crypto from 'crypto';

// Encryption key from environment variable
// CRITICAL: In production, this MUST be a 32-byte (256-bit) random key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// Validate and get encryption key - fails fast on startup if invalid
const getEncryptionKey = (): Buffer => {
  if (!ENCRYPTION_KEY) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required for OAuth token encryption. ' +
      'Generate a secure 32-byte key using: node -e "console.log(crypto.randomBytes(32).toString(\'base64\'))"'
    );
  }

  // Support both raw string (32 bytes) and base64-encoded keys
  let keyBuffer: Buffer;
  
  // Try base64 decoding first (recommended format)
  if (ENCRYPTION_KEY.length === 44 && ENCRYPTION_KEY.endsWith('=')) {
    keyBuffer = Buffer.from(ENCRYPTION_KEY, 'base64');
  } else {
    keyBuffer = Buffer.from(ENCRYPTION_KEY);
  }

  if (keyBuffer.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 bytes (256 bits). ` +
      `Current key is ${keyBuffer.length} bytes. ` +
      `Generate a secure key using: node -e "console.log(crypto.randomBytes(32).toString('base64'))"`
    );
  }

  return keyBuffer;
};

// Initialize and validate key on module load (fail fast)
let ENCRYPTION_KEY_BUFFER: Buffer;
try {
  ENCRYPTION_KEY_BUFFER = getEncryptionKey();
  console.log('✓ Encryption key validated successfully');
} catch (error) {
  console.error('✗ Encryption key validation failed:', error instanceof Error ? error.message : 'Unknown error');
  throw error;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts a string using AES-256-GCM
 * @param text - The plaintext to encrypt
 * @returns Object containing encrypted text, IV, and auth tag
 */
export function encrypt(text: string): EncryptedData {
  if (!text) {
    throw new Error('Cannot encrypt empty text');
  }

  // Generate a random initialization vector (IV)
  const iv = crypto.randomBytes(16);
  
  // Create cipher with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY_BUFFER, iv);
  
  // Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get the authentication tag
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypts AES-256-GCM encrypted data
 * @param encrypted - The encrypted text (hex string)
 * @param iv - The initialization vector (hex string)
 * @param authTag - The authentication tag (hex string)
 * @returns The decrypted plaintext
 */
export function decrypt(encrypted: string, iv: string, authTag: string): string {
  if (!encrypted || !iv || !authTag) {
    throw new Error('Encrypted data, IV, and auth tag are required for decryption');
  }

  try {
    // Create decipher with AES-256-GCM
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENCRYPTION_KEY_BUFFER,
      Buffer.from(iv, 'hex')
    );
    
    // Set the authentication tag
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    // Decrypt the text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Encrypts an OAuth token for storage
 * @param token - The OAuth token to encrypt
 * @returns Object with encrypted token, IV, and auth tag
 */
export function encryptToken(token: string): EncryptedData {
  return encrypt(token);
}

/**
 * Decrypts an OAuth token from storage
 * @param encrypted - The encrypted token
 * @param iv - The initialization vector
 * @param authTag - The authentication tag
 * @returns The decrypted OAuth token
 */
export function decryptToken(encrypted: string, iv: string, authTag: string): string {
  return decrypt(encrypted, iv, authTag);
}
