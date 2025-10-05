# Granola Importer Plugin for Obsidian - Project Context

## Project Overview

The Granola Importer is a sophisticated Obsidian plugin that enables users to import their Granola AI notes into Obsidian with perfect formatting preservation. Granola is an AI notepad for people in back-to-back meetings that enhances raw meeting notes using AI, and this plugin bridges the two platforms by importing documents with rich formatting, metadata, and structural elements intact.

### Key Features

- One-click import of all Granola notes
- Perfect formatting preservation from ProseMirror to Markdown
- Secure credential management with automatic detection
- Smart conflict resolution for existing notes
- Selective import with document preview and filtering
- Cross-platform support (macOS, Windows, Linux)
- Customizable filename templates with date/time variables
- Attendee tagging from meeting participants
- Direct Granola links in frontmatter for cross-referencing
- Action items conversion to Obsidian tasks

### Technologies & Architecture

**Core Technologies:**

- TypeScript for type-safe development
- Obsidian API for plugin integration
- ProseMirror JSON format handling
- esbuild for bundling
- OAuth 2.0 with AWS Cognito for authentication

**Key Architecture Components:**

1. **GranolaAuth** - Handles credential loading and validation from platform-specific locations
2. **GranolaAPI** - HTTP client with retry logic and batch processing for API communication
3. **ProseMirrorConverter** - Converts ProseMirror JSON to Markdown with advanced formatting support
4. **Document Selection Modal** - UI for previewing and selecting documents to import
5. **Import Manager** - Batch processing with progress tracking and error handling
6. **Conflict Resolution Modal** - Handles duplicate and conflicting document scenarios
7. **Settings System** - Comprehensive configuration for import behavior, naming, and processing

## Building and Running

### Development Setup

```bash
git clone https://github.com/amittell/obsidian-granola.git
cd obsidian-granola
npm install
./setup-hooks.sh  # Enable pre-commit hooks
npm run dev       # Start development in watch mode
```

### Build Commands

- `npm run dev` - Watch mode with hot reload
- `npm run build` - Production build
- `npm run test` - Run all tests
- `npm run lint` - Run ESLint
- `npm run format` - Auto-format code with Prettier
- `npm run type-check` - TypeScript type checking

### Deployment

- The plugin is built to a single `main.js` file using esbuild
- Production builds are minified with advanced optimizations
- Bundle analysis is available with `npm run analyze`

## Development Conventions

### Code Style

- TypeScript strict mode with comprehensive type checking
- ESLint with custom rules for consistency
- Prettier for code formatting
- JSDoc comments for all public APIs
- Comprehensive error handling and logging

### Git Hooks

- Pre-commit hooks enforce code quality (formatting, linting, building)
- Hooks run only on changed files for fast feedback
- Bypass with `git commit --no-verify` when necessary

### Testing

- Jest for unit and integration tests
- Code coverage reporting
- CI mode for continuous integration

### Security & Privacy

- No credential storage in the plugin - reads directly from Granola's secure storage
- No token logging to console or logs
- Secure error handling that doesn't expose sensitive data
- Local processing - all conversion happens on the user's machine

## Technical Details

### API Integration

The plugin connects to the Granola API at `https://api.granola.ai/v2/get-documents` using OAuth 2.0 with AWS Cognito tokens. Credentials are automatically discovered from platform-specific locations:

- macOS: `~/Library/Application Support/Granola/supabase.json`
- Windows: `%APPDATA%/Granola/supabase.json`
- Linux: `~/.config/Granola/supabase.json`

### Content Conversion

The plugin handles multiple content formats in priority order:

1. `last_viewed_panel.content` (ProseMirror JSON or HTML)
2. `notes.content` (legacy ProseMirror JSON)
3. `notes_markdown` (pre-converted markdown)
4. `notes_plain` (plain text fallback)

### ProseMirror to Markdown Conversion

The converter handles a wide range of content types:

- Text formatting (bold, italic, code, links)
- Structural elements (headings, paragraphs, lists)
- Advanced content (code blocks, blockquotes, tables, horizontal rules)
- Nested structures and complex hierarchies
- Action items that can be converted to Obsidian tasks

### Conflict Handling

The plugin provides intelligent duplicate detection and resolution:

- Skip, update, or rename existing documents
- Backup creation when overwriting
- Merge options with append/prepend strategies
- Advanced conflict resolution UI

### UI Components

- Document selection modal with preview functionality
- Progress tracking with real-time feedback
- Conflict resolution with multiple options
- Settings interface with comprehensive options
- Ribbon icon for quick access

## Project Structure

```
obsidian-granola/
├── src/
│   ├── services/          # Core business logic (import manager, duplicate detection)
│   ├── ui/               # User interface components (modals, views)
│   ├── utils/            # Helper functions and utilities
│   ├── styles/           # CSS styling
│   ├── api.ts            # API client and data types
│   ├── auth.ts           # Authentication and credential management
│   ├── converter.ts      # ProseMirror to Markdown conversion
│   ├── settings.ts       # Settings UI implementation
│   └── types.ts          # Type definitions and interfaces
├── main.ts               # Plugin entry point and main class
├── esbuild.config.mjs    # Build configuration
├── package.json          # Dependencies and scripts
├── README.md             # User documentation
└── granola-api.md        # API documentation
```

## Plugin Settings

Comprehensive configuration options include:

- Connection validation and testing
- Debug logging with multiple levels
- Import behavior (duplicate handling, default folder)
- Content processing (filename templates, enhanced frontmatter)
- Action item processing (task conversion, task tagging)
- Attendee tag extraction and formatting
- UI preferences (notifications, ribbon icon)

## Development Notes

This plugin is designed with a focus on reliability, user experience, and security. Key design decisions include:

- Reading credentials from the user's existing Granola installation rather than handling authentication
- Comprehensive error handling and logging for debugging complex issues
- Flexible conflict resolution to handle various import scenarios
- Performance optimization with batch processing and progress tracking
- Rich UI for document selection and conflict resolution
- Platform-specific credential detection for cross-platform compatibility

The plugin follows Obsidian plugin best practices and maintains high code quality with extensive type safety, comprehensive testing, and proper error handling.
