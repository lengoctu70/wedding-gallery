# Phase 02: Actions Update

## Context Links

- Core service: `phase-01-core-service.md`
- Files action: `/src/actions/files.ts`
- Configuration action: `/src/actions/configuration.ts`
- Token action: `/src/actions/token.ts`
- Search action: `/src/actions/search.ts`
- Paths action: `/src/actions/paths.ts`
- Password action: `/src/actions/password.ts`

## Overview

Update all action files to use synchronous encryption methods. Remove `await` keywords from all `encryptionService.encrypt()` and `encryptionService.decrypt()` calls.

## Key Insights

1. **6 action files** use encryption service
2. **Pattern change**: `await encryptionService.encrypt(x)` → `encryptionService.encrypt(x)`
3. **No async wrapping needed**: Methods are now synchronous
4. **forceKey removal**: `configuration.ts` uses `forceKey` parameter - must update

## Requirements

- Remove `await` from all encryption/decryption calls
- Update `configuration.ts` to not pass `forceKey` (service uses env key only)
- Ensure all file imports remain correct
- Maintain error handling patterns

## Architecture

```
Action Files (6 total)
    │
    ├── files.ts
    │   ├── ListFiles() - decrypt rootFolder, sharedDrive; encrypt file IDs
    │   ├── GetFile() - decrypt ID; encrypt ID and webContentLink
    │   ├── GetReadme() - decrypt rootFolder, sharedDrive
    │   ├── GetBanner() - decrypt rootFolder, sharedDrive; encrypt ID
    │   ├── GetContent() - decrypt ID
    │   └── GetSiblingsMedia() - decrypt parentId, sharedDrive; encrypt IDs
    │
    ├── configuration.ts
    │   └── GenerateConfiguration() - encrypt rootFolder, sharedDrive with forceKey
    │
    ├── token.ts
    │   ├── CreateFileToken() - encrypt token object
    │   └── ValidateFileToken() - decrypt token
    │
    ├── search.ts
    │   ├── SearchFiles() - decrypt sharedDrive; encrypt file IDs
    │   └── GetSearchResultPath() - decrypt ID
    │
    ├── paths.ts
    │   ├── GetFilePaths() - decrypt rootFolder
    │   └── ValidatePaths() - decrypt rootFolder, sharedDrive; encrypt IDs
    │
    └── password.ts
        ├── CheckIndexPassword() - decrypt password from cookie
        ├── SetIndexPassword() - encrypt password
        ├── CheckPagePassword() - decrypt rootFolder, sharedDrive, path IDs, folder password
        └── SetPagePassword() - encrypt password
```

## Related Code Files

| File | Encrypt Calls | Decrypt Calls | forceKey Usage |
|------|---------------|---------------|----------------|
| `files.ts` | 12 | 8 | No |
| `configuration.ts` | 2 | 0 | Yes (lines 115, 124) |
| `token.ts` | 1 | 1 | No |
| `search.ts` | 4 | 2 | No |
| `paths.ts` | 3 | 3 | No |
| `password.ts` | 2 | 4 | No |

## Implementation Steps

### Step 1: Update `files.ts`

**Line 27**: Change from async decrypt
```typescript
// Before
const decryptedId = await encryptionService.decrypt(id ?? config.apiConfig.rootFolder);

// After
const decryptedId = encryptionService.decrypt(id ?? config.apiConfig.rootFolder);
```

**Similar changes for**:
- Line 28-29: `decrypt(config.apiConfig.sharedDrive!)`
- Line 63-64: `encrypt(file.id!)`, `encrypt(file.webContentLink)`
- Lines 112-128: GetFile function
- Lines 178-180: GetReadme function
- Lines 306-308: GetBanner function
- Line 337: `encrypt(data.files[0]?.id)`
- Line 350: GetContent function
- Lines 392-394: GetSiblingsMedia function
- Lines 422-423: encrypt in loop

### Step 2: Update `configuration.ts`

**Critical change**: Remove `forceKey` parameter usage.

**Lines 115, 124**: User-provided encryption key for config generation
```typescript
// Before
value: await encryptionService.encrypt(values.api.rootFolder, values.environment.ENCRYPTION_KEY),
value: await encryptionService.encrypt(values.api.sharedDrive, values.environment.ENCRYPTION_KEY),

// After - IMPORTANT: Must use same key as deployment
// Option A: Temporarily set env var (complex)
// Option B: Create separate method accepting key (cleanest)
```

**Resolution**: Add a static helper method for config generation:

```typescript
// In utils.server.ts, add:
export function encryptWithKey(plaintext: string, encryptionKey: string): string {
  const key = scryptSync(encryptionKey, 'wedding-gallery-v2', 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}
```

Then in configuration.ts:
```typescript
// Before
value: await encryptionService.encrypt(values.api.rootFolder, values.environment.ENCRYPTION_KEY),

// After
import { encryptWithKey } from '~/lib/utils.server';
value: encryptWithKey(values.api.rootFolder, values.environment.ENCRYPTION_KEY),
```

### Step 3: Update `token.ts`

**Line 34**:
```typescript
// Before
const token = await encryptionService.encrypt(JSON.stringify(parsedTokenObject.data));

// After
const token = encryptionService.encrypt(JSON.stringify(parsedTokenObject.data));
```

**Line 50**:
```typescript
// Before
const decryptedToken = await encryptionService.decrypt(token);

// After
const decryptedToken = encryptionService.decrypt(token);
```

### Step 4: Update `search.ts`

**Lines 17, 45-46, 88**:
```typescript
// Remove await from all calls
encryptionService.decrypt(config.apiConfig.sharedDrive!)
encryptionService.encrypt(file.id!)
encryptionService.encrypt(file.webContentLink)
encryptionService.decrypt(id ?? config.apiConfig.rootFolder)
```

### Step 5: Update `paths.ts`

**Lines 16, 57-59, 149**:
```typescript
// Remove await from all calls
encryptionService.decrypt(config.apiConfig.rootFolder)
encryptionService.decrypt(config.apiConfig.sharedDrive!)
encryptionService.encrypt(item.data[0]?.id ?? '')
```

### Step 6: Update `password.ts`

**Lines 68, 95, 125-127, 134, 188, 229**:
```typescript
// Remove await from all decrypt/encrypt calls
encryptionService.decrypt(password)
encryptionService.encrypt(password)
encryptionService.decrypt(config.apiConfig.rootFolder)
encryptionService.decrypt(config.apiConfig.sharedDrive!)
encryptionService.decrypt(path.id)
encryptionService.decrypt(currentFolderPassword)
encryptionService.encrypt(password)
```

## Todo List

- [ ] Update `files.ts` - remove 20 `await` keywords
- [ ] Update `configuration.ts` - add `encryptWithKey` import, update 2 calls
- [ ] Update `token.ts` - remove 2 `await` keywords
- [ ] Update `search.ts` - remove 6 `await` keywords
- [ ] Update `paths.ts` - remove 6 `await` keywords
- [ ] Update `password.ts` - remove 8 `await` keywords
- [ ] Add `encryptWithKey` export to `utils.server.ts`

## Success Criteria

- [ ] No TypeScript errors in action files
- [ ] No `await encryptionService.` patterns remain
- [ ] `configuration.ts` uses `encryptWithKey` for user-provided key
- [ ] Build succeeds: `npm run build`

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Missing await removal | Medium | High | Search/replace with grep |
| Config gen uses wrong key | High | High | Use `encryptWithKey` helper |
| Type mismatches | Low | Medium | TypeScript will catch |

## Security Considerations

- `encryptWithKey` allows arbitrary key - only use for config generation
- Password encryption uses env key (correct behavior)
- No key exposure in error messages

## Next Steps

After Phase 02 completes:
1. API routes still reference old async methods
2. Proceed to Phase 03 for API route updates
3. Test full flow in Phase 04
