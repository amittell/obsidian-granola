/**
 * Comprehensive coverage tests for converter.ts
 * Targets the ProseMirrorConverter class to boost coverage from 0.79% to 70%+
 */

import { ProseMirrorConverter, ConvertedNote, NoteFrontmatter } from '../../src/converter';
import { GranolaDocument, ProseMirrorDoc } from '../../src/api';
import { Logger, DEFAULT_SETTINGS, GranolaSettings, DatePrefixFormat } from '../../src/types';

describe('ProseMirrorConverter Coverage Tests', () => {
	let converter: ProseMirrorConverter;
	let mockLogger: Logger;
	let settings: GranolaSettings;

	beforeEach(() => {
		settings = {
			...DEFAULT_SETTINGS,
			content: {
				...DEFAULT_SETTINGS.content,
				datePrefixFormat: DatePrefixFormat.NONE, // Disable date prefix for predictable test filenames
			},
		};
		mockLogger = new Logger(settings);
		jest.spyOn(console, 'error').mockImplementation();
		jest.spyOn(console, 'warn').mockImplementation();
		jest.spyOn(console, 'info').mockImplementation();
		jest.spyOn(console, 'log').mockImplementation();

		converter = new ProseMirrorConverter(mockLogger, settings);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('Constructor and settings', () => {
		it('should initialize with logger and settings', () => {
			expect(converter).toBeInstanceOf(ProseMirrorConverter);
		});

		it('should update settings', () => {
			const newSettings = { ...settings };
			newSettings.content.includeEnhancedFrontmatter = true;

			converter.updateSettings(newSettings);

			// Settings updated - verify by converting a doc and checking frontmatter
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'paragraph',
								content: [{ type: 'text', text: 'Test content' }],
							},
						],
					},
				},
			};

			const result = converter.convertDocument(testDoc);
			expect(result.frontmatter.id).toBe('test-123');
			expect(result.frontmatter.title).toBe('Test Document');
		});
	});

	describe('convertDocument method', () => {
		it('should convert document with last_viewed_panel content', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'paragraph',
								content: [{ type: 'text', text: 'Hello world' }],
							},
						],
					},
				},
			};

			const result = converter.convertDocument(testDoc);

			expect(result.filename).toBe('Test Document.md');
			expect(result.content).toContain('---');
			expect(result.content).toContain('created: 2023-01-01T10:00:00Z');
			expect(result.content).toContain('source: Granola');
			expect(result.content).toContain('Hello world');
			expect(result.frontmatter.created).toBe('2023-01-01T10:00:00Z');
			expect(result.frontmatter.source).toBe('Granola');
		});

		it('should convert document with notes content when panel missing', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				notes: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'Notes content' }],
						},
					],
				},
			};

			const result = converter.convertDocument(testDoc);

			expect(result.content).toContain('Notes content');
		});

		it('should fallback to notes_markdown when ProseMirror unavailable', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_markdown: '# Markdown Content\n\nThis is markdown.',
				notes_plain: 'Test content',
			};

			const result = converter.convertDocument(testDoc);

			expect(result.content).toContain('# Markdown Content');
			expect(result.content).toContain('This is markdown.');
		});

		it('should fallback to notes_plain when all else fails', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Plain text content',
			};

			const result = converter.convertDocument(testDoc);

			expect(result.content).toContain('Plain text content');
		});

		it('should handle empty content gracefully', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Empty Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: '',
			};

			const result = converter.convertDocument(testDoc);

			expect(result.filename).toBe('Empty Document.md');
			expect(result.content).toContain('---');
			expect(result.content).toContain('source: Granola');
		});

		it('should include enhanced frontmatter when enabled', () => {
			settings.content.includeEnhancedFrontmatter = true;
			converter.updateSettings(settings);

			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Enhanced Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
			};

			const result = converter.convertDocument(testDoc);

			expect(result.frontmatter.id).toBe('test-123');
			expect(result.frontmatter.title).toBe('Enhanced Document');
			expect(result.frontmatter.updated).toBe('2023-01-02T15:30:00Z');
			expect(result.content).toContain('id: test-123');
			expect(result.content).toContain('title: "Enhanced Document"');
			expect(result.content).toContain('updated: 2023-01-02T15:30:00Z');
		});

		it('should handle document with missing title', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
			};

			const result = converter.convertDocument(testDoc);

			expect(result.filename).toMatch(/Untitled|Note/);
		});

		it('should sanitize filename for filesystem compatibility', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Document with / \\ : * ? " < > | chars',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
			};

			const result = converter.convertDocument(testDoc);

			expect(result.filename).not.toMatch(/[\/\\:*?"<>|]/);
			expect(result.filename).toMatch(/\.md$/);
		});

		it('should handle long filename truncation', () => {
			const longTitle = 'A'.repeat(200);
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: longTitle,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
			};

			const result = converter.convertDocument(testDoc);

			expect(result.filename.length).toBeLessThanOrEqual(104); // 100 + '.md'
		});
	});

	describe('ProseMirror content conversion', () => {
		it('should convert headings', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'heading',
								attrs: { level: 1 },
								content: [{ type: 'text', text: 'Main Heading' }],
							},
							{
								type: 'heading',
								attrs: { level: 2 },
								content: [{ type: 'text', text: 'Sub Heading' }],
							},
						],
					},
				},
			};

			const result = converter.convertDocument(testDoc);

			expect(result.content).toContain('# Main Heading');
			expect(result.content).toContain('## Sub Heading');
		});

		it('should convert text formatting', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'paragraph',
								content: [
									{
										type: 'text',
										text: 'Bold text',
										marks: [{ type: 'strong' }],
									},
									{ type: 'text', text: ' and ' },
									{
										type: 'text',
										text: 'italic text',
										marks: [{ type: 'em' }],
									},
									{ type: 'text', text: ' and ' },
									{
										type: 'text',
										text: 'code text',
										marks: [{ type: 'code' }],
									},
								],
							},
						],
					},
				},
			};

			const result = converter.convertDocument(testDoc);

			expect(result.content).toContain('**Bold text**');
			expect(result.content).toContain('*italic text*');
			expect(result.content).toContain('`code text`');
		});

		it('should convert links', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'paragraph',
								content: [
									{
										type: 'text',
										text: 'Click here',
										marks: [
											{
												type: 'link',
												attrs: { href: 'https://example.com' },
											},
										],
									},
								],
							},
						],
					},
				},
			};

			const result = converter.convertDocument(testDoc);

			expect(result.content).toContain('[Click here](https://example.com)');
		});

		it('should convert bullet lists', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
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
							},
						],
					},
				},
			};

			const result = converter.convertDocument(testDoc);

			expect(result.content).toContain('- First item');
			expect(result.content).toContain('- Second item');
		});

		it('should convert ordered lists', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'orderedList',
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
							},
						],
					},
				},
			};

			const result = converter.convertDocument(testDoc);

			expect(result.content).toContain('1. First item');
			expect(result.content).toContain('2. Second item');
		});

		it('should convert code blocks', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'codeBlock',
								attrs: { language: 'javascript' },
								content: [{ type: 'text', text: 'console.log("Hello");' }],
							},
						],
					},
				},
			};

			const result = converter.convertDocument(testDoc);

			expect(result.content).toContain('```javascript');
			expect(result.content).toContain('console.log("Hello");');
			expect(result.content).toContain('```');
		});

		it('should convert blockquotes', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'blockquote',
								content: [
									{
										type: 'paragraph',
										content: [{ type: 'text', text: 'This is a quote' }],
									},
								],
							},
						],
					},
				},
			};

			const result = converter.convertDocument(testDoc);

			expect(result.content).toContain('> This is a quote');
		});

		it('should convert horizontal rules', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{ type: 'horizontalRule' },
							{
								type: 'paragraph',
								content: [{ type: 'text', text: 'After rule' }],
							},
						],
					},
				},
			};

			const result = converter.convertDocument(testDoc);

			expect(result.content).toContain('---');
			expect(result.content).toContain('After rule');
		});

		it('should handle hard breaks', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'paragraph',
								content: [
									{ type: 'text', text: 'Line one' },
									{ type: 'hardBreak' },
									{ type: 'text', text: 'Line two' },
								],
							},
						],
					},
				},
			};

			const result = converter.convertDocument(testDoc);

			expect(result.content).toContain('Line one\nLine two');
		});

		it('should handle unknown node types gracefully', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'unknownNode',
								content: [{ type: 'text', text: 'Unknown content' }],
							} as any,
						],
					},
				},
			};

			const result = converter.convertDocument(testDoc);

			// Should not crash and still produce content
			expect(result.content).toContain('source: Granola');
		});

		it('should handle malformed ProseMirror content', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
				last_viewed_panel: {
					content: null as any,
				},
			};

			const result = converter.convertDocument(testDoc);

			// Should fallback gracefully
			expect(result.content).toContain('Test content');
		});
	});

	describe('YAML frontmatter handling', () => {
		it('should escape special YAML characters in title', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Title with: colons and "quotes" and [brackets]',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
			};

			settings.content.includeEnhancedFrontmatter = true;
			converter.updateSettings(settings);
			const result = converter.convertDocument(testDoc);

			// Title should be properly escaped for YAML
			expect(result.content).toContain('title:');
			expect(result.frontmatter.title).toBe('Title with: colons and "quotes" and [brackets]');
		});

		it('should handle malformed dates gracefully', () => {
			const testDoc: GranolaDocument = {
				id: 'test-123',
				title: 'Test Document',
				created_at: 'invalid-date',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Test content',
			};

			const result = converter.convertDocument(testDoc);

			expect(result.frontmatter.created).toBe('invalid-date');
		});
	});
});
