# Granola Importer Plugin for Obsidian

A lean, beautiful Obsidian plugin that imports your Granola notes with perfect formatting preservation.

## Features

- **One-click import** of all your Granola notes
- **Perfect formatting preservation** from ProseMirror to Markdown
- **Secure credential management** with automatic detection
- **Smart conflict resolution** for existing notes
- **Minimal footprint** with optimized bundle size (6.6KB)
- **Cross-platform support** (macOS, Windows, Linux)

## Installation

### Quick Deployment

For development and testing, use the deployment scripts:

```bash
# Ultra fancy deployment with ASCII art and animations
./deploy-fancy.sh

# Or simple, clean deployment
./deploy.sh

# Test first with dry run mode (recommended)
./deploy.sh --dry-run
./deploy-fancy.sh --dry-run
```

**Important**: Update `VAULT_PATH` in the script to point to your Obsidian vault.

### Manual Installation

1. Download the latest release
2. Extract `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/granola-importer/` folder
3. Enable the plugin in Obsidian Settings → Community Plugins

### Development

```bash
git clone https://github.com/amittell/obsidian-granola.git
cd obsidian-granola
npm install
npm run dev
```

#### Development Commands

**Build and Development:**
- `npm run dev` - Watch mode with hot reload
- `npm run build` - Production build with TypeScript checking
- `npm run version` - Bump version and update manifest files

**Testing:**
- `npm test` - Run all 614 tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report (70% threshold)
- `npm run test:ci` - Run tests in CI mode

**Code Quality:**
- `npm run lint` - Run ESLint (zero warnings allowed)
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Auto-format code with Prettier
- `npm run type-check` - TypeScript type checking

**Performance Analysis:**
- `npm run analyze` - Bundle size analysis with detailed metrics
- `npm run perf` - Performance audit (bundle analysis + security audit)
- `npm run monitor:bundle` - Bundle size tracking and regression detection
- `npm run monitor:coverage` - Coverage trend monitoring with dashboard
- `npm run monitor:performance` - Performance benchmarking with thresholds

See [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for detailed deployment instructions.

#### CI/CD Pipeline

The project uses a cost-effective, layered CI/CD strategy:

**Layer 1: Local Git Hooks (Free)**
- Pre-commit validation catches issues locally
- Formatting, TypeScript, and build checks
- Setup: `./setup-hooks.sh`

**Layer 2: GitHub Actions (Budget-Conscious)**
- Quick checks on all branches (~2 min, $0.02/run)
- Full tests only on main branch and PRs (~4 min, $0.04/run)
- Automated monitoring: bundle size, coverage, performance, security
- Monthly cost: ~$0.60 vs $3-5 traditional CI (70-80% savings)

## Usage

1. **Ensure Granola is installed** and you've used it to create notes
2. **Open Obsidian** and enable the Granola Importer plugin
3. **Run the import** via Command Palette: `Granola Importer: Import Granola Notes`
4. **Watch the magic** as your notes are imported with perfect formatting

## Architecture

This plugin follows an atomic-level modular design with strict separation of concerns and comprehensive testing coverage (614 tests, 100% pass rate).

### Core Modules

- **Authentication (`src/auth.ts`)** - Cross-platform credential discovery (macOS/Windows/Linux paths)
- **API Client (`src/api.ts`)** - HTTP client with exponential backoff and batch processing
- **Converter (`src/converter.ts`)** - ProseMirror JSON to clean Markdown transformation
- **Integration (`main.ts`)** - Obsidian plugin orchestrating import workflow

### Extended Services Layer

- **Import Manager (`src/services/import-manager.ts`)** - Orchestrates selective document imports with real-time progress tracking
- **Duplicate Detector (`src/services/duplicate-detector.ts`)** - Detects existing documents and classifies import status
- **Document Metadata Service (`src/services/document-metadata.ts`)** - Extracts and formats document metadata for UI components

### User Interface Layer

- **Document Selection Modal (`src/ui/document-selection-modal.ts`)** - Comprehensive interface for previewing and selecting documents
- **Conflict Resolution Modal (`src/ui/conflict-resolution-modal.ts`)** - Interactive dialog for handling document conflicts

### Performance & Testing

- **Performance Monitoring (`src/performance/`)** - Runtime profiling and bottleneck detection
- **Comprehensive Test Suite** - 614 tests covering unit, integration, and edge cases
- **Mock Infrastructure** - Realistic Obsidian API mocking with TFile instance validation

### Key Features

- **Selective Import** - Choose specific documents with conflict resolution
- **Real-time Progress Tracking** - Document-level and overall progress with cancellation support
- **Intelligent Conflict Resolution** - Skip, update, merge, or rename options
- **Cross-platform Support** - Automatic credential detection across operating systems
- **Performance Optimized** - Concurrent processing with memory leak detection

## Security

- **No credential storage** - Reads directly from Granola's secure storage
- **No token logging** - Credentials never appear in console or logs
- **Secure error handling** - Error messages don't expose sensitive data

## Performance

- **Bundle size**: ~74KB (61% compression ratio)
- **Modal loading**: < 100ms
- **Interaction responsiveness**: < 0.1ms
- **Document processing**: < 5ms per document
- **Memory efficient**: Batch processing with concurrent limits
- **Tree shaking**: Optimized bundle with dynamic imports for modals
- **Performance monitoring**: Automated regression detection with thresholds

## Supported Note Types

- **Paragraphs** with rich text formatting
- **Headings** (H1-H6)
- **Lists** (bulleted and numbered)
- **Text formatting** (bold, italic, code, links)
- **YAML frontmatter** with metadata

## Requirements

- Obsidian v0.15.0+
- Granola app installed with existing notes
- Node.js 16+ (for development)

## Testing

The plugin maintains a comprehensive test suite with 614 tests covering:

- **Unit Tests** - Individual module functionality
- **Integration Tests** - Cross-module interactions
- **Import Manager Tests** - Document processing workflows
- **UI Component Tests** - Modal and conflict resolution
- **Mock Infrastructure** - Realistic Obsidian API simulation

**Coverage Requirements:**
- 70% threshold for branches, functions, lines, and statements
- Current coverage: Lines 57.57%, Functions 52.44%, Statements 57.0%, Branches 39.78%
- TFile instance validation for proper `instanceof` checks
- Performance monitoring and memory leak detection

**Automated Monitoring:**
- Bundle size regression detection (5% threshold)
- Performance benchmarking (modal loading, interactions, processing)
- Security vulnerability scanning
- Coverage trend analysis with visual dashboards

**Test Categories:**
- Core business logic (import strategies, conflict resolution)
- Error handling and recovery scenarios
- Progress tracking and cancellation
- Concurrent processing and rate limiting
- Helper methods and edge cases

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the atomic development structure
4. Ensure all tests pass: `npm test && npm run lint && npm run build`
5. Maintain 70% test coverage
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Report issues: [GitHub Issues](https://github.com/amittell/obsidian-granola/issues)
- Documentation: [Wiki](https://github.com/amittell/obsidian-granola/wiki)

---

Built with ❤️ for the Obsidian community
