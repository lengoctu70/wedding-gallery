import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

import { decodeBase64, decodeBase64url, encodeBase64, encodeBase64url } from "@oslojs/encoding";
import { type GoogleAuth } from "google-auth-library";
import { type JSONClient } from "google-auth-library/build/src/auth/googleauth";
import { type drive_v3, google } from "googleapis";
import "server-only";

import { Schema_ServiceAccount } from "~/types/schema";

class EncryptionService {
  private key: Buffer;
  private readonly SALT = "wedding-gallery-v2";

  constructor() {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error("ENCRYPTION_KEY is required in the environment variables.");
    }
    // Derive 32-byte key using scrypt (more secure than SHA-256)
    this.key = scryptSync(process.env.ENCRYPTION_KEY, this.SALT, 32);
  }

  /**
   * Encrypts data using AES-256-GCM with Node.js native crypto
   * Returns base64url-encoded string (URL-safe, compact)
   * Format: base64url(iv[12 bytes] + authTag[16 bytes] + ciphertext)
   */
  encrypt(data: string, forceKey?: string): string {
    try {
      const key = forceKey ? scryptSync(forceKey, this.SALT, 32) : this.key;
      const iv = randomBytes(12); // GCM standard IV size

      const cipher = createCipheriv("aes-256-gcm", key, iv);

      let encrypted = cipher.update(data, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      // Combine: IV (12) + Auth Tag (16) + Ciphertext
      const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "hex")]);

      return combined.toString("base64url");
    } catch (error) {
      const e = error as Error;
      console.error(`[EncryptionService.encrypt] ${e.message}`);
      throw new Error(`[EncryptionService.encrypt] ${e.message}`);
    }
  }

  /**
   * Decrypts base64url-encoded data encrypted with AES-256-GCM
   * Expects format: base64url(iv[12 bytes] + authTag[16 bytes] + ciphertext)
   */
  decrypt(encoded: string, forceKey?: string): string {
    try {
      const key = forceKey ? scryptSync(forceKey, this.SALT, 32) : this.key;
      const combined = Buffer.from(encoded, "base64url");

      // Extract components
      const iv = combined.slice(0, 12);
      const authTag = combined.slice(12, 28); // 16 bytes
      const encryptedHex = combined.slice(28).toString("hex");

      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      const e = error as Error;
      console.error(`[EncryptionService.decrypt] ${e.message}`);
      throw new Error(`[EncryptionService.decrypt] ${e.message}`);
    }
  }
}

type B64Type = "url" | "standard";
export const base64Encode = (text: string, type: B64Type = "url") => {
  const data = new TextEncoder().encode(text);
  if (type === "standard") return encodeBase64(data);
  return encodeBase64url(data);
};
export const base64Decode = <T = unknown>(encoded: string, type: B64Type = "url"): T | null => {
  try {
    let decoded: Uint8Array<ArrayBufferLike>;
    if (type === "standard") decoded = decodeBase64(encoded);
    else decoded = decodeBase64url(encoded);
    return new TextDecoder().decode(decoded) as T;
  } catch (error) {
    const e = error as Error;
    console.error(`[base64Decode] ${e.message}`);
    return null;
  }
};

class GoogleDriveService {
  private auth: GoogleAuth<JSONClient>;
  public gdrive: drive_v3.Drive;
  public gdriveNoCache: drive_v3.Drive;

  constructor() {
    const decodedB64 = base64Decode<string>(process.env.GD_SERVICE_B64!);
    if (!decodedB64) throw new Error("Failed to decode GD_SERVICE_B64");
    const parsedAuth = Schema_ServiceAccount.safeParse(JSON.parse(decodedB64));
    if (!parsedAuth.success) throw new Error("Failed to parse service account");

    this.auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        private_key: parsedAuth.data.private_key,
        client_email: parsedAuth.data.client_email,
        client_id: parsedAuth.data.client_id,
      },
      projectId: parsedAuth.data.project_id,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    if (!this.auth) throw new Error("Failed to initialize Google Auth");
    this.gdrive = google.drive({
      version: "v3",
      auth: this.auth,
    });
    this.gdriveNoCache = google.drive({
      version: "v3",
      auth: this.auth,
      fetchImplementation: (url, init) =>
        fetch(url as string | URL, {
          ...init,
          cache: "no-store",
        }),
    });
  }
}

export const { gdrive, gdriveNoCache } = new GoogleDriveService();
export const encryptionService = new EncryptionService();
