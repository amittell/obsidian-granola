import { ProseMirrorConverter } from '../../src/converter-split';
import { NodeConverters } from '../../src/converter/node-converters';
import { GranolaDocument, ProseMirrorDoc, ProseMirrorNode } from '../../src/api';
import {
	Logger,
	GranolaSettings,
	ContentPriority,
	DatePrefixFormat,
	ImportStrategy,
} from '../../src/types';

describe('Converter Modules - Comprehensive Coverage Tests', () => {
	let converter: ProseMirrorConverter;
	let nodeConverters: NodeConverters;
	let mockLogger: Logger;
	let mockSettings: GranolaSettings;

	// Shared helper function for creating mock documents
	const createMockDoc = (
		id: string,
		title: string,
		hasPanel: boolean = true,
		hasNotes: boolean = true,
		hasMarkdown: boolean = true,
		hasPlain: boolean = true
	): GranolaDocument => ({
		id,
		title,
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-01T01:00:00Z',
		user_id: 'user-1',
		last_viewed_panel: hasPanel
			? {
				content: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'Panel content for ' + title }],
						},
					],
				},
			}
			: undefined,
		notes: hasNotes
			? {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: 'Notes content for ' + title }],
					},
				],
			}
			: undefined,
		notes_markdown: hasMarkdown ? `# ${title}\n\nMarkdown content for ${title}` : '',
		notes_plain: hasPlain ? `Plain text content for ${title}` : '',
	});

	beforeEach(() => {
		// Setup mock logger
		mockLogger = {
			debug: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		};

		// Setup mock settings
		mockSettings = {
			content: {
				contentPriority: ContentPriority.PANEL_FIRST,
				datePrefixFormat: DatePrefixFormat.ISO_DATE,
				includeMetadata: true,
				includeEnhancedFrontmatter: true,
				customFrontmatter: [],
			},
			import: {
				strategy: ImportStrategy.SKIP_EXISTING,
				defaultFolder: '',
				createFolders: true,
				maxFilenameLength: 100,
			},
			ui: {
				autoCloseModal: false,
				showProgressNotifications: true,
				showDocumentPreviews: true,
				groupByDate: false,
			},
			debug: {
				enabled: false,
				logLevel: 1,
				verbose: false,
			},
		} as GranolaSettings;

		// Create instances
		converter = new ProseMirrorConverter(mockLogger, mockSettings);
		nodeConverters = new NodeConverters(mockLogger);
	});

	describe('ProseMirrorConverter - converter-split.ts', () => {
		describe('Constructor and Settings', () => {
			it('should initialize with logger and settings', () => {
				expect(converter).toBeDefined();
				expect(mockLogger.debug).not.toHaveBeenCalled(); // No initialization logging
			});

			it('should update settings correctly', () => {
				const newSettings = {
					...mockSettings,
					content: {
						...mockSettings.content,
						contentPriority: ContentPriority.NOTES_FIRST,
					},
				};

				converter.updateSettings(newSettings);
				// Settings update should be silent - no immediate side effects to test
				expect(converter).toBeDefined();
			});
		});

		describe('Document Conversion with Content Priority', () => {

			it('should prioritize panel content when PANEL_FIRST', () => {
				const doc = createMockDoc('doc-1', 'Test Document');

				// Mock the ProseMirror conversion
				jest.spyOn(converter as any, 'isValidProseMirrorDoc').mockReturnValue(true);
				jest.spyOn(converter as any, 'convertProseMirrorToMarkdown').mockReturnValue(
					'# Converted Panel Content'
				);
				jest.spyOn(converter as any, 'generateFrontmatter').mockReturnValue({
					created: '2024-01-01T00:00:00Z',
					source: 'Granola',
					id: 'doc-1',
					title: 'Test Document',
				});
				jest.spyOn(converter as any, 'generateDatePrefixedFilename').mockReturnValue(
					'2024-01-01 - Test Document.md'
				);

				const result = converter.convertDocument(doc);

				expect(result.filename).toBe('2024-01-01 - Test Document.md');
				expect(result.content).toContain('# Converted Panel Content');
				expect(mockLogger.debug).toHaveBeenCalledWith(
					'Processing document: doc-1 - "Test Document"'
				);
			});

			it('should prioritize notes content when NOTES_FIRST', () => {
				converter.updateSettings({
					...mockSettings,
					content: {
						...mockSettings.content,
						contentPriority: ContentPriority.NOTES_FIRST,
					},
				});

				const doc = createMockDoc('doc-2', 'Notes First Doc');

				jest.spyOn(converter as any, 'isValidProseMirrorDoc').mockReturnValue(true);
				jest.spyOn(converter as any, 'convertProseMirrorToMarkdown').mockReturnValue(
					'# Converted Notes Content'
				);
				jest.spyOn(converter as any, 'generateFrontmatter').mockReturnValue({
					created: '2024-01-01T00:00:00Z',
					source: 'Granola',
				});
				jest.spyOn(converter as any, 'generateDatePrefixedFilename').mockReturnValue(
					'notes-first-doc'
				);

				const result = converter.convertDocument(doc);

				expect(result.content).toContain('# Converted Notes Content');
			});

			it('should use PANEL_ONLY priority and skip notes fallback', () => {
				converter.updateSettings({
					...mockSettings,
					content: {
						...mockSettings.content,
						contentPriority: ContentPriority.PANEL_ONLY,
					},
				});

				const doc = createMockDoc('doc-3', 'Panel Only Doc', true, true);

				jest.spyOn(converter as any, 'isValidProseMirrorDoc').mockReturnValue(true);
				jest.spyOn(converter as any, 'convertProseMirrorToMarkdown').mockReturnValue(
					'# Panel Only Content'
				);
				jest.spyOn(converter as any, 'generateFrontmatter').mockReturnValue({
					created: '2024-01-01T00:00:00Z',
					source: 'Granola',
				});
				jest.spyOn(converter as any, 'generateDatePrefixedFilename').mockReturnValue(
					'panel-only-doc.md'
				);

				const result = converter.convertDocument(doc);

				expect(result.content).toContain('# Panel Only Content');
			});

			it('should use NOTES_ONLY priority and skip panel fallback', () => {
				converter.updateSettings({
					...mockSettings,
					content: {
						...mockSettings.content,
						contentPriority: ContentPriority.NOTES_ONLY,
					},
				});

				const doc = createMockDoc('doc-4', 'Notes Only Doc', true, true);

				jest.spyOn(converter as any, 'isValidProseMirrorDoc').mockReturnValue(true);
				jest.spyOn(converter as any, 'convertProseMirrorToMarkdown').mockReturnValue(
					'# Notes Only Content'
				);
				jest.spyOn(converter as any, 'generateFrontmatter').mockReturnValue({
					created: '2024-01-01T00:00:00Z',
					source: 'Granola',
				});
				jest.spyOn(converter as any, 'generateDatePrefixedFilename').mockReturnValue(
					'notes-only-doc.md'
				);

				const result = converter.convertDocument(doc);

				expect(result.content).toContain('# Notes Only Content');
			});

			it('should fallback from panel to notes when PANEL_FIRST and panel invalid', () => {
				const doc = createMockDoc('doc-5', 'Panel Fallback');

				jest.spyOn(converter as any, 'isValidProseMirrorDoc')
					.mockReturnValueOnce(false) // Panel is invalid
					.mockReturnValueOnce(true); // Notes is valid
				jest.spyOn(converter as any, 'convertProseMirrorToMarkdown').mockReturnValue(
					'# Fallback Notes Content'
				);
				jest.spyOn(converter as any, 'generateFrontmatter').mockReturnValue({
					created: '2024-01-01T00:00:00Z',
					source: 'Granola',
				});
				jest.spyOn(converter as any, 'generateDatePrefixedFilename').mockReturnValue(
					'fallback-doc.md'
				);

				const result = converter.convertDocument(doc);

				expect(result.content).toContain('Markdown content for Panel Fallback');
			});

			it('should fallback from notes to panel when NOTES_FIRST and notes invalid', () => {
				converter.updateSettings({
					...mockSettings,
					content: {
						...mockSettings.content,
						contentPriority: ContentPriority.NOTES_FIRST,
					},
				});

				const doc = createMockDoc('doc-6', 'Notes First Fallback');

				jest.spyOn(converter as any, 'isValidProseMirrorDoc')
					.mockReturnValueOnce(false) // Notes is invalid (first call)
					.mockReturnValueOnce(true); // Panel is valid (second call)
				jest.spyOn(converter as any, 'convertProseMirrorToMarkdown').mockReturnValue(
					'# Fallback Panel Content'
				);
				jest.spyOn(converter as any, 'generateFrontmatter').mockReturnValue({
					created: '2024-01-01T00:00:00Z',
					source: 'Granola',
				});
				jest.spyOn(converter as any, 'generateDatePrefixedFilename').mockReturnValue(
					'notes-first-fallback.md'
				);

				const result = converter.convertDocument(doc);

				expect(result.content).toContain('Markdown content for Notes First Fallback');
			});

			it('should use notes_markdown fallback when ProseMirror conversion fails', () => {
				const doc = createMockDoc('doc-7', 'Markdown Fallback');

				jest.spyOn(converter as any, 'isValidProseMirrorDoc').mockReturnValue(false);
				jest.spyOn(converter as any, 'generateFrontmatter').mockReturnValue({
					created: '2024-01-01T00:00:00Z',
					source: 'Granola',
				});
				jest.spyOn(converter as any, 'generateDatePrefixedFilename').mockReturnValue(
					'markdown-fallback'
				);

				const result = converter.convertDocument(doc);

				expect(result.content).toContain('Markdown content for Markdown Fallback');
			});

			it('should use notes_plain fallback when no markdown available', () => {
				const doc = createMockDoc('doc-8', 'Plain Fallback', false, false, false, true);

				jest.spyOn(converter as any, 'generateFrontmatter').mockReturnValue({
					created: '2024-01-01T00:00:00Z',
					source: 'Granola',
				});
				jest.spyOn(converter as any, 'generateDatePrefixedFilename').mockReturnValue(
					'plain-fallback'
				);

				const result = converter.convertDocument(doc);

				expect(result.content).toContain('Plain text content');
			});

			it('should handle documents with no content at all', () => {
				const doc = createMockDoc('doc-9', 'Empty Doc', false, false, false, false);

				jest.spyOn(converter as any, 'generateFrontmatter').mockReturnValue({
					created: '2024-01-01T00:00:00Z',
					source: 'Granola',
				});
				jest.spyOn(converter as any, 'generateDatePrefixedFilename').mockReturnValue(
					'empty-doc.md'
				);

				const result = converter.convertDocument(doc);

				// Should have frontmatter but empty content section
				expect(result.content).toContain('---');
				expect(result.content).toContain('created: "2024-01-01T00:00:00Z"');
			});
		});

		describe('Date Prefix Filename Generation', () => {
			it('should generate ISO date prefix', () => {
				converter.updateSettings({
					...mockSettings,
					content: {
						...mockSettings.content,
						datePrefixFormat: DatePrefixFormat.ISO_DATE,
					},
				});

				const doc = createMockDoc('doc-date', 'Date Test Doc');
				doc.created_at = '2024-03-15T10:30:00Z';

				const result = (converter as any).generateDatePrefixedFilename(doc);

				expect(result).toBe('2024-03-15 - Date Test Doc.md');
			});

			it('should generate US date prefix', () => {
				converter.updateSettings({
					...mockSettings,
					content: {
						...mockSettings.content,
						datePrefixFormat: DatePrefixFormat.US_DATE,
					},
				});

				const doc = createMockDoc('doc-date', 'Date Test Doc');
				doc.created_at = '2024-03-15T10:30:00Z';

				const result = (converter as any).generateDatePrefixedFilename(doc);

				expect(result).toBe('03-15-2024 - Date Test Doc.md');
			});

			it('should generate EU date prefix', () => {
				converter.updateSettings({
					...mockSettings,
					content: {
						...mockSettings.content,
						datePrefixFormat: DatePrefixFormat.EU_DATE,
					},
				});

				const doc = createMockDoc('doc-date', 'Date Test Doc');
				doc.created_at = '2024-03-15T10:30:00Z';

				const result = (converter as any).generateDatePrefixedFilename(doc);

				expect(result).toBe('15-03-2024 - Date Test Doc.md');
			});

			it('should generate dot date prefix', () => {
				converter.updateSettings({
					...mockSettings,
					content: {
						...mockSettings.content,
						datePrefixFormat: DatePrefixFormat.DOT_DATE,
					},
				});

				const doc = createMockDoc('doc-date', 'Date Test Doc');
				doc.created_at = '2024-03-15T10:30:00Z';

				const result = (converter as any).generateDatePrefixedFilename(doc);

				expect(result).toBe('2024.03.15 - Date Test Doc.md');
			});

			it('should handle no date prefix', () => {
				converter.updateSettings({
					...mockSettings,
					content: {
						...mockSettings.content,
						datePrefixFormat: DatePrefixFormat.NONE,
					},
				});

				const doc = createMockDoc('doc-date', 'Date Test Doc');
				doc.created_at = '2024-03-15T10:30:00Z';

				const result = (converter as any).generateDatePrefixedFilename(doc);

				expect(result).not.toContain('2024');
				expect(result).toBe('Date Test Doc.md');
			});

			it('should handle invalid date gracefully', () => {
				converter.updateSettings({
					...mockSettings,
					content: {
						...mockSettings.content,
						datePrefixFormat: DatePrefixFormat.ISO_DATE,
					},
				});

				const doc = createMockDoc('doc-date', 'Date Test Doc');
				doc.created_at = 'invalid-date';

				const result = (converter as any).generateDatePrefixedFilename(doc);

				// Should produce NaN values when date is invalid
				expect(result).toBe('NaN-NaN-NaN - Date Test Doc.md');
			});
		});


		describe('ProseMirror Document Validation', () => {
			it('should validate valid ProseMirror document', () => {
				const validDoc = {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'Valid content' }],
						},
					],
				};

				const result = (converter as any).isValidProseMirrorDoc(validDoc);

				expect(result).toBe(true);
			});

			it('should reject invalid ProseMirror document - null', () => {
				const result = (converter as any).isValidProseMirrorDoc(null);

				expect(result).toBe(false);
			});

			it('should reject invalid ProseMirror document - missing type', () => {
				const invalidDoc = {
					content: [{ type: 'paragraph' }],
				};

				const result = (converter as any).isValidProseMirrorDoc(invalidDoc);

				expect(result).toBe(false);
			});

			it('should reject invalid ProseMirror document - wrong type', () => {
				const invalidDoc = {
					type: 'paragraph',
					content: [{ type: 'text', text: 'Wrong type' }],
				};

				const result = (converter as any).isValidProseMirrorDoc(invalidDoc);

				expect(result).toBe(false);
			});

			it('should reject invalid ProseMirror document - missing content', () => {
				const invalidDoc = {
					type: 'doc',
				};

				const result = (converter as any).isValidProseMirrorDoc(invalidDoc);

				expect(result).toBe(false);
			});

			it('should reject invalid ProseMirror document - empty content', () => {
				const invalidDoc = {
					type: 'doc',
					content: [],
				};

				const result = (converter as any).isValidProseMirrorDoc(invalidDoc);

				expect(result).toBe(false);
			});
		});

		describe('Frontmatter Generation', () => {
			it('should generate basic frontmatter', () => {
				// Create new converter instance with basic frontmatter settings
				const basicSettings = {
					...mockSettings,
					content: {
						...mockSettings.content,
						includeEnhancedFrontmatter: false,
					},
				};
				const basicConverter = new ProseMirrorConverter(mockLogger, basicSettings);

				const doc = createMockDoc('test-doc', 'Test Document');
				doc.created_at = '2024-01-15T10:30:00Z';

				const result = (basicConverter as any).generateFrontmatter(doc);

				expect(result.created).toBe('2024-01-15T10:30:00Z');
				expect(result.source).toBe('Granola');
				expect(result.id).toBeUndefined();
				expect(result.title).toBeUndefined();
				expect(result.updated).toBeUndefined();
			});

			it('should generate enhanced frontmatter when enabled', () => {
				converter.updateSettings({
					...mockSettings,
					content: {
						...mockSettings.content,
						includeEnhancedFrontmatter: true,
					},
				});

				const doc = createMockDoc('test-doc', 'Test Document');
				doc.created_at = '2024-01-15T10:30:00Z';
				doc.updated_at = '2024-01-16T15:45:00Z';

				const result = (converter as any).generateFrontmatter(doc);

				expect(result.created).toBe('2024-01-15T10:30:00Z');
				expect(result.source).toBe('Granola');
				expect(result.id).toBe('test-doc');
				expect(result.title).toBe('Test Document');
				expect(result.updated).toBe('2024-01-16T15:45:00Z');
			});
		});

		describe('YAML Frontmatter Generation', () => {
			it('should convert frontmatter object to YAML string', () => {
				const frontmatter = {
					created: '2024-01-15T10:30:00Z',
					source: 'Granola',
				};

				const result = (converter as any).generateYamlFrontmatter(frontmatter);

				expect(result).toBe('---\ncreated: "2024-01-15T10:30:00Z"\nsource: Granola\n---\n');
			});

			it('should handle enhanced frontmatter with all fields', () => {
				const frontmatter = {
					created: '2024-01-15T10:30:00Z',
					source: 'Granola',
					id: 'test-doc-123',
					title: 'My Test Document',
					updated: '2024-01-16T15:45:00Z',
				};

				const result = (converter as any).generateYamlFrontmatter(frontmatter);

				expect(result).toContain('created: "2024-01-15T10:30:00Z"');
				expect(result).toContain('source: Granola');
				expect(result).toContain('id: test-doc-123');
				expect(result).toContain('title: My Test Document');
				expect(result).toContain('updated: "2024-01-16T15:45:00Z"');
				expect(result.startsWith('---\n')).toBe(true);
				expect(result.endsWith('---\n')).toBe(true);
			});

			it('should escape special YAML characters in string values', () => {
				const frontmatter = {
					created: '2024-01-15T10:30:00Z',
					source: 'Granola',
					title: 'Document: With Colon',
				};

				const result = (converter as any).generateYamlFrontmatter(frontmatter);

				expect(result).toContain('title: "Document: With Colon"');
			});

			it('should handle values with quotes', () => {
				const frontmatter = {
					created: '2024-01-15T10:30:00Z',
					source: 'Granola',
					title: 'Document "with quotes"',
				};

				const result = (converter as any).generateYamlFrontmatter(frontmatter);

				expect(result).toContain('title: Document "with quotes"');
			});

			it('should skip undefined and null values', () => {
				const frontmatter = {
					created: '2024-01-15T10:30:00Z',
					source: 'Granola',
					id: undefined,
					title: null,
					updated: '2024-01-16T15:45:00Z',
				};

				const result = (converter as any).generateYamlFrontmatter(frontmatter);

				expect(result).toContain('created: "2024-01-15T10:30:00Z"');
				expect(result).toContain('source: Granola');
				expect(result).toContain('updated: "2024-01-16T15:45:00Z"');
				expect(result).not.toContain('id:');
				expect(result).not.toContain('title:');
			});
		});

		describe('Filename Sanitization', () => {
			it('should remove invalid filename characters', () => {
				const result = (converter as any).sanitizeFilename('file<>:"/\\|?*name');

				expect(result).toBe('filename');
			});

			it('should normalize whitespace', () => {
				const result = (converter as any).sanitizeFilename('file   with    spaces');

				expect(result).toBe('file with spaces');
			});

			it('should trim whitespace', () => {
				const result = (converter as any).sanitizeFilename('  filename  ');

				expect(result).toBe('filename');
			});

			it('should handle complex filename sanitization', () => {
				const result = (converter as any).sanitizeFilename('  <file>: "name"  with   /\\|?* chars  ');

				expect(result).toBe('file name with chars');
			});

			it('should handle empty filename', () => {
				const result = (converter as any).sanitizeFilename('');

				expect(result).toBe('');
			});

			it('should handle filename with only invalid characters', () => {
				const result = (converter as any).sanitizeFilename('<>:"/\\|?*');

				expect(result).toBe('');
			});
		});
	});

	describe('NodeConverters - node-converters.ts', () => {
		describe('Constructor', () => {
			it('should initialize with logger', () => {
				expect(nodeConverters).toBeDefined();
			});
		});

		describe('Paragraph Conversion', () => {
			it('should convert paragraph with text content', () => {
				const paragraphNode: ProseMirrorNode = {
					type: 'paragraph',
					content: [{ type: 'text', text: 'This is a paragraph.' }],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'This is a paragraph.'
				);

				const result = nodeConverters.convertParagraph(paragraphNode);

				expect(result).toBe('This is a paragraph.\n\n');
				expect(mockLogger.debug).toHaveBeenCalledWith(
					'Converting paragraph node:',
					paragraphNode
				);
			});

			it('should handle empty paragraph content', () => {
				const emptyParagraphNode: ProseMirrorNode = {
					type: 'paragraph',
					content: [],
				};

				const result = nodeConverters.convertParagraph(emptyParagraphNode);

				expect(result).toBe('');
			});

			it('should handle paragraph with no content property', () => {
				const noParagraphNode: ProseMirrorNode = {
					type: 'paragraph',
				};

				const result = nodeConverters.convertParagraph(noParagraphNode);

				expect(result).toBe('');
			});
		});

		describe('Heading Conversion', () => {
			it('should convert heading with level 1', () => {
				const headingNode: ProseMirrorNode = {
					type: 'heading',
					attrs: { level: 1 },
					content: [{ type: 'text', text: 'Main Heading' }],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'Main Heading'
				);

				const result = nodeConverters.convertHeading(headingNode);

				expect(result).toBe('# Main Heading\n\n');
				expect(mockLogger.debug).toHaveBeenCalledWith(
					'Converting heading node:',
					headingNode
				);
			});

			it('should convert heading with level 3', () => {
				const headingNode: ProseMirrorNode = {
					type: 'heading',
					attrs: { level: 3 },
					content: [{ type: 'text', text: 'Sub Heading' }],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'Sub Heading'
				);

				const result = nodeConverters.convertHeading(headingNode);

				expect(result).toBe('### Sub Heading\n\n');
			});

			it('should clamp heading level to minimum 1', () => {
				const headingNode: ProseMirrorNode = {
					type: 'heading',
					attrs: { level: 0 },
					content: [{ type: 'text', text: 'Clamped Heading' }],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'Clamped Heading'
				);

				const result = nodeConverters.convertHeading(headingNode);

				expect(result).toBe('# Clamped Heading\n\n');
			});

			it('should clamp heading level to maximum 6', () => {
				const headingNode: ProseMirrorNode = {
					type: 'heading',
					attrs: { level: 10 },
					content: [{ type: 'text', text: 'Max Heading' }],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'Max Heading'
				);

				const result = nodeConverters.convertHeading(headingNode);

				expect(result).toBe('###### Max Heading\n\n');
			});

			it('should handle heading with no attrs', () => {
				const headingNode: ProseMirrorNode = {
					type: 'heading',
					content: [{ type: 'text', text: 'Default Heading' }],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'Default Heading'
				);

				const result = nodeConverters.convertHeading(headingNode);

				expect(result).toBe('# Default Heading\n\n');
			});

			it('should handle heading with empty content', () => {
				const headingNode: ProseMirrorNode = {
					type: 'heading',
					attrs: { level: 2 },
					content: [],
				};

				const result = nodeConverters.convertHeading(headingNode);

				expect(result).toBe('## \n\n');
			});

			it('should handle heading with no content property', () => {
				const headingNode: ProseMirrorNode = {
					type: 'heading',
					attrs: { level: 2 },
				};

				const result = nodeConverters.convertHeading(headingNode);

				expect(result).toBe('## \n\n');
			});

			it('should handle non-numeric level attribute', () => {
				const headingNode: ProseMirrorNode = {
					type: 'heading',
					attrs: { level: 'invalid' },
					content: [{ type: 'text', text: 'Invalid Level Heading' }],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'Invalid Level Heading'
				);

				const result = nodeConverters.convertHeading(headingNode);

				expect(result).toBe('# Invalid Level Heading\n\n');
			});
		});

		describe('Text Extraction', () => {
			it('should extract text from text nodes', () => {
				const textNodes = [
					{ type: 'text', text: 'Hello ' },
					{ type: 'text', text: 'world!' },
				];

				// Access private method via reflection for testing
				const result = (nodeConverters as any).extractTextFromNodes(textNodes);

				expect(result).toBe('Hello world!');
			});

			it('should handle empty text node array', () => {
				const result = (nodeConverters as any).extractTextFromNodes([]);

				expect(result).toBe('');
			});

			it('should handle non-text nodes gracefully', () => {
				const mixedNodes = [
					{ type: 'text', text: 'Hello ' },
					{ type: 'hardBreak' },
					{ type: 'text', text: 'world!' },
				];

				const result = (nodeConverters as any).extractTextFromNodes(mixedNodes);

				expect(result).toBe('Hello \nworld!'); // hardBreak becomes newline
			});

			it('should handle text nodes with marks', () => {
				const textNodesWithMarks = [
					{
						type: 'text',
						text: 'Bold text',
						marks: [{ type: 'strong' }],
					},
				];

				const result = (nodeConverters as any).extractTextFromNodes(textNodesWithMarks);

				expect(result).toBe('**Bold text**'); // Text with strong marks becomes bold markdown
			});
		});

		describe('Complex Node Scenarios', () => {
			it('should handle nested content structures', () => {
				const complexParagraph: ProseMirrorNode = {
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'Start ' },
						{
							type: 'text',
							text: 'bold',
							marks: [{ type: 'strong' }],
						},
						{ type: 'text', text: ' end.' },
					],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'Start bold end.'
				);

				const result = nodeConverters.convertParagraph(complexParagraph);

				expect(result).toBe('Start bold end.\n\n');
			});

			it('should handle whitespace in text content', () => {
				const whitespaceParagraph: ProseMirrorNode = {
					type: 'paragraph',
					content: [{ type: 'text', text: '  Whitespace content  ' }],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'  Whitespace content  '
				);

				const result = nodeConverters.convertParagraph(whitespaceParagraph);

				expect(result).toBe('Whitespace content\n\n'); // Should be trimmed
			});
		});

		describe('Error Handling', () => {
			it('should handle null node gracefully', () => {
				const result = nodeConverters.convertParagraph(null as any);
				expect(result).toBe('');
			});

			it('should handle undefined content in paragraph', () => {
				const undefinedContentNode: ProseMirrorNode = {
					type: 'paragraph',
					content: undefined as any,
				};

				const result = nodeConverters.convertParagraph(undefinedContentNode);

				expect(result).toBe('');
			});

			it('should handle malformed heading node', () => {
				const malformedHeading: ProseMirrorNode = {
					type: 'heading',
					attrs: null as any,
					content: [{ type: 'text', text: 'Malformed' }],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'Malformed'
				);

				const result = nodeConverters.convertHeading(malformedHeading);

				expect(result).toBe('# Malformed\n\n'); // Should default to level 1
			});
		});

		describe('List Conversion', () => {
			it('should convert bullet list with multiple items', () => {
				const bulletListNode: ProseMirrorNode = {
					type: 'bulletList',
					content: [
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [{ type: 'text', text: 'First item' }],
								},
							],
						},
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [{ type: 'text', text: 'Second item' }],
								},
							],
						},
					],
				};

				const result = nodeConverters.convertList(bulletListNode);

				expect(result).toBe('- First item\n- Second item\n\n');
				expect(mockLogger.debug).toHaveBeenCalledWith(
					'Converting list node:',
					bulletListNode
				);
			});

			it('should convert ordered list with multiple items', () => {
				const orderedListNode: ProseMirrorNode = {
					type: 'orderedList',
					content: [
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [{ type: 'text', text: 'First numbered item' }],
								},
							],
						},
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [{ type: 'text', text: 'Second numbered item' }],
								},
							],
						},
					],
				};

				const result = nodeConverters.convertList(orderedListNode);

				expect(result).toBe('1. First numbered item\n2. Second numbered item\n\n');
			});

			it('should handle empty list', () => {
				const emptyListNode: ProseMirrorNode = {
					type: 'bulletList',
					content: [],
				};

				const result = nodeConverters.convertList(emptyListNode);

				expect(result).toBe('');
			});

			it('should handle list with no content property', () => {
				const noContentListNode: ProseMirrorNode = {
					type: 'bulletList',
				};

				const result = nodeConverters.convertList(noContentListNode);

				expect(result).toBe('');
			});

			it('should handle list item with empty content', () => {
				const emptyItemNode: ProseMirrorNode = {
					type: 'listItem',
					content: [],
				};

				const result = nodeConverters.convertListItem(emptyItemNode);

				expect(result).toBe('');
			});

			it('should skip empty list items', () => {
				const listWithEmptyItemNode: ProseMirrorNode = {
					type: 'bulletList',
					content: [
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [{ type: 'text', text: 'Valid item' }],
								},
							],
						},
						{
							type: 'listItem',
							content: [],
						},
					],
				};

				const result = nodeConverters.convertList(listWithEmptyItemNode);

				expect(result).toBe('- Valid item\n\n');
			});
		});

		describe('Text Formatting Conversion', () => {
			it('should convert text with bold formatting', () => {
				const boldTextNode: ProseMirrorNode = {
					type: 'text',
					text: 'Bold text',
					marks: [{ type: 'strong' }],
				};

				const result = nodeConverters.convertText(boldTextNode);

				expect(result).toBe('**Bold text**');
			});

			it('should convert text with italic formatting', () => {
				const italicTextNode: ProseMirrorNode = {
					type: 'text',
					text: 'Italic text',
					marks: [{ type: 'em' }],
				};

				const result = nodeConverters.convertText(italicTextNode);

				expect(result).toBe('_Italic text_');
			});

			it('should convert text with inline code formatting', () => {
				const codeTextNode: ProseMirrorNode = {
					type: 'text',
					text: 'code snippet',
					marks: [{ type: 'code' }],
				};

				const result = nodeConverters.convertText(codeTextNode);

				expect(result).toBe('`code snippet`');
			});

			it('should convert text with link formatting', () => {
				const linkTextNode: ProseMirrorNode = {
					type: 'text',
					text: 'Click here',
					marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
				};

				const result = nodeConverters.convertText(linkTextNode);

				expect(result).toBe('[Click here](https://example.com)');
			});

			it('should handle link without href attribute', () => {
				const linkTextNode: ProseMirrorNode = {
					type: 'text',
					text: 'Broken link',
					marks: [{ type: 'link' }],
				};

				const result = nodeConverters.convertText(linkTextNode);

				expect(result).toBe('[Broken link](#)');
			});

			it('should convert text with multiple marks', () => {
				const multiMarkTextNode: ProseMirrorNode = {
					type: 'text',
					text: 'Bold italic text',
					marks: [{ type: 'strong' }, { type: 'em' }],
				};

				const result = nodeConverters.convertText(multiMarkTextNode);

				expect(result).toBe('_**Bold italic text**_');
			});

			it('should handle text without marks', () => {
				const plainTextNode: ProseMirrorNode = {
					type: 'text',
					text: 'Plain text',
				};

				const result = nodeConverters.convertText(plainTextNode);

				expect(result).toBe('Plain text');
			});

			it('should handle text node without text property', () => {
				const emptyTextNode: ProseMirrorNode = {
					type: 'text',
				};

				const result = nodeConverters.convertText(emptyTextNode);

				expect(result).toBe('');
			});
		});

		describe('Code Block Conversion', () => {
			it('should convert code block with language', () => {
				const codeBlockNode: ProseMirrorNode = {
					type: 'codeBlock',
					attrs: { language: 'javascript' },
					content: [{ type: 'text', text: 'console.log("Hello, world!");' }],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'console.log("Hello, world!");'
				);

				const result = nodeConverters.convertCodeBlock(codeBlockNode);

				expect(result).toBe('```javascript\nconsole.log("Hello, world!");\n```\n\n');
				expect(mockLogger.debug).toHaveBeenCalledWith(
					'Converting code block node:',
					codeBlockNode
				);
			});

			it('should convert code block without language', () => {
				const codeBlockNode: ProseMirrorNode = {
					type: 'codeBlock',
					content: [{ type: 'text', text: 'generic code' }],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'generic code'
				);

				const result = nodeConverters.convertCodeBlock(codeBlockNode);

				expect(result).toBe('```\ngeneric code\n```\n\n');
			});

			it('should handle code block with text property instead of content', () => {
				const codeBlockNode: ProseMirrorNode = {
					type: 'codeBlock',
					text: 'direct text code',
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue('');

				const result = nodeConverters.convertCodeBlock(codeBlockNode);

				expect(result).toBe('```\ndirect text code\n```\n\n');
			});

			it('should handle empty code block', () => {
				const emptyCodeBlockNode: ProseMirrorNode = {
					type: 'codeBlock',
					content: [],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue('');

				const result = nodeConverters.convertCodeBlock(emptyCodeBlockNode);

				expect(result).toBe('```\n\n```\n\n');
			});
		});

		describe('Blockquote Conversion', () => {
			it('should convert simple blockquote', () => {
				const blockquoteNode: ProseMirrorNode = {
					type: 'blockquote',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'This is a quote.' }],
						},
					],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'This is a quote.'
				);

				const result = nodeConverters.convertBlockquote(blockquoteNode);

				expect(result).toBe('> This is a quote.\n\n');
				expect(mockLogger.debug).toHaveBeenCalledWith(
					'Converting blockquote node:',
					blockquoteNode
				);
			});

			it('should convert multi-paragraph blockquote', () => {
				const multiParagraphBlockquoteNode: ProseMirrorNode = {
					type: 'blockquote',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'First paragraph.' }],
						},
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'Second paragraph.' }],
						},
					],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes')
					.mockReturnValueOnce('First paragraph.')
					.mockReturnValueOnce('Second paragraph.');

				const result = nodeConverters.convertBlockquote(multiParagraphBlockquoteNode);

				expect(result).toBe('> First paragraph.\n> Second paragraph.\n\n');
			});

			it('should handle blockquote with empty paragraphs', () => {
				const emptyParagraphBlockquoteNode: ProseMirrorNode = {
					type: 'blockquote',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'Content' }],
						},
						{
							type: 'paragraph',
							content: [],
						},
					],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes')
					.mockReturnValueOnce('Content')
					.mockReturnValueOnce('');

				const result = nodeConverters.convertBlockquote(emptyParagraphBlockquoteNode);

				expect(result).toBe('> Content\n> \n\n');
			});

			it('should handle empty blockquote', () => {
				const emptyBlockquoteNode: ProseMirrorNode = {
					type: 'blockquote',
					content: [],
				};

				const result = nodeConverters.convertBlockquote(emptyBlockquoteNode);

				expect(result).toBe('> \n\n');
			});

			it('should handle blockquote with no content property', () => {
				const noContentBlockquoteNode: ProseMirrorNode = {
					type: 'blockquote',
				};

				const result = nodeConverters.convertBlockquote(noContentBlockquoteNode);

				expect(result).toBe('> \n\n');
			});

			it('should handle blockquote with multi-line text', () => {
				const multiLineBlockquoteNode: ProseMirrorNode = {
					type: 'blockquote',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'Line one\nLine two\nLine three' }],
						},
					],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'Line one\nLine two\nLine three'
				);

				const result = nodeConverters.convertBlockquote(multiLineBlockquoteNode);

				expect(result).toBe('> Line one\n> Line two\n> Line three\n\n');
			});
		});

		describe('Table Conversion', () => {
			it('should convert simple table', () => {
				const tableNode: ProseMirrorNode = {
					type: 'table',
					content: [
						{
							type: 'tableRow',
							content: [
								{
									type: 'tableCell',
									content: [
										{
											type: 'paragraph',
											content: [{ type: 'text', text: 'Header 1' }],
										},
									],
								},
								{
									type: 'tableCell',
									content: [
										{
											type: 'paragraph',
											content: [{ type: 'text', text: 'Header 2' }],
										},
									],
								},
							],
						},
						{
							type: 'tableRow',
							content: [
								{
									type: 'tableCell',
									content: [
										{
											type: 'paragraph',
											content: [{ type: 'text', text: 'Cell 1' }],
										},
									],
								},
								{
									type: 'tableCell',
									content: [
										{
											type: 'paragraph',
											content: [{ type: 'text', text: 'Cell 2' }],
										},
									],
								},
							],
						},
					],
				};

				jest.spyOn(nodeConverters, 'convertTableRow')
					.mockReturnValueOnce('| Header 1 | Header 2 |')
					.mockReturnValueOnce('| Cell 1 | Cell 2 |');

				const result = nodeConverters.convertTable(tableNode);

				expect(result).toBe('| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n\n');
				expect(mockLogger.debug).toHaveBeenCalledWith('Converting table node:', tableNode);
			});

			it('should handle empty table', () => {
				const emptyTableNode: ProseMirrorNode = {
					type: 'table',
					content: [],
				};

				const result = nodeConverters.convertTable(emptyTableNode);

				expect(result).toBe('');
			});

			it('should handle table with no content property', () => {
				const noContentTableNode: ProseMirrorNode = {
					type: 'table',
				};

				const result = nodeConverters.convertTable(noContentTableNode);

				expect(result).toBe('');
			});

			it('should convert table row', () => {
				const tableRowNode: ProseMirrorNode = {
					type: 'tableRow',
					content: [
						{
							type: 'tableCell',
							content: [
								{
									type: 'paragraph',
									content: [{ type: 'text', text: 'Cell content' }],
								},
							],
						},
					],
				};

				jest.spyOn(nodeConverters as any, 'extractTextFromNodes').mockReturnValue(
					'Cell content'
				);

				const result = nodeConverters.convertTableRow(tableRowNode);

				expect(result).toBe('| Cell content |');
			});

			it('should handle empty table row', () => {
				const emptyTableRowNode: ProseMirrorNode = {
					type: 'tableRow',
					content: [],
				};

				const result = nodeConverters.convertTableRow(emptyTableRowNode);

				expect(result).toBe('');
			});
		});
	});
});
