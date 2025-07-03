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

### Testing

- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ci` - Run tests in CI mode (no watch, with coverage)
- Coverage threshold: 70% for branches, functions, lines, and statements
- Current baseline: ~57% coverage with automated trend monitoring
- Regression detection: 5% drop triggers CI failure
- Visual dashboard generation for coverage trends

### Code Quality

- `npm run lint` - Run ESLint with zero warnings allowed
- `npm run lint:quick` - Quick lint with up to 20 warnings
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Auto-format code with Prettier
- `npm run format:check` - Check formatting without changes
- `npm run type-check` - TypeScript type checking without build

### Performance Analysis and Monitoring

- `npm run analyze` - Bundle size analysis with detailed metrics
- `npm run perf` - Performance audit (bundle analysis + security audit)
- `npm run monitor:bundle` - Bundle size tracking and regression detection
- `npm run monitor:coverage` - Coverage trend monitoring with dashboard
- `npm run monitor:performance` - Performance benchmarking with thresholds
- `npm run monitor:check` - Run all monitoring checks for CI integration
- `npm run monitor:update` - Update historical monitoring data
- `npm run monitor:report` - Generate comprehensive monitoring report
- `npm run docs:build` - Generate TypeDoc documentation
- `npm run docs:serve` - Serve documentation locally on port 8080

### Security and Deployment

- `npm run security:audit` - Comprehensive security vulnerability scanning
- `npm run security:check` - Security validation for CI integration
- `npm run deploy:validate` - Deployment readiness validation
- `npm run deploy:check` - Production deployment verification

## Architecture Overview

This is a feature-rich Obsidian plugin (~74KB bundle with 61% compression) that imports Granola notes with perfect formatting preservation. The codebase follows an atomic-level modular design with strict separation of concerns and comprehensive monitoring systems.

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

### Extended Services Layer

**Import Manager (`src/services/import-manager.ts`)**

- Orchestrates selective document imports with real-time progress tracking
- Manages document-level import status (pending/importing/completed/failed/skipped)
- Handles import strategies (skip/update/create_new) for existing documents
- Provides comprehensive progress reporting with timing metrics
- Integrates with conflict resolution and duplicate detection systems

**Duplicate Detector (`src/services/duplicate-detector.ts`)**

- Detects existing documents by Granola ID from YAML frontmatter
- Classifies import status (NEW/EXISTS/UPDATED/CONFLICT)
- Analyzes local modifications to prevent data loss
- Compares timestamps to determine if Granola version is newer
- Supports intelligent conflict resolution workflows

**Document Metadata Service (`src/services/document-metadata.ts`)**

- Extracts and formats document display metadata for UI components
- Handles document filtering and sorting operations
- Processes document statistics (word count, creation dates, update status)
- Generates user-friendly document previews with status indicators
- Integrates with import manager for status-aware document listing

### User Interface Layer

**Document Selection Modal (`src/ui/document-selection-modal.ts`)**

- Comprehensive interface for previewing and selecting Granola documents
- Real-time status updates and progress tracking during imports
- Integrates filtering, sorting, and batch selection capabilities
- Provides document preview with metadata display
- Handles user interaction for selective import workflows

**Conflict Resolution Modal (`src/ui/conflict-resolution-modal.ts`)**

- Interactive dialog for handling document conflicts during import
- Presents options: skip, update existing, or create new file
- Shows document comparison information to aid user decision-making
- Integrates with duplicate detection to provide context-aware options
- Maintains user preferences for consistent conflict handling

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

### Local Development Setup

1. **Initial Setup**: Run `./setup-hooks.sh` to configure git hooks for local validation
2. **Git Hooks**: Pre-commit hooks run formatting, linting, and type checking
3. **Local Validation**: Catches issues before GitHub Actions, saving CI minutes
4. **Hook Bypass**: Use `git commit --no-verify` to temporarily disable hooks

### Testing Infrastructure

- **Framework**: Jest with jsdom environment for DOM testing
- **Coverage**: 70% threshold for branches, functions, lines, and statements
- **Mock System**: Comprehensive Obsidian API mocking in `tests/__mocks__/`
- **Test Structure**: Separate unit and integration test directories
- **CI Integration**: `npm run test:ci` for automated testing without watch mode

## Module Dependencies

- `src/auth.ts` → Node.js filesystem and OS modules
- `src/api.ts` → Authentication module for bearer tokens
- `src/converter.ts` → API module for document types
- `main.ts` → All src modules + Obsidian Plugin API

The dependency graph is designed for maximum parallelization during development and atomic testing of individual modules.

## Granola API Technical Specifications

### API Configuration

**Base URL**: `https://api.granola.ai/v2`

**Primary Endpoint**: `/get-documents` (POST)

**Authentication**: Bearer token from Cognito

**Required Headers**:

```
Authorization: Bearer {access_token}
Content-Type: application/json
User-Agent: Granola/5.354.0
X-Client-Version: 5.354.0
```

### Credential Storage

**File Location by Platform**:

- macOS: `~/Library/Application Support/Granola/supabase.json`
- Windows: `%APPDATA%/Granola/supabase.json`
- Linux: `~/.config/Granola/supabase.json`

**Configuration Structure**:

```json
{
	"cognito_tokens": "{\"access_token\":\"...\",\"token_type\":\"Bearer\",\"expires_in\":3600,\"refresh_token\":\"...\",\"id_token\":\"...\"}",
	"user_info": "{\"id\":\"...\",\"email\":\"...\"}"
}
```

### API Request Payload

**Critical Parameter**: Must include `include_last_viewed_panel: true` to retrieve note content.

```json
{
	"limit": 100,
	"offset": 0,
	"include_last_viewed_panel": true
}
```

### Content Location and Structure

**Primary Content Location**: `response.docs[].last_viewed_panel.content`

**Content Format**: ProseMirror JSON document structure

**Fallback Fields**:

- `notes.content` (ProseMirror JSON)
- `notes_markdown` (plain markdown)
- `notes_plain` (plain text)

**Document Metadata**:

- `id`: Unique document identifier
- `title`: Document title
- `created_at`: ISO timestamp
- `updated_at`: ISO timestamp
- `user_id`: Owner identifier

### ProseMirror Content Structure

**Document Root**:

```json
{
  "type": "doc",
  "content": [...]
}
```

**Node Types**:

- `paragraph`: Text paragraphs with inline formatting
- `heading`: Headers with level attribute (1-6)
- `bulletList`: Unordered lists
- `orderedList`: Numbered lists
- `listItem`: Individual list items
- `text`: Raw text nodes with optional marks
- `hardBreak`: Line breaks
- `codeBlock`: Code blocks with language attribute
- `blockquote`: Quote blocks
- `table`: Table structures
- `horizontalRule`: Horizontal dividers

**Text Formatting Marks**:

- `strong`: Bold text (**text**)
- `em`: Italic text (_text_)
- `code`: Inline code (`text`)
- `link`: Hyperlinks with href attribute

### Content Extraction Priority

1. **Primary**: `last_viewed_panel.content` (requires `include_last_viewed_panel: true`)
2. **Fallback 1**: `notes.content` (legacy ProseMirror)
3. **Fallback 2**: `notes_markdown` (pre-converted markdown)
4. **Fallback 3**: `notes_plain` (plain text)

### API Response Validation

**Required Fields for Valid Document**:

- `type: "doc"`
- `content: Array` (non-empty)
- Valid ProseMirror node structure

**Error Conditions**:

- Missing `include_last_viewed_panel` parameter results in empty content
- Malformed ProseMirror structure indicates API changes
- Empty content arrays suggest document sync issues

## CI/CD and Monitoring Strategy

### Cost-Effective CI Pipeline

The project uses a layered CI/CD approach optimized for solo developers:

**Layer 1: Local Git Hooks (Free)**

- Pre-commit validation with `./setup-hooks.sh`
- Formatting, TypeScript, and build checks
- Catches 80% of issues locally before push

**Layer 2: GitHub Actions (Budget-Conscious)**

- Quick checks: All branches (~2 min, $0.02/run)
- Full tests: Main branch and PRs only (~4 min, $0.04/run)
- Monthly cost: ~$0.60 vs $3-5 traditional CI (70-80% savings)

### Automated Monitoring Systems

**Bundle Size Monitoring:**

- Regression detection with 5% threshold
- Historical tracking with 100-entry limit
- CI failure on size increases beyond 80KB

**Performance Benchmarking:**

- Modal loading: < 100ms threshold
- Interactions: < 50ms threshold
- Processing: < 500ms threshold
- Automated regression detection with 20% degradation alert

**Test Coverage Monitoring:**

- 70% threshold enforcement for all metrics
- Historical trend analysis with visual dashboards
- Regression detection on 5% coverage drops

**Security Scanning:**

- Automated vulnerability detection
- Dependency auditing with version checking
- Source code security pattern analysis

### Monitoring Data Storage

All monitoring data is stored in `/monitoring/` directory:

- `bundle-size-history.json` - Bundle size tracking
- `coverage-history.json` - Test coverage trends
- `performance-history.json` - Performance metrics
- `security-history.json` - Security audit results
- `ci-report.json` - Latest CI status
- `ci-summary.md` - Human-readable reports
