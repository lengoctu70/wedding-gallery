---
title: "AES-256-GCM Encryption Migration"
description: "Replace Web Crypto API with optimized Node.js native crypto using Base64url encoding"
status: pending
priority: P1
effort: 3h
branch: main
tags: [encryption, security, performance, migration]
created: 2025-12-31
---

# AES-256-GCM Encryption Migration Plan

## Overview

Replace current Web Crypto API encryption with Node.js native crypto. Clean migration (no backward compatibility) per user request.

## Problem Statement

Current error: `[EncryptionService.decrypt] The operation failed for an operation-specific reason`

**Root Cause:** Missing explicit `tagLength` in AES-GCM algorithm config causes auth tag validation failure.

## Goals

| Metric | Current | Target |
|--------|---------|--------|
| Output size | ~200 chars | ~60 chars |
| Performance | ~5ms | ~0.5ms |
| Encoding | Hex + delimiter | Base64url |
| API | Web Crypto | Node.js native |

## Scope

**13 files** require updates:
- 1 core service: `src/lib/utils.server.ts`
- 6 actions: `files.ts`, `configuration.ts`, `token.ts`, `search.ts`, `paths.ts`, `password.ts`
- 6 API routes: `preview`, `download`, `thumb`, `og`, `raw`, `internal/*`

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 01 | Core encryption service replacement | 45min |
| 02 | Actions update (6 files) | 45min |
| 03 | API routes update (6 files) | 45min |
| 04 | Testing and validation | 45min |

## Key Decisions

1. **Clean migration**: No backward compat code (user confirmed)
2. **Scrypt KDF**: Use `scryptSync` with fixed salt for key derivation
3. **Base64url**: URL-safe encoding without padding
4. **Fixed IV position**: `iv(12) + authTag(16) + ciphertext`

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing configs break | High | User re-generates config |
| Key derivation change | High | Document in CHANGELOG |
| Deployment issues | Medium | Test locally first |

## Success Criteria

- [ ] Encryption/decryption works without errors
- [ ] Output is Base64url encoded (~60 chars for folder IDs)
- [ ] All API routes function correctly
- [ ] Example folder ID encrypts/decrypts successfully

## Phase Details

See detailed phase files:
- `phase-01-core-service.md`
- `phase-02-actions-update.md`
- `phase-03-api-routes.md`
- `phase-04-testing.md`
