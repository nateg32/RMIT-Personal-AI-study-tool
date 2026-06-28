import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { isProductionRuntime, requireEnv } from "@/lib/env";

const algorithm = "aes-256-gcm";

function getKey() {
  const raw = requireEnv("ENCRYPTION_KEY");
  const maybeBase64 = Buffer.from(raw, "base64");
  if (maybeBase64.length === 32) return maybeBase64;

  if (isProductionRuntime()) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte base64 value in production.");
  }

  throw new Error("ENCRYPTION_KEY must be generated with 32 random bytes and encoded as base64.");
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
