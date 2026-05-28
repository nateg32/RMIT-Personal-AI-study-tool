import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { requireEnv } from "@/lib/env";

const algorithm = "aes-256-gcm";

function getKey() {
  const raw = requireEnv("ENCRYPTION_KEY");
  const maybeBase64 = Buffer.from(raw, "base64");
  if (maybeBase64.length === 32) return maybeBase64;
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(input: {
  encrypted: string;
  iv: string;
  authTag: string;
}) {
  const decipher = createDecipheriv(
    algorithm,
    getKey(),
    Buffer.from(input.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(input.encrypted, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
