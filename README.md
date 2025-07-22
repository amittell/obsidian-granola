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

## Plugin Settings

Access plugin settings via: **Settings → Plugin Options → Granola Importer**

### Connection & Validation

- **Test Connection** - Verify the plugin can access your Granola documents
- Shows connection status and last validation time

### Debug & Logging

- **Enable debug mode** - Toggle detailed logging for troubleshooting
- **Log level** - Control verbosity (Error, Warning, Info, Debug)

### Import Behavior

- **Duplicate handling** - Choose default action for existing documents:
  - Skip existing documents
  - Update existing with newer content
  - Always ask what to do
- **Import folder** - Set default vault location for imported notes (e.g., "Meetings/Granola")
- **Skip empty documents** - Filter out placeholder documents with no content

### Content Processing

- **Date prefix format** - Add dates to filenames to prevent duplicates:
  - YYYY-MM-DD (ISO standard)
  - MM-DD-YYYY (US format)
  - DD-MM-YYYY (European format)
  - YYYY.MM.DD (dot separated)
  - No date prefix
- **Enhanced frontmatter** - Include additional metadata (id, title, updated timestamp)
- **Include Granola URL** - Add direct link to original Granola note in frontmatter
- **Use custom filename template** - Enable advanced filename customization:
  - When disabled (default): Uses traditional date prefix format
  - When enabled: Use templates with variables:
    - `{title}` - Document title
    - `{id}` - Granola document ID
    - `{created_date}` - Creation date (formatted per date prefix setting)
    - `{updated_date}` - Last updated date
    - `{created_time}` - Creation time (HH-mm-ss format)
    - `{updated_time}` - Last updated time
    - Example: `{created_date} {created_time} - {title}`

### Action Items Processing

- **Convert action items to tasks** - Transform bullet points under action headers to `- [ ]` format
  - Recognizes headers like "Action Items", "Follow-ups", "Next Steps", "TODOs"
  - Preserves assignee information (e.g., "Action Items for Alex")
- **Add task tag** - Automatically tag notes containing converted tasks
- **Task tag name** - Customize the tag (default: `#tasks`)

### User Interface

- **Show progress notifications** - Display toast notifications during import
- **Show ribbon icon** - Display download icon in left sidebar for quick access

### Attendee Tags

- **Extract attendee tags** - Automatically create tags from meeting attendee names
- **Exclude my name** - Exclude your own name from attendee tags
- **My name** - Your name as it appears in meeting attendee lists
- **Tag template** - Customize tag format with `{name}` placeholder:
  - Default: `person/{name}` creates tags like `person/john-smith`
  - Example: `attendee/{name}` or `meeting/{name}`

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
3. Follow the existing code patterns
4. Ensure all tests pass: `npm test && npm run lint && npm run build`
5. Submit a pull request

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

### v1.1.0 (Latest)

- **New Features:**
  - Customizable filename templates with date/time variables
  - Attendee extraction and tagging from meeting participants
  - Granola URL in frontmatter for cross-referencing
  - Ribbon icon toggle for quick access
- **Improvements:**
  - Enhanced settings UI with live filename preview
  - Better handling of special characters in attendee names

### v1.0.0

- Initial release
- Core import functionality
- Selective import with preview
- Conflict resolution
- Action items conversion
