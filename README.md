# Granola Importer Plugin for Obsidian

A lean, beautiful Obsidian plugin that imports your Granola notes with perfect formatting preservation.

## What is Granola?

[Granola](https://www.granola.ai) is the AI notepad for people in back-to-back meetings. It takes your raw meeting notes and transcribes your meetings, then uses AI to enhance your notes when the meeting ends. Granola works on all platforms with no meeting bots, making it perfect for capturing and organizing your meeting insights.

## Features

- **One-click import** of all your Granola notes
- **Perfect formatting preservation** from ProseMirror to Markdown
- **Secure credential management** with automatic detection
- **Smart conflict resolution** for existing notes
- **Selective import** with document preview and filtering
- **Cross-platform support** (macOS, Windows, Linux)
- **Customizable filename templates** with date/time variables
- **Attendee tagging** from meeting participants
- **Direct Granola links** in frontmatter for cross-referencing
- **Ribbon icon** for quick access
- **Action items conversion** to Obsidian tasks

## Installation

### Community Plugin (Recommended)

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "Granola Importer"
4. Install and enable the plugin

### From GitHub Releases

1. Download the latest release from [GitHub Releases](https://github.com/amittell/obsidian-granola/releases)
2. Extract `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/granola-importer/` folder
3. Enable the plugin in Obsidian Settings → Community Plugins

### Build from Source

```bash
git clone https://github.com/amittell/obsidian-granola.git
cd obsidian-granola
npm install
npm run build
```

## Usage

### Getting Started

1. **Ensure Granola is installed** and you've used it to create notes
2. **Open Obsidian** and enable the Granola Importer plugin
3. **Run the import** via Command Palette: `Granola Importer: Import Granola Notes`
4. **Configure settings** (optional) to customize import behavior

### Import Process

When you run the import command, the plugin will:

1. **Authenticate** - Automatically detect and use your Granola credentials
2. **Fetch Documents** - Retrieve all your Granola notes
3. **Document Selection** - Open an interactive modal where you can:
   - Preview document titles and metadata
   - Select/deselect individual documents
   - Use "Select All" or "Deselect All" buttons
   - See document counts and import status
4. **Import Selected** - Click "Import Selected" to begin the import
5. **Conflict Resolution** - If documents already exist, you'll see options to:
   - Skip the existing document
   - Update with newer content from Granola
   - Create a new file with a different name
6. **Progress Tracking** - Watch real-time progress with:
   - Document-by-document status updates
   - Success/failure indicators
   - Detailed error messages if issues occur

#### Recovering Failed Imports

When a document can't be imported, the completion summary now helps you recover quickly:

- **Retry failed imports** with a single click—only the documents that failed are retried, using the same import settings and live progress view.
- **Export the failure list** for troubleshooting via the new dropdown:
  - Download a CSV with document ID, title, error reason, and timestamp.
  - Copy a formatted summary to your clipboard for sharing with support or teammates.
- **Keep working seamlessly**—successful documents remain available to open immediately while retries and exports focus solely on the failures.

### Common Use Cases

#### Daily Meeting Notes

Configure the plugin to organize your daily meetings:

1. Set **Import folder** to "Meetings/Daily"
2. Use **Custom filename template**: `{created_date} - {title}`
3. Enable **Convert action items to tasks**
4. Result: Notes like "2025-07-23 - Team Standup.md" with tasks ready to track

#### Project-Based Organization

Organize notes by project using attendee tags:

1. Enable **Extract attendee tags**
2. Set **Tag template** to `project/{name}`
3. After import, find all meetings with specific people using tag search
4. Example: Search for `#project/john-smith` to find all John's meetings

#### Meeting Series Tracking

Track recurring meetings with consistent naming:

1. Use **Custom filename template**: `{title} - {created_datetime}`
2. Result: "Weekly Sync - 2025-07-23_10-00-00.md" for easy chronological sorting

#### Action Item Workflow

Transform meeting notes into actionable tasks:

1. Enable **Convert action items to tasks**
2. Enable **Add task tag** with custom tag like `#meeting-tasks`
3. After import, use Obsidian's task queries to find all pending items
4. Example query: `task from #meeting-tasks`

## Plugin Settings

Access plugin settings via: **Settings → Plugin Options → Granola Importer**

### Connection & Validation

- **Test Connection** - Verify the plugin can access your Granola documents
- Shows connection status and last validation time

### Debug & Logging

- **Enable debug mode** - Toggle detailed logging for troubleshooting
- **Log level** - Control verbosity (Error, Warning, Info, Debug)

### Import behavior

- **Duplicate handling** - Choose default action for existing documents:
  - Skip existing documents
  - Update existing with newer content
  - Always ask what to do
- **Import folder** - Set default vault location for imported notes (e.g., "Meetings/Granola")
- **Skip empty documents** - Filter out placeholder documents with no content

### Content processing

- **Enhanced frontmatter** - Include additional metadata (id, title, updated timestamp)
- **Include Granola URL** - Add direct link to original Granola note in frontmatter
- **Custom filename templates** - Create personalized naming patterns:
  - Toggle between simple date prefix or advanced templates
  - Available variables:
    - `{title}` - Document title
    - `{id}` - First 12 characters of Granola document ID
    - `{created_date}` - Creation date
    - `{updated_date}` - Last updated date
    - `{created_time}` - Creation time (HH-mm-ss format)
    - `{updated_time}` - Last updated time
    - `{created_datetime}` - Combined date and time
    - `{updated_datetime}` - Combined updated date and time
  - Example templates:
    - `{created_date} - {title}` → "2025-07-23 - Team Meeting"
    - `Meeting_{created_datetime}_{title}` → "Meeting_2025-07-23_14-30-00_Team Meeting"
    - `{title} [{id}]` → "Team Meeting [abc123def456]"

### Action items processing

- **Convert action items to tasks** - Automatically transform meeting action items:
  - Converts bullet points under action headers to Obsidian task format `- [ ]`
  - Recognizes various headers: "Action Items", "Follow-ups", "Next Steps", "TODOs"
  - Preserves assignee information (e.g., "Action Items for Alex")
  - Works with variations like "Follow up items", "To-dos", "Next actions"
- **Add task tag** - Optionally add a tag to notes containing tasks
- **Task tag name** - Customize the tag (default: `#tasks`)

### User interface

- **Show progress notifications** - Display toast notifications during import

### Attendee Tags

- **Extract attendee tags** - Create tags from meeting participants:
  - Automatically extracts names from Granola meeting data
  - Converts names to tag-friendly format (lowercase, hyphenated)
  - Handles special characters and accented names properly
- **Exclude my name** - Option to exclude yourself from tags
- **My name** - Your name as it appears in meeting attendee lists
- **Include host in attendee tags** - Option to include the meeting host/creator in tags
- **Tag template** - Customize how attendee tags are formatted:
  - Available template variables:
    - `{name}` - Attendee's full name
    - `{email}` - Attendee's email address
    - `{domain}` - Domain from email (e.g., example.com)
    - `{company}` - Attendee's company name
  - Default template: `person/{name}`
  - Example templates and results:
    - `person/{name}` → `person/john-doe`
    - `{company}/{name}` → `acme-corp/jane-doe`
    - `person/{name}-{domain}` → `person/john-doe-example-com`
    - `person/{domain}/{name}` → `person/example-com/jane-doe`
    - `team/{name}` → `team/john-doe`
    - `{email}` → `john-doe-example-com`
  - Note: Tags are added to frontmatter without the # prefix
  - Note: Email addresses in tags have @ and . replaced with hyphens

## Requirements

- Obsidian v0.15.0+
- Granola app installed with existing notes
- Node.js 16+ (for development)

## Supported Content Types

- **Paragraphs** with rich text formatting
- **Headings** (H1-H6)
- **Lists** (bulleted and numbered)
- **Text formatting** (bold, italic, code, links)
- **YAML frontmatter** with metadata
- **Action items** that can be converted to tasks

## Security & Privacy

- **No credential storage** - Reads directly from Granola's secure storage
- **No token logging** - Credentials never appear in console or logs
- **Secure error handling** - Error messages don't expose sensitive data
- **Local processing** - All conversion happens on your machine

## Development

### Initial Setup

```bash
git clone https://github.com/amittell/obsidian-granola.git
cd obsidian-granola
npm install
./setup-hooks.sh  # Enable pre-commit hooks
npm run dev       # Start development
```

### Git Pre-Commit Hooks

This project uses **automated pre-commit hooks** to catch issues before they reach CI, saving GitHub Actions minutes and preventing common commit errors.

**What runs on every commit:**

- ✨ Prettier formatting check
- 🔍 TypeScript compilation check
- 🏗️ Build verification
- 🧹 Quick lint check (allows up to 20 warnings)
- 🧪 Critical integration tests

**Setup:**

```bash
./setup-hooks.sh
```

This configures git to use the `.githooks` directory for all hook scripts.

**Bypassing hooks** (use sparingly):

```bash
git commit --no-verify
```

**Benefits:**

- Catch formatting and build errors immediately
- Faster feedback loop than waiting for CI
- Reduce failed CI runs and save GitHub Actions minutes
- Ensure consistent code quality across all commits

**Note:** The hooks only run on files you're committing, so they're fast (typically 10-30 seconds).

### Build Commands

- `npm run dev` - Watch mode with hot reload
- `npm run build` - Production build
- `npm run version` - Bump version

### Testing

- `npm test` - Run all tests
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ci` - Run tests in CI mode

### Code Quality

- `npm run lint` - Run ESLint
- `npm run format` - Auto-format code with Prettier
- `npm run type-check` - TypeScript type checking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run `./setup-hooks.sh` to enable pre-commit hooks (highly recommended)
4. Follow the existing code patterns
5. Ensure all tests pass: `npm test && npm run lint && npm run build`
6. Submit a pull request

**Note:** Pre-commit hooks will automatically run formatting, linting, type checking, and build validation before each commit. This helps catch issues early and keeps the codebase consistent.

## Technical Details

For detailed API documentation and technical implementation details, see [granola-api.md](granola-api.md).

### Architecture Overview

- **Authentication** - Cross-platform credential discovery
- **API Client** - HTTP client with retry logic and batch processing
- **Converter** - ProseMirror JSON to Markdown transformation
- **Import Manager** - Selective document imports with progress tracking
- **UI Components** - Document selection and conflict resolution modals

## License

MIT License - see LICENSE file for details

## Support

- Report issues: [GitHub Issues](https://github.com/amittell/obsidian-granola/issues)
- Questions: [GitHub Discussions](https://github.com/amittell/obsidian-granola/discussions)

## Changelog

### v1.1.3 (Latest)

**Plugin Submission Review Fixes:**

- Settings headings converted to sentence case per Obsidian guidelines
- All CSS classes properly namespaced with `granola-` prefix to prevent conflicts
- Updated documentation to reflect ribbon icon is customizable via Obsidian's built-in settings
- Fixed heading case consistency in README

**Technical Changes:**

- Namespaced 6 additional CSS classes (`connection-*` → `granola-connection-*`, `filename-template-preview` → `granola-filename-template-preview`)
- All 141 CSS classes now properly namespaced
- Zero security vulnerabilities (npm audit)
- All 451 tests passing

### v1.1.0

**New Features:**

- **Custom Filename Templates** - Create personalized naming patterns with variables like `{title}`, `{created_date}`, `{id}`, and more
- **Attendee Tags** - Automatically extract meeting participants and create tags for easy organization
- **Granola URL in Frontmatter** - Direct links to original Granola notes for cross-referencing
- **Ribbon icon** - Quick access to import from the sidebar (customizable via Obsidian settings)

**Improvements:**

- Enhanced settings UI with live filename template preview
- Better handling of special characters in attendee names
- Support for accented characters in tags (proper Unicode normalization)
- More flexible tag templates with customizable patterns

**Bug Fixes:**

- Fixed DOMTokenList error when importing documents
- Improved error logging for better debugging
- Fixed progress bar class manipulation issues

### v1.0.0

- Initial release with core import functionality
- Selective import with document preview
- Smart conflict resolution for existing notes
- Action items conversion to Obsidian tasks
- Cross-platform credential detection
- Progress tracking and notifications
