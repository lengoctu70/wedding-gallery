# Phase 04: Testing and Validation

## Context Links

- Core service: `phase-01-core-service.md`
- Actions update: `phase-02-actions-update.md`
- API routes: `phase-03-api-routes.md`
- Example folder ID: `1rTymTXw2xXa8nm7FbN53yXSmEtvR0_UR`

## Overview

Validate the complete encryption migration through unit tests, integration tests, and manual verification.

## Key Insights

1. **Clean migration**: No legacy format to test
2. **Example data**: Use known folder ID for validation
3. **Config regeneration**: User must regenerate config after migration
4. **Output verification**: Check Base64url format (~60 chars)

## Requirements

- Verify encrypt/decrypt roundtrip works
- Validate output format is Base64url
- Test all API endpoints manually
- Ensure build succeeds without errors
- Document config regeneration steps

## Test Categories

### 1. Unit Tests

```typescript
// Test file: src/lib/__tests__/encryption.test.ts

import { encryptionService, encryptWithKey } from '../utils.server';

describe('EncryptionService', () => {
  const testCases = [
    'simple',
    '1rTymTXw2xXa8nm7FbN53yXSmEtvR0_UR', // Example folder ID
    'https://drive.google.com/uc?id=abc&export=download',
    JSON.stringify({ id: 'test', exp: Date.now() }),
    '', // Empty string edge case
  ];

  describe('encrypt', () => {
    it.each(testCases)('should encrypt "%s" to Base64url', (input) => {
      const encrypted = encryptionService.encrypt(input);
      // Base64url format: no +, /, or =
      expect(encrypted).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should produce different outputs for same input (random IV)', () => {
      const input = 'test';
      const encrypted1 = encryptionService.encrypt(input);
      const encrypted2 = encryptionService.encrypt(input);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should produce output ~60 chars for folder ID', () => {
      const folderId = '1rTymTXw2xXa8nm7FbN53yXSmEtvR0_UR';
      const encrypted = encryptionService.encrypt(folderId);
      // 35 char input → ~75 char output (iv:12 + tag:16 + cipher:35 = 63 bytes → ~84 base64)
      expect(encrypted.length).toBeLessThan(100);
      expect(encrypted.length).toBeGreaterThan(50);
    });
  });

  describe('decrypt', () => {
    it.each(testCases)('should decrypt back to "%s"', (input) => {
      const encrypted = encryptionService.encrypt(input);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(input);
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = encryptionService.encrypt('test');
      const tampered = encrypted.slice(0, -5) + 'XXXXX';
      expect(() => encryptionService.decrypt(tampered)).toThrow();
    });

    it('should throw on invalid Base64url', () => {
      expect(() => encryptionService.decrypt('not-valid-encrypted-data')).toThrow();
    });
  });

  describe('encryptWithKey', () => {
    it('should encrypt with custom key', () => {
      const customKey = 'my-custom-encryption-key';
      const encrypted = encryptWithKey('test', customKey);
      expect(encrypted).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should produce different result than default key', () => {
      const input = 'test';
      const withDefaultKey = encryptionService.encrypt(input);
      const withCustomKey = encryptWithKey(input, 'custom-key');
      expect(withDefaultKey).not.toBe(withCustomKey);
    });
  });
});
```

### 2. Build Verification

```bash
# Full build test
npm run build

# Type check only
npx tsc --noEmit

# Lint check
npm run lint
```

### 3. Manual API Testing

#### Test `/api/internal/encrypt`

```bash
# Start dev server
npm run dev

# Test encryption endpoint
curl "http://localhost:3000/api/internal/encrypt?q=1rTymTXw2xXa8nm7FbN53yXSmEtvR0_UR"

# Expected response:
# {
#   "message": "Encrypted with environment key",
#   "encryptedValue": "abc123...", # ~75 chars Base64url
#   "decryptedValue": "1rTymTXw2xXa8nm7FbN53yXSmEtvR0_UR"
# }
```

#### Test `/api/internal/check`

```bash
curl "http://localhost:3000/api/internal/check"

# Expected: Returns decrypted rootId and sharedDriveId
```

### 4. Integration Test Flow

```
1. Generate new config
   └── Visit /ngdi-internal/deploy
   └── Fill form with encryption key
   └── Download config.zip

2. Update .env and gIndex.config.ts

3. Test file listing
   └── Visit /
   └── Should show files from root folder

4. Test file preview
   └── Click on any file
   └── Should stream/display content

5. Test download
   └── Click download button
   └── File should download

6. Test password protection (if enabled)
   └── Enter password
   └── Verify access
```

## Todo List

- [ ] Create test file `src/lib/__tests__/encryption.test.ts`
- [ ] Run `npm run build` - verify no errors
- [ ] Run `npm run lint` - verify no lint errors
- [ ] Start dev server
- [ ] Test `/api/internal/encrypt?q=test`
- [ ] Verify output is Base64url format
- [ ] Test `/api/internal/check`
- [ ] Generate new config via deploy page
- [ ] Test full file browsing flow
- [ ] Test file preview
- [ ] Test file download
- [ ] Document config regeneration in CHANGELOG

## Success Criteria

- [ ] All unit tests pass
- [ ] Build succeeds without errors
- [ ] Lint passes without errors
- [ ] Encrypt endpoint returns Base64url output
- [ ] Check endpoint returns valid folder IDs
- [ ] File listing works with new encryption
- [ ] File preview streams correctly
- [ ] File download works

## Config Regeneration Steps (User Documentation)

After migration, users must regenerate their configuration:

1. **Navigate** to `/ngdi-internal/deploy` on your deployment
2. **Fill out** the configuration form
3. **Use the SAME** `ENCRYPTION_KEY` as before (or generate new)
4. **Download** the new config.zip
5. **Replace** `.env` and `gIndex.config.ts` in your deployment
6. **Redeploy** the application

**Note**: All encrypted values (rootFolder, sharedDrive) are regenerated with new format.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Test file location wrong | Low | Low | Use standard Jest path |
| Build fails | Low | High | Fix in Phases 01-03 |
| Config gen broken | Medium | High | Test deploy page manually |
| API endpoints fail | Low | Medium | Error handling preserved |

## Security Considerations

- Remove test file from production build if using test framework
- Do not expose encryption key in test logs
- Ensure `/api/internal/*` routes remain dev-only

## Post-Migration Checklist

After successful testing:

- [ ] Update README.md - document encryption changes
- [ ] Update CHANGELOG.md - note breaking change
- [ ] Remove old encryption research docs (optional)
- [ ] Consider adding migration script for automated deployments
- [ ] Monitor error logs post-deployment

## Unresolved Questions

1. Should we add a version marker to encrypted output for future migrations?
2. Is there a need for a one-time migration endpoint to re-encrypt existing configs?
3. Should we preserve the research reports or archive them?
