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

1. **Ensure Granola is installed** and you've used it to create notes
2. **Open Obsidian** and enable the Granola Importer plugin
3. **Run the import** via Command Palette: `Granola Importer: Import Granola Notes`
4. **Select documents** to import using the preview interface
5. **Resolve conflicts** if any existing notes are found
6. **Watch your notes** appear in Obsidian with perfect formatting

## Requirements

- Obsidian v0.15.0+
- Granola app installed with existing notes
- Node.js 16+ (for development)

## Architecture

This plugin follows a modular design with comprehensive testing:

### Core Components

- **Authentication** - Cross-platform credential discovery
- **API Client** - HTTP client with retry logic and batch processing
- **Converter** - ProseMirror JSON to Markdown transformation
- **Import Manager** - Selective document imports with progress tracking
- **UI Components** - Document selection and conflict resolution modals

### Security

- **No credential storage** - Reads directly from Granola's secure storage
- **No token logging** - Credentials never appear in console or logs
- **Secure error handling** - Error messages don't expose sensitive data

## Supported Content Types

- **Paragraphs** with rich text formatting
- **Headings** (H1-H6)
- **Lists** (bulleted and numbered)
- **Text formatting** (bold, italic, code, links)
- **YAML frontmatter** with metadata

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

## License

MIT License - see LICENSE file for details

## Support

- Report issues: [GitHub Issues](https://github.com/amittell/obsidian-granola/issues)
- Questions: [GitHub Discussions](https://github.com/amittell/obsidian-granola/discussions)

---

Built with ❤️ for the Obsidian community
