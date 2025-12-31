# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

next-gdrive-index is a Google Drive directory indexer built with Next.js 15, TypeScript, and shadcn/ui. It enables file browsing, previewing, and downloading from Google Drive with password protection, custom themes, and configurable access control.

## Common Commands

### Development
```bash
npm run dev          # Start dev server on port 3000
npm run dev:turbo    # Start dev server with Turbopack
npm run build        # Production build
npm start            # Start production server
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format with Prettier
npm run format:check # Check formatting
```

### Testing
- No test suite is currently configured
- Manual testing requires configured .env file (see Environment Setup)

## Environment Setup

Required environment variables (see `.env.example`):
- `GD_SERVICE_B64`: Base64-encoded Google service account JSON
- `ENCRYPTION_KEY`: Secret key for encrypting folder/file IDs
- `SITE_PASSWORD`: Password for private index mode (optional)
- `NEXT_PUBLIC_DOMAIN`: Domain without protocol (optional, for non-Vercel deployments)

Configuration is generated via the web-based configurator at `/ngdi-internal/configurator` or deploy guide at `/ngdi-internal/deploy`.

## Architecture

### App Router Structure
- **Next.js 15 App Router** with catch-all route pattern `[...rest]`
- Main file browser: `src/app/[...rest]/page.tsx` handles all path-based navigation
- Metadata generation for dynamic paths via `generateMetadata()`
- Internal tools under `src/app/ngdi-internal/` (configurator, deploy guide, embed)

### API Routes (`src/app/api/`)
- `/api/download` - File downloads (proxied or redirected based on size)
- `/api/preview` - File preview streaming (with size limits)
- `/api/raw` - Raw file URLs for embedding
- `/api/thumb` - Proxied thumbnails (if `proxyThumbnail: true`)
- `/api/token` - Generate temporary access tokens for protected files
- `/api/og` - OpenGraph image generation
- `/api/internal` - Internal utilities (encryption, etc.)

### Server Actions (`src/actions/`)
All data fetching uses Next.js Server Actions:
- `files.ts` - Google Drive API operations (list, get, banner, readme, siblings)
- `password.ts` - Password validation for index/folder protection
- `paths.ts` - Path validation and ID resolution
- `search.ts` - File search functionality
- `token.ts` - Temporary token generation for downloads
- `configuration.ts` - Configuration encryption/decryption

### Configuration System
- Central config: `src/config/gIndex.config.ts`
- Schema validation: `src/types/schema.ts` using Zod
- Encrypted folder/file IDs in config (use `/api/internal/encrypt?q=<id>`)
- Config supports both regular and Team/Shared drives

### Component Organization
```
src/components/
├── ui/         # shadcn/ui components
├── layout/     # Navbar, Footer, Password, ToTop
├── explorer/   # File browser components (FileBreadcrumb, FileActions, etc.)
├── preview/    # File preview components by type
├── global/     # Globally reusable components
└── internal/   # Internal tool components
```

### Google Drive Integration
- Uses `googleapis` package with service account authentication
- Service account must have access to shared folders/drives
- Folder/file IDs are encrypted in config and URLs
- Special files (`.password`, `.readme.md`, `.banner`) for metadata

### Middleware (`src/middleware.ts`)
- Handles CSP headers for embed routes
- Redirects `?raw=1` query to `/api/raw` endpoint
- Sets `X-Pathname` header for tracking

## Path Resolution

The app uses encrypted IDs for security:
1. URL path → decrypted folder IDs via `ValidatePaths()`
2. Each segment validated against Google Drive API
3. Path breadcrumbs generated dynamically
4. 404 if any segment invalid

## Type System

- Strict TypeScript with `noUncheckedIndexedAccess: true`
- Path aliases: `~/` → `./src/`, `config` → config file, `actions` → actions file
- Zod schemas define runtime validation for configs and API responses
- File metadata types in `src/types/schema.ts`

## Styling

- **Tailwind CSS** with custom configuration
- **shadcn/ui** components (customizable via `components.json`)
- Custom fonts: Source Sans 3, Outfit, JetBrains Mono
- Theme system with CSS variables for colors
- Custom styles: `src/styles/globals.css`, `markdown.css`, `code-highlight.css`

## File Preview System

Supported previews (size-limited by `streamMaxSize`):
- Images, videos, audio (via @vidstack/react)
- Documents (PDFs)
- Code/text/markdown (syntax highlighting via rehype-prism-plus)
- Manga/comic archives (.cbz via fflate)

Preview components in `src/components/preview/` handle each type.

## Security Features

- Password protection: site-wide (`privateIndex`) and per-folder (`.password` files)
- Encrypted IDs prevent direct Google Drive access
- Temporary download tokens with configurable expiration
- CSP headers for embed routes
- HTTP-only cookies for auth

## Important Notes

- **File size limits**: `maxFileSize` (4MB default) determines proxy vs redirect for downloads
- **Cache control**: Configurable via `cacheControl` setting, defaults to 60s
- **Shared drives**: Must set `isTeamDrive: true` and provide encrypted `sharedDrive` ID
- **Special files hidden**: `.password`, `.readme.md`, `.banner*` not shown in listings
- **No support** for Google Docs/Sheets/Slides, shortcuts, or seeking in proxied media

## Code Style

- ESLint config: TypeScript strict rules, Next.js core web vitals
- Prettier with import sorting (`@trivago/prettier-plugin-sort-imports`)
- Import order: third-party → app/components → utils/hooks/lib → types → config/actions → relative
- Unused vars prefixed with `_`
- Type imports use `type` keyword inline

## Development Workflow

1. Configure `.env` with service account and encryption key
2. Update `src/config/gIndex.config.ts` with encrypted root folder ID
3. Run `npm run dev` to start development server
4. Access configurator at `http://localhost:3000/ngdi-internal/configurator` if needed
5. Build with `npm run build` before deployment

## Deployment

- Designed for Vercel but supports Netlify, Cloudflare Pages, Railway, Render
- Auto-detects deployment platform via environment variables
- Set `showGuideButton: false` in production config
- Ensure Google service account has access to target folders/drives
