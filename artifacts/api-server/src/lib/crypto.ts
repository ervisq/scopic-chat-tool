import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

const LEGACY_SALT = "salt";
const LEGACY_SECRET = "dev-secret-change-in-production";

function getEncryptionSecret(): string {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY environment variable is required");
  }
  return secret;
}

function getEncryptionSalt(): Buffer {
  const saltHex = process.env.ENCRYPTION_SALT;
  if (!saltHex) {
    throw new Error("ENCRYPTION_SALT environment variable is required");
  }
  return Buffer.from(saltHex, "hex");
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
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    const legacyKey = deriveKey(LEGACY_SECRET, LEGACY_SALT);
    const decipher = crypto.createDecipheriv(ALGORITHM, legacyKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
}

export function reEncrypt(ciphertext: string): string | null {
  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) return null;

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];

    const legacyKey = deriveKey(LEGACY_SECRET, LEGACY_SALT);
    const decipher = crypto.createDecipheriv(ALGORITHM, legacyKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return encrypt(decrypted);
  } catch {
    return null;
  }
}
