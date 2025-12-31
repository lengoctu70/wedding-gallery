# Phase 03: API Routes Update

## Context Links

- Core service: `phase-01-core-service.md`
- Actions update: `phase-02-actions-update.md`
- Preview route: `/src/app/api/preview/[encryptedId]/route.ts`
- Download route: `/src/app/api/download/[...rest]/route.ts`
- Thumb route: `/src/app/api/thumb/[encryptedId]/route.ts`
- OG route: `/src/app/api/og/[encryptedId]/route.ts`
- Raw route: `/src/app/api/raw/[...rest]/route.ts`
- Encrypt route: `/src/app/api/internal/encrypt/route.ts`
- Check route: `/src/app/api/internal/check/route.ts`

## Overview

Update all API route files to use synchronous encryption methods. These routes handle file previews, downloads, thumbnails, and debugging endpoints.

## Key Insights

1. **7 API route files** use encryption service directly
2. **Pattern change**: `await encryptionService.decrypt(x)` → `encryptionService.decrypt(x)`
3. **Dynamic routes**: Most use `[encryptedId]` or `[...rest]` params containing encrypted data
4. **Internal routes**: `encrypt` and `check` routes are dev/debug only

## Requirements

- Remove `await` from all encryption/decryption calls
- Maintain error handling try/catch blocks
- Keep route functionality unchanged
- Update internal routes for testing

## Architecture

```
API Routes (7 total)
    │
    ├── /api/preview/[encryptedId]
    │   └── GET: Decrypt ID → stream file content
    │
    ├── /api/download/[...rest]
    │   └── GET: Decrypt webContentLink and fileId for download
    │
    ├── /api/thumb/[encryptedId]
    │   └── GET: Decrypt ID → fetch Google Drive thumbnail
    │
    ├── /api/og/[encryptedId]
    │   └── GET: Decrypt ID → fetch file for OpenGraph image
    │
    ├── /api/raw/[...rest]
    │   └── GET: Decrypt webContentLink → redirect to raw file
    │
    ├── /api/internal/encrypt
    │   └── GET: Test encryption roundtrip (dev only)
    │
    └── /api/internal/check
        └── GET: Decrypt config values (dev only)
```

## Related Code Files

| File | Decrypt Calls | Encrypt Calls | Notes |
|------|---------------|---------------|-------|
| `preview/[encryptedId]/route.ts` | 1 (line 42) | 0 | Main streaming |
| `download/[...rest]/route.ts` | 2 (lines 87, 100) | 0 | File download |
| `thumb/[encryptedId]/route.ts` | 1 (line 33) | 0 | Thumbnail proxy |
| `og/[encryptedId]/route.ts` | 1 (line 19) | 0 | OG image |
| `raw/[...rest]/route.ts` | 1 (line 50) | 0 | Raw redirect |
| `internal/encrypt/route.ts` | 1 (line 19) | 1 (line 18) | Test endpoint |
| `internal/check/route.ts` | 2 (lines 15, 17) | 0 | Debug endpoint |

## Implementation Steps

### Step 1: Update `/api/preview/[encryptedId]/route.ts`

**Line 42**:
```typescript
// Before
const decryptedId = await encryptionService.decrypt(encryptedId);

// After
const decryptedId = encryptionService.decrypt(encryptedId);
```

### Step 2: Update `/api/download/[...rest]/route.ts`

**Line 87**:
```typescript
// Before
const decryptedContentUrl = await encryptionService.decrypt(file.data.encryptedWebContentLink);

// After
const decryptedContentUrl = encryptionService.decrypt(file.data.encryptedWebContentLink);
```

**Line 100**:
```typescript
// Before
fileId: await encryptionService.decrypt(file.data.encryptedId),

// After
fileId: encryptionService.decrypt(file.data.encryptedId),
```

### Step 3: Update `/api/thumb/[encryptedId]/route.ts`

**Line 33**:
```typescript
// Before
const decryptedId = await encryptionService.decrypt(encryptedId);

// After
const decryptedId = encryptionService.decrypt(encryptedId);
```

### Step 4: Update `/api/og/[encryptedId]/route.ts`

**Line 19**:
```typescript
// Before
const decryptedId = await encryptionService.decrypt(encryptedId);

// After
const decryptedId = encryptionService.decrypt(encryptedId);
```

### Step 5: Update `/api/raw/[...rest]/route.ts`

**Line 50**:
```typescript
// Before
const decryptedLink = await encryptionService.decrypt(fileMeta.data.encryptedWebContentLink);

// After
const decryptedLink = encryptionService.decrypt(fileMeta.data.encryptedWebContentLink);
```

### Step 6: Update `/api/internal/encrypt/route.ts`

**Lines 18-19** (also update for removed forceKey):
```typescript
// Before
const encrypted = await encryptionService.encrypt(query, key ?? undefined);
const decrypted = await encryptionService.decrypt(encrypted, key ?? undefined);

// After - Note: forceKey no longer supported
// Option A: Remove key param support (simpler)
const encrypted = encryptionService.encrypt(query);
const decrypted = encryptionService.decrypt(encrypted);

// Option B: Use encryptWithKey helper (keeps test flexibility)
import { encryptWithKey, decryptWithKey } from '~/lib/utils.server';
const encrypted = key ? encryptWithKey(query, key) : encryptionService.encrypt(query);
const decrypted = key ? decryptWithKey(encrypted, key) : encryptionService.decrypt(encrypted);
```

**Recommendation**: Use Option A for simplicity since this is dev-only endpoint.

Also update response (lines 21-28):
```typescript
return NextResponse.json(
  {
    message: "Encrypted with environment key",
    encryptedValue: encrypted,
    decryptedValue: decrypted,
    // Remove key from response for security
  },
  { status: 200 },
);
```

### Step 7: Update `/api/internal/check/route.ts`

**Lines 15-17**:
```typescript
// Before
const rootId = await encryptionService.decrypt(config.apiConfig.rootFolder);
const sharedDriveId = config.apiConfig.sharedDrive
  ? await encryptionService.decrypt(config.apiConfig.sharedDrive)
  : undefined;

// After
const rootId = encryptionService.decrypt(config.apiConfig.rootFolder);
const sharedDriveId = config.apiConfig.sharedDrive
  ? encryptionService.decrypt(config.apiConfig.sharedDrive)
  : undefined;
```

## Todo List

- [ ] Update `preview/[encryptedId]/route.ts` - 1 change
- [ ] Update `download/[...rest]/route.ts` - 2 changes
- [ ] Update `thumb/[encryptedId]/route.ts` - 1 change
- [ ] Update `og/[encryptedId]/route.ts` - 1 change
- [ ] Update `raw/[...rest]/route.ts` - 1 change
- [ ] Update `internal/encrypt/route.ts` - 2 changes + simplify
- [ ] Update `internal/check/route.ts` - 2 changes

## Success Criteria

- [ ] All API routes compile without errors
- [ ] No `await encryptionService.` patterns remain in routes
- [ ] `/api/internal/encrypt?q=test` returns valid response
- [ ] Build succeeds: `npm run build`

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Missing await removal | Low | Medium | Limited files to check |
| encrypt route key param | Medium | Low | Dev-only, can simplify |
| Error handling breaks | Low | Medium | Try/catch remains intact |

## Security Considerations

- Remove encryption key from `/api/internal/encrypt` response
- Ensure dev-only routes remain protected by `NODE_ENV` check
- No exposure of decrypted values in error messages

## Next Steps

After Phase 03 completes:
1. Full codebase compiles without errors
2. Proceed to Phase 04 for integration testing
3. Test with actual encrypted folder IDs
