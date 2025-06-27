# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development

- `npm run dev` - Watch mode with hot reload for development
- `npm run build` - Production build with TypeScript checking and minification
- `npm run version` - Bump version and update manifest/versions files

### Installation

- `npm install` - Install all dependencies
- Requires Node.js 16+ and Obsidian API as development dependency

## Architecture Overview

This is a lean Obsidian plugin (6.6KB bundle) that imports Granola notes with perfect formatting preservation. The codebase follows an atomic-level modular design with strict separation of concerns.

### Core Module Structure

**Main Plugin (`main.ts`)**

- Entry point extending Obsidian's Plugin class
- Orchestrates the import workflow with progress notifications
- Handles command registration and lifecycle management
- Integrates all core modules through dependency injection

**Authentication Module (`src/auth.ts`)**

- Cross-platform credential discovery (macOS/Windows/Linux paths)
- Reads Granola's `supabase.json` configuration securely
- Token validation and expiry checking
- No credential storage or logging (security-first design)

**API Client (`src/api.ts`)**

- HTTP client for Granola's `get-documents` endpoint
- Implements exponential backoff for rate limiting (429 responses)
- Batch processing with 100 documents per request
- Robust retry logic with network failure handling

**Content Converter (`src/converter.ts`)**

- Transforms ProseMirror JSON to clean Markdown
- Handles paragraphs, headings (H1-H6), lists, and rich text formatting
- Generates YAML frontmatter with document metadata
- Filename sanitization for cross-platform compatibility

### Key Design Patterns

**Error Handling**: All modules use type-safe error handling with `error instanceof Error` checks to avoid TypeScript's `unknown` type issues.

**Security**: Credentials are read directly from Granola's secure storage without logging or persistent storage. Error messages never expose sensitive data.

**Performance**: ESBuild configuration optimizes for minimal bundle size with tree shaking, external Obsidian API dependencies, and conditional sourcemaps.

**Platform Support**: Authentication module detects OS-specific credential paths automatically across macOS (`~/Library/Application Support`), Windows (`%APPDATA%`), and Linux (`~/.config`).

## Build Configuration

**TypeScript**: Strict mode enabled with ES6 target and ESNext modules for optimal tree shaking.

**ESBuild**: Production builds are minified with external Obsidian dependencies. Development mode includes inline sourcemaps and watch mode.

**Bundle Analysis**: Uses `metafile: true` for bundle size analysis and dependency tracking.

## Development Workflow

1. Use `npm run dev` for hot reload during development
2. The plugin loads one command: "Import Granola Notes" via Command Palette
3. Import process shows real-time progress via Obsidian's Notice API
4. Files are created with conflict resolution (update existing or create new)
5. All operations use Obsidian's native file API (`this.app.vault`)

## Module Dependencies

- `src/auth.ts` → Node.js filesystem and OS modules
- `src/api.ts` → Authentication module for bearer tokens
- `src/converter.ts` → API module for document types
- `main.ts` → All src modules + Obsidian Plugin API

The dependency graph is designed for maximum parallelization during development and atomic testing of individual modules.
