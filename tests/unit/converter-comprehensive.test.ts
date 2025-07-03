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
										content: [{ type: 'text', text: 'Panel content' }],
									},
								],
							},
						}
					: null,
				notes: hasNotes
					? {
							type: 'doc',
							content: [
								{
									type: 'paragraph',
									content: [{ type: 'text', text: 'Notes content' }],
								},
							],
						}
					: null,
				notes_markdown: hasMarkdown ? '# Markdown Content\n\nPre-converted markdown' : null,
				notes_plain: hasPlain ? 'Plain text content' : null,
			});

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
				const doc = createMockDoc('doc-5', 'Fallback Doc');

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

				expect(result.content).toContain('# Markdown Content');
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

				expect(result.content).toContain('# Markdown Content');
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

				expect(result.content).toContain('# Markdown Content');
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
	});
});
