# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commonly Used Commands

### Build and Development
- `npm run dev` — Watch mode with hot reload for development
- `npm run build` — Production build with TypeScript checking and minification
- `npm run version` — Bump version and update manifest/versions files

### Testing
- `npm test` — Run all tests
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Run tests with coverage report
- `npm run test:ci` — Run tests in CI mode (no watch, with coverage)
- **Run a single test**: `jest path/to/test.test.ts` or `npm test -- path/to/test.test.ts`

### Code Quality
- `npm run lint` — Run ESLint with zero warnings allowed
- `npm run lint:quick` — Quick lint with up to 20 warnings
- `npm run lint:fix` — Auto-fix linting issues
- `npm run format` — Auto-format code with Prettier
- `npm run format:check` — Check formatting without changes
- `npm run type-check` — TypeScript type checking without build

### Performance Analysis
- `npm run analyze` — Bundle size analysis with detailed metrics
- `npm run perf` — Performance audit (bundle analysis + security audit)

### Documentation
- `npm run docs:build` — Generate TypeDoc documentation
- `npm run docs:check` — Check documentation without building
- `npm run docs:serve` — Serve documentation locally on port 8080

## High-Level Architecture

This is an **Obsidian plugin** (~120KB bundle) that imports Granola AI notes with perfect ProseMirror-to-Markdown formatting preservation. The codebase follows an atomic-level modular design with strict separation of concerns.

### Core Module Flow

**Entry Point**: `main.ts` extends Obsidian's Plugin class and orchestrates the entire import workflow.

**Authentication**: `src/auth.ts` discovers and validates credentials from Granola's secure storage across macOS/Windows/Linux.

**API Client**: `src/api.ts` provides HTTP client for Granola's get-documents endpoint with exponential backoff, retry logic, and batch processing (100 docs per request).

**Converter**: `src/converter.ts` transforms ProseMirror JSON to clean Markdown with YAML frontmatter, handling complex node types (paragraphs, headings, lists, rich text).

### Services Layer

**Import Manager** (`src/services/import-manager.ts`): Orchestrates selective document imports with real-time progress tracking, document-level status management, and import strategies (skip/update/create_new).

**Duplicate Detector** (`src/services/duplicate-detector.ts`): Detects existing documents by Granola ID from frontmatter, classifies import status (NEW/EXISTS/UPDATED/CONFLICT), and analyzes local modifications.

**Document Metadata** (`src/services/document-metadata.ts`): Extracts and formats document metadata for UI components with filtering and sorting.

### UI Layer

**Document Selection Modal** (`src/ui/document-selection-modal.ts`): Comprehensive interface for previewing, selecting, and tracking import progress.

**Conflict Resolution Modal** (`src/ui/conflict-resolution-modal.ts`): Interactive dialog for handling document conflicts with options to skip, update, or create new.

### Settings & Types

`src/types.ts` defines comprehensive settings interface with debug, import, content, actionItems, UI, and attendeeTags configuration. Includes centralized Logger class that respects debug settings.

`src/settings.ts` provides settings tab UI in Obsidian with live preview and validation.

## Development Workflow

### Initial Setup
1. `npm install` — Install dependencies (requires Node.js 16+)
2. `./setup-hooks.sh` — Configure git hooks for local validation
3. `npm run dev` — Start development with hot reload

### Git Hooks
- Pre-commit hooks run formatting, linting, and type checking
- Catches issues before GitHub Actions to save CI minutes
- Use `git commit --no-verify` to temporarily bypass hooks

### Testing Infrastructure
- **Framework**: Jest with jsdom environment for DOM testing
- **Coverage threshold**: 50% for branches, functions, lines, and statements
- **Mock system**: Comprehensive Obsidian API mocking in `tests/__mocks__/`
- **Structure**: Separate `tests/unit/` and `tests/integration/` directories
- **Test helpers**: Located in `tests/helpers/` for reusable testing utilities

### Build Configuration
- **TypeScript**: Strict mode, ES6 target, ESNext modules for optimal tree shaking
- **ESBuild**: Production builds are minified with external Obsidian dependencies
- **Conditional compilation**: `__DEV__` flag for development-only features
- **Bundle analysis**: Uses `metafile: true` for size tracking

### CI/CD Strategy (Cost-Optimized)

**Layer 1: Local Git Hooks** (Free) — Pre-commit validation catches 80% of issues locally

**Layer 2: Quick Checks** (~$0.02/run, 2 min) — Runs on all branches: format check, type check, quick lint, docs check

**Layer 3: Full Tests** (~$0.04/run, 4 min) — Only on main branch and PRs: full lint, build, tests with coverage, security audit

**Layer 4: Release Readiness** (~$0.01/run, 1 min) — Only on main: version consistency, required files, deployment validation

## Security & Privacy (Critical)

- **No credential storage**: Reads directly from Granola's secure storage paths
- **No token logging**: Credentials never appear in console or logs
- **Secure error handling**: Error messages don't expose sensitive data
- **Local processing**: All conversion happens on user's machine

## Granola API Technical Details

**Base URL**: `https://api.granola.ai/v2`

**Primary Endpoint**: `POST /get-documents`

**Critical Parameter**: Must include `include_last_viewed_panel: true` to retrieve note content

**Authentication**: Bearer token from Cognito in `Authorization` header

**Content Location**: `response.docs[].last_viewed_panel.content` (ProseMirror JSON format)

**Credential Paths**:
- macOS: `~/Library/Application Support/Granola/supabase.json`
- Windows: `%APPDATA%/Granola/supabase.json`
- Linux: `~/.config/Granola/supabase.json`

**Credential Structure**: JSON file with `cognito_tokens` (stringified JSON containing access_token) and `user_info` fields.

**Rate Limiting**: API client implements exponential backoff for 429 responses with batch processing.

## Module Dependencies

```
main.ts
  ├── src/auth.ts (Node.js fs + os modules)
  ├── src/api.ts (depends on auth)
  ├── src/converter.ts (depends on api types)
  ├── src/services/import-manager.ts
  ├── src/services/duplicate-detector.ts
  ├── src/services/document-metadata.ts
  ├── src/ui/document-selection-modal.ts
  ├── src/ui/conflict-resolution-modal.ts
  └── src/settings.ts
```

Dependency graph designed for maximum parallelization during development and atomic testing.

## Common Development Tasks

**Adding a new setting**: Update `GranolaSettings` interface in `src/types.ts`, add to `DEFAULT_SETTINGS`, and implement UI in `src/settings.ts`.

**Modifying converter**: Edit `src/converter.ts` for ProseMirror node transformations. Add tests in `tests/unit/converter.test.ts`.

**Debugging API issues**: Enable debug mode in settings UI, or use diagnostic command "Diagnose Empty Granola Documents" from Command Palette.

**Testing modals**: Use helpers in `tests/helpers/modal-test-helper.ts` and `tests/helpers/ui-mocks.ts`.

**Before release**: Run full validation suite: `npm test && npm run lint && npm run build && npm run docs:build`
