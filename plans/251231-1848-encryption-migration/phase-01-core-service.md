# Phase 01: Core Encryption Service Replacement

## Context Links

- Research report: `/docs/encryption-research-report.md`
- Analysis report: `/ENCRYPTION_ANALYSIS_REPORT.md`
- Implementation guide: `/docs/encryption-implementation-guide.md`
- Current service: `/src/lib/utils.server.ts` (lines 9-61)

## Overview

Replace `EncryptionService` class with Node.js native crypto implementation. Remove Web Crypto API dependency.

## Key Insights

1. **Root cause of current error**: Missing `tagLength: 128` in algorithm config
2. **Web Crypto limitation**: Auth tag appended to ciphertext without explicit separation
3. **Node.js native advantage**: Explicit `getAuthTag()` and `setAuthTag()` methods
4. **Performance gain**: Native crypto ~10x faster than Web Crypto polyfill

## Requirements

- Use `crypto.createCipheriv('aes-256-gcm', key, iv)`
- Derive key using `scryptSync(password, salt, 32)`
- Output format: `base64url(iv + authTag + ciphertext)`
- Remove `forceKey` parameter (unused in clean migration)

## Architecture

```
Input (plaintext)
    │
    ▼
┌─────────────────┐
│ scryptSync KDF  │ ← ENCRYPTION_KEY + fixed salt
└────────┬────────┘
         │ 32-byte derived key
         ▼
┌─────────────────┐
│ randomBytes(12) │ → IV (12 bytes)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ createCipheriv  │ → AES-256-GCM
│ cipher.update() │
│ cipher.final()  │
│ getAuthTag()    │ → 16 bytes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Buffer.concat   │ → [iv, authTag, ciphertext]
│ toString('b64u')│
└────────┬────────┘
         │
         ▼
Output (~60 chars Base64url)
```

## Related Code Files

| File | Purpose | Changes |
|------|---------|---------|
| `src/lib/utils.server.ts` | EncryptionService class | Full rewrite |

## Implementation Steps

### Step 1: Add Node.js crypto imports

```typescript
// Replace Web Crypto imports with:
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
```

### Step 2: Create new EncryptionService class

```typescript
class EncryptionService {
  private key: Buffer;
  private static readonly SALT = 'wedding-gallery-v2';

  constructor() {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY is required in the environment variables.');
    }
    // Derive key once at initialization
    this.key = scryptSync(process.env.ENCRYPTION_KEY, EncryptionService.SALT, 32);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Format: base64url(iv + authTag + ciphertext)
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64url');
  }

  decrypt(encoded: string): string {
    const combined = Buffer.from(encoded, 'base64url');

    // Extract components
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(12, 28);
    const ciphertext = combined.subarray(28);

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
```

### Step 3: Remove async/Promise signatures

Current methods are `async` but Node.js native crypto is synchronous. Change to sync methods:

```typescript
// Before
async encrypt(data: string, forceKey?: string): Promise<string>
async decrypt(hash: string, forceKey?: string): Promise<string>

// After
encrypt(plaintext: string): string
decrypt(encoded: string): string
```

### Step 4: Update export

```typescript
export const encryptionService = new EncryptionService();
```

## Todo List

- [ ] Backup current `utils.server.ts`
- [ ] Add Node.js crypto imports
- [ ] Rewrite EncryptionService class
- [ ] Remove `forceKey` parameter handling
- [ ] Remove delimiter constant
- [ ] Update method signatures (async → sync)
- [ ] Test encrypt/decrypt roundtrip locally

## Success Criteria

- [ ] `encryptionService.encrypt('test')` returns ~20 char Base64url string
- [ ] `encryptionService.decrypt(encrypted)` returns `'test'`
- [ ] No TypeScript errors
- [ ] Example folder ID `1rTymTXw2xXa8nm7FbN53yXSmEtvR0_UR` encrypts successfully

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Sync methods break async callers | High | High | Update all call sites in Phase 02-03 |
| Salt change breaks existing data | High | High | User regenerates config (clean migration) |
| scrypt performance on cold start | Low | Low | One-time cost, acceptable |

## Security Considerations

- **Salt**: Fixed salt `'wedding-gallery-v2'` is acceptable for this use case (not password hashing)
- **Key derivation**: scrypt provides resistance against brute-force
- **Auth tag**: 128-bit (16 bytes) provides strong authentication
- **IV uniqueness**: `randomBytes(12)` is cryptographically secure
- **No key logging**: Ensure key never appears in logs/errors

## Next Steps

After Phase 01 completes:
1. All `await encryptionService.encrypt/decrypt` calls will error (sync vs async mismatch)
2. Proceed to Phase 02 to update all action files
3. Update API routes in Phase 03
