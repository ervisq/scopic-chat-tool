import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

let cachedEncryptionKey: string | null = null;
let cachedSalt: Buffer | null = null;

function getEncryptionSecret(): string {
  if (cachedEncryptionKey) return cachedEncryptionKey;
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY environment variable is required");
  }
  cachedEncryptionKey = secret;
  return secret;
}

function getEncryptionSalt(): Buffer {
  if (cachedSalt) return cachedSalt;
  const saltHex = process.env.ENCRYPTION_SALT;
  if (!saltHex) {
    throw new Error("ENCRYPTION_SALT environment variable is required");
  }
  if (!/^[0-9a-f]{32}$/i.test(saltHex)) {
    throw new Error("ENCRYPTION_SALT must be exactly 32 hex characters (16 bytes)");
  }
  cachedSalt = Buffer.from(saltHex, "hex");
  return cachedSalt;
}

function deriveKey(secret: string, salt: string | Buffer): Buffer {
  return crypto.scryptSync(secret, salt, KEY_LENGTH);
}

export function encrypt(plaintext: string): string {
  const key = deriveKey(getEncryptionSecret(), getEncryptionSalt());
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  const key = deriveKey(getEncryptionSecret(), getEncryptionSalt());
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
