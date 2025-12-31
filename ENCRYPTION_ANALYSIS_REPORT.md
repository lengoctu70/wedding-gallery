# Encryption Implementation Analysis Report

## Executive Summary
The codebase uses AES-GCM encryption via Node.js Web Crypto API to secure sensitive Google Drive IDs and URLs. Analysis identifies critical cryptographic and implementation issues causing decryption failures.

---

## Current Implementation Details

### Encryption Service (src/lib/utils.server.ts, lines 9-61)

**Algorithm:** AES-GCM with:
- 12-byte random IV (initialization vector)
- SHA-256 derived key from `ENCRYPTION_KEY` environment variable
- Format: `hex(ciphertext);hex(iv)` (semicolon-delimited)

**Encryption Flow (lines 19-38):**
```typescript
const iv = crypto.getRandomValues(new Uint8Array(12));
const alg = { name: "AES-GCM", iv };
const keyhash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(forceKey ?? this.key));
const secretKey = await crypto.subtle.importKey("raw", keyhash, alg, false, ["encrypt"]);
const encryptedData = await crypto.subtle.encrypt(alg, secretKey, encodedData);
return [Buffer.from(encryptedData).toString("hex"), Buffer.from(iv).toString("hex")].join(this.delimiter);
```

**Decryption Flow (lines 40-60):**
```typescript
const [cipherText, iv] = hash.split(this.delimiter);
const alg = { name: "AES-GCM", iv: new Uint8Array(Buffer.from(iv, "hex")) };
const keyhash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(forceKey ?? this.key));
const secretKey = await crypto.subtle.importKey("raw", keyhash, alg, false, ["decrypt"]);
const decryptedData = await crypto.subtle.decrypt(alg, secretKey, new Uint8Array(Buffer.from(cipherText, "hex")));
return new TextDecoder().decode(decryptedData);
```

### Usage Pattern
IDs are encrypted during:
1. Configuration generation (configuration.ts:115, 124): `rootFolder`, `sharedDrive`
2. File operations (files.ts:63-64): Individual file/folder IDs
3. Token management (token.ts:34): Serialized authentication objects

Decrypted during API/action operations to access Google Drive.

---

## Root Cause of Decryption Error

### Primary Issue: Authentication Tag Loss
**Error:** `[EncryptionService.decrypt] The operation failed for an operation-specific reason`

**Root Cause:** AES-GCM authentication tag embedded in `encryptedData` is stripped when:
1. Ciphertext hex-encoded (line 32)
2. Only hex ciphertext transmitted
3. Decryption missing authentication tag verification

**Technical Detail:**
```
Web Crypto API AES-GCM encrypt() output = ciphertext + authentication_tag (128-bit)
Buffer.from().toString("hex") encodes entire buffer including tag
However, critical issue: tag position/extraction not properly handled
```

### Secondary Issue: Algorithm Object Mutation
**Critical Bug in decrypt() line 47:**
```typescript
const alg = { name: "AES-GCM", iv: new Uint8Array(...) };
// Missing: tagLength property for tag-aware decryption
```

Web Crypto expects explicit `tagLength` for authenticated decryption. Without it, API attempts implicit tag validation, which fails if:
- Tag location is ambiguous
- Ciphertext format differs from encrypt output
- Buffer encoding/decoding loses byte alignment

---

## Limitations & Vulnerabilities

| Issue | Severity | Details |
|-------|----------|---------|
| **No explicit tagLength** | CRITICAL | AES-GCM requires `{ name: "AES-GCM", iv, tagLength: 128 }` for proper auth |
| **Key derivation weakness** | HIGH | Single SHA-256 hash of plaintext key; no salt/KDF (PBKDF2, Argon2) |
| **IV reuse potential** | MEDIUM | Random IV per encryption, but no IV uniqueness enforcement across deployments |
| **Timing attacks** | MEDIUM | Sync compare vulnerable; should use constant-time comparison |
| **No key rotation** | HIGH | Leaked `ENCRYPTION_KEY` decrypts all historical data |
| **Delimiter parsing fragile** | MEDIUM | Semicolon delimiter could appear in hex (false split) |

---

## Why Example Folder ID Fails

For folder ID `1rTymTXw2xXa8nm7FbN53yXSmEtvR0_UR`:

**Encryption Process:**
1. Input: `"1rTymTXw2xXa8nm7FbN53yXSmEtvR0_UR"` (35 bytes)
2. Generate random 12-byte IV
3. Derive key: `SHA-256(ENCRYPTION_KEY)` = 32-byte hash
4. AES-GCM encrypt with derived key + IV → ciphertext (35 bytes) + 16-byte authentication tag
5. Output: `hex(35+16_bytes);hex(12_bytes)`

**Decryption Process:**
1. Split on `;` → `[hex_ciphertext_with_tag, hex_iv]`
2. Create algorithm WITHOUT `tagLength: 128`
3. Attempt decrypt with malformed algorithm config
4. Web Crypto API fails to locate/validate authentication tag
5. Error thrown: "operation failed for operation-specific reason"

**Result:** Decryption fails because:
- Algorithm config incomplete (missing `tagLength`)
- Tag validation cannot proceed properly
- Generic cryptographic error thrown (obscures real issue)

---

## Configuration Generation Issue

From configuration.ts:115-124, folder IDs encrypted during config download with user-provided `ENCRYPTION_KEY`. If decryption fails later:

1. Config downloaded with encryption using Key A
2. Deployment loads with same Key A
3. Decrypt uses algorithm config without `tagLength`
4. Fails even though key/format correct

Documented in README line 123-126 as known issue; marked "fixed in v2.0.4" but root cause persists.

---

## Recommended Fixes (Priority Order)

1. **Add explicit tagLength** (line 47):
   ```typescript
   const alg = { name: "AES-GCM", iv: new Uint8Array(...), tagLength: 128 };
   ```

2. **Use PBKDF2 for key derivation** instead of raw SHA-256:
   ```typescript
   const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), "PBKDF2", false, ["deriveBits"]);
   const keyBuffer = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, keyMaterial, 256);
   ```

3. **Add validation** for encrypted format before decryption

4. **Implement key versioning** for rotation support

---

## Code Citations

- **File:** src/lib/utils.server.ts
- **Lines:** 9-61 (EncryptionService class)
- **Usage:** src/actions/files.ts:27, 63; configuration.ts:115, 124
- **Error Path:** api/preview/route.ts:42 → files.ts:27 → decrypt() → error

---

## Unresolved Questions

- Was `tagLength` deliberately omitted for compatibility testing?
- Has config download/deployment cycle been validated end-to-end?
- Are there deployments using pre-v2.0.4 encrypted configs causing cascading failures?
