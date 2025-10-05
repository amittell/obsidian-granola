# Granola Importer Plugin for Obsidian

## Project Overview

This project is an Obsidian plugin that allows users to import their notes from Granola, an AI-powered notepad for meetings. The plugin is written in TypeScript and uses the Obsidian API to interact with the Obsidian environment. It preserves the formatting of the original notes by converting them from ProseMirror JSON to Markdown.

The plugin features:

- One-click import of all Granola notes
- Secure credential management
- Smart conflict resolution for existing notes
- Selective import with document preview and filtering
- Customizable filename templates
- Attendee tagging from meeting participants
- Direct Granola links in frontmatter for cross-referencing
- Action items conversion to Obsidian tasks

## Building and Running

### Build

To build the plugin, run the following command:

```bash
npm run build
```

This will compile the TypeScript code and create the `main.js`, `manifest.json`, and `styles.css` files in the project's root directory.

### Run

To run the plugin in a development environment, use the following command:

```bash
npm run dev
```

This will start a development server that watches for changes in the source code and automatically rebuilds the plugin.

### Test

To run the tests for the plugin, use the following command:

```bash
npm test
```

This will run all the tests in the `tests/` directory.

## Development Conventions

### Coding Style

The project uses Prettier for code formatting and ESLint for linting. The coding style is enforced by pre-commit hooks that run Prettier and ESLint before each commit.

### Testing Practices

The project uses Jest for testing. The tests are located in the `tests/` directory and are organized into unit and integration tests. The tests are run automatically on each commit by a pre-commit hook.

### Contribution Guidelines

To contribute to the project, you should:

1. Fork the repository
2. Create a feature branch
3. Run `./setup-hooks.sh` to enable pre-commit hooks
4. Follow the existing code patterns
5. Ensure all tests pass: `npm test && npm run lint && npm run build`
6. Submit a pull request
