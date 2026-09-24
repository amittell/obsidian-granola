# Changelog

All notable changes to the Obsidian Granola Importer plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Meeting list parsing now tolerates added or reordered attributes in Granola MCP responses. The August 2026 format added `captured_by_me`, `listed_as_participant`, and `is_workspace_visible` after the `date` attribute, which made the previous fixed-order regex match zero meetings, so the importer found nothing while the connection test still reported success
- The parser now throws a descriptive error instead of silently returning zero meetings when meeting entries are present but unrecognizable, so future Granola format changes fail loudly in both the connection test and the import flow
- The connection test now says when the account has no meetings in the last 30 days instead of showing a bare success
- Duplicate detection now recognizes notes imported without enhanced frontmatter: the document id is recovered from `granola_url` when `id` is absent, frontmatter is read through Obsidian's metadata cache, and updates target the matched note even after it was renamed or moved

### Changed
- New imports always write the Granola document `id:` to frontmatter, regardless of the enhanced frontmatter setting, so later imports can match them

## [1.1.2] - 2025-10-05

### Added
- Automated git pre-commit hooks for local validation
  - Runs formatting, type checking, build verification, and lint checks
  - Configured via `./setup-hooks.sh` script
  - Catches issues before CI to save GitHub Actions minutes
- Comprehensive test coverage for import manager service
  - Import cancellation behavior tests
  - Error handling tests for file operations
  - Folder creation validation tests
- Enhanced documentation structure
  - Added git hooks section to README with setup instructions
  - Updated WARP.md and CLAUDE.md for AI assistant guidance

### Changed
- Updated test coverage threshold to 50% (from 70%)
- Improved development workflow documentation

### Removed
- Outdated review tracking documentation files

## [1.1.1] - 2025-07-28

### Fixed
- Fixed import folder setting not being applied when creating files (#35)
  - Added proper folder path handling to ensure notes are imported to the configured folder
  - Import folder hierarchy is now created automatically if it doesn't exist
  - All file creation operations now respect the import folder setting

## [1.1.0] - 2025-06-28

### Added
- Attendee tags feature to automatically create tags from meeting attendees
- Custom filename templates with variables ({title}, {id}, {created_date}, etc.)
- Ribbon icon for quick access to import functionality
- Granola URL in frontmatter for easy cross-referencing
- Comprehensive test suite with 70% coverage threshold
- Performance monitoring and bundle size analysis

### Changed
- Improved empty document detection and handling
- Enhanced UI with better progress tracking and error messages
- Optimized bundle size for faster plugin loading

### Fixed
- HTML entity decoding in document titles
- Action items conversion for various header formats
- Conflict resolution for documents with local modifications

## [1.0.0] - 2025-05-15

### Added
- Initial release of Obsidian Granola Importer
- Core import functionality from Granola to Obsidian
- ProseMirror to Markdown conversion
- Duplicate detection and conflict resolution
- Selective document import with preview
- Cross-platform authentication support
- Progress tracking during import
- YAML frontmatter generation