import { jest } from '@jest/globals';
import { ProseMirrorConverter } from '../../src/converter';
import { GranolaDocument } from '../../src/api';
import { createMockLogger } from '../helpers';
import { DEFAULT_SETTINGS, GranolaSettings } from '../../src/types';

describe('ProseMirrorConverter', () => {
	let converter: ProseMirrorConverter;
	let mockSettings: GranolaSettings;

	beforeEach(() => {
		mockSettings = { ...DEFAULT_SETTINGS };
		converter = new ProseMirrorConverter(createMockLogger(), mockSettings);
	});

	describe('convertDocument', () => {
		const mockDocument: GranolaDocument = {
			id: 'test-doc-id',
			title: 'Test Document',
			created_at: '2024-01-01T10:00:00Z',
			updated_at: '2024-01-01T11:00:00Z',
			user_id: 'test-user-id',
			notes: {
				type: 'doc',
				content: [
					{
						type: 'heading',
						attrs: { level: 1 },
						content: [{ type: 'text', text: 'Test Heading' }],
					},
					{
						type: 'paragraph',
						content: [{ type: 'text', text: 'Test content' }],
					},
				],
			},
			notes_plain: 'Test Heading\nTest content',
			notes_markdown: '# Test Heading\nTest content',
		};

		it('should convert document with complete structure', () => {
			const result = converter.convertDocument(mockDocument);

			expect(result.filename).toBe('2024-01-01 - Test Document.md');
			expect(result.content).toContain('---');
			expect(result.content).toContain('created: 2024-01-01T10:00:00Z');
			expect(result.content).toContain('source: Granola');
			expect(result.content).toContain('# Test Heading');
			expect(result.content).toContain('Test content');
			expect(result.frontmatter).toEqual({
				created: '2024-01-01T10:00:00Z',
				source: 'Granola',
			});
		});

		it('should handle document without title', () => {
			const docWithoutTitle = { ...mockDocument, title: '' };
			const result = converter.convertDocument(docWithoutTitle);

			expect(result.filename).toBe('2024-01-01 - Untitled-test-doc-id.md');
			// Frontmatter no longer includes title field
			expect(result.frontmatter.created).toBe('2024-01-01T10:00:00Z');
			expect(result.frontmatter.source).toBe('Granola');
		});

		it('should handle empty document content', () => {
			const emptyDoc = {
				...mockDocument,
				notes: { type: 'doc' as const, content: [] },
				notes_plain: '',
				notes_markdown: '',
			};
			const result = converter.convertDocument(emptyDoc);

			expect(result.content).toContain('---');
			expect(result.content).toContain('# Test Document'); // Now creates placeholder content with title
			expect(result.content).toContain(
				'This document appears to have no extractable content'
			);
		});
	});

	describe('convertNode - headings', () => {
		it('should convert heading nodes correctly', () => {
			const headingNode = {
				type: 'heading',
				attrs: { level: 2 },
				content: [{ type: 'text', text: 'Section Title' }],
			};

			const result = (converter as any).convertNode(headingNode);
			expect(result).toBe('## Section Title');
		});

		it('should handle headings without content', () => {
			const emptyHeading = {
				type: 'heading',
				attrs: { level: 3 },
			};

			const result = (converter as any).convertNode(emptyHeading);
			expect(result).toBe('### ');
		});

		it('should limit heading level to 6', () => {
			const deepHeading = {
				type: 'heading',
				attrs: { level: 10 },
				content: [{ type: 'text', text: 'Deep Heading' }],
			};

			const result = (converter as any).convertNode(deepHeading);
			expect(result).toBe('###### Deep Heading');
		});
	});

	describe('convertNode - paragraphs', () => {
		it('should convert paragraph nodes', () => {
			const paragraphNode = {
				type: 'paragraph',
				content: [
					{ type: 'text', text: 'This is ' },
					{ type: 'text', text: 'bold', marks: [{ type: 'strong' }] },
					{ type: 'text', text: ' text.' },
				],
			};

			const result = (converter as any).convertNode(paragraphNode);
			expect(result).toBe('This is **bold** text.');
		});

		it('should handle empty paragraphs', () => {
			const emptyParagraph = { type: 'paragraph' };
			const result = (converter as any).convertNode(emptyParagraph);
			expect(result).toBe('');
		});
	});

	describe('convertNode - lists', () => {
		it('should convert bullet lists', () => {
			const bulletListNode = {
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

			const result = (converter as any).convertNode(bulletListNode);
			expect(result).toBe('- First item\n- Second item');
		});

		it('should convert ordered lists', () => {
			const orderedListNode = {
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
			};

			const result = (converter as any).convertNode(orderedListNode);
			expect(result).toBe('1. First item\n2. Second item');
		});

		it('should handle empty lists', () => {
			const emptyList = { type: 'bulletList' };
			const result = (converter as any).convertNode(emptyList);
			expect(result).toBe('');
		});
	});

	describe('convertNode - text formatting', () => {
		it('should handle bold text', () => {
			const boldText = {
				type: 'text',
				text: 'bold text',
				marks: [{ type: 'strong' }],
			};

			const result = (converter as any).convertNode(boldText);
			expect(result).toBe('**bold text**');
		});

		it('should handle italic text', () => {
			const italicText = {
				type: 'text',
				text: 'italic text',
				marks: [{ type: 'em' }],
			};

			const result = (converter as any).convertNode(italicText);
			expect(result).toBe('*italic text*');
		});

		it('should handle inline code', () => {
			const codeText = {
				type: 'text',
				text: 'console.log()',
				marks: [{ type: 'code' }],
			};

			const result = (converter as any).convertNode(codeText);
			expect(result).toBe('`console.log()`');
		});

		it('should handle links', () => {
			const linkText = {
				type: 'text',
				text: 'click here',
				marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
			};

			const result = (converter as any).convertNode(linkText);
			expect(result).toBe('[click here](https://example.com)');
		});

		it('should handle multiple marks', () => {
			const complexText = {
				type: 'text',
				text: 'example.com',
				marks: [
					{ type: 'strong' },
					{ type: 'link', attrs: { href: 'https://example.com' } },
				],
			};

			const result = (converter as any).convertNode(complexText);
			expect(result).toBe('[**example.com**](https://example.com)');
		});

		it('should handle links without href', () => {
			const linkWithoutHref = {
				type: 'text',
				text: 'broken link',
				marks: [{ type: 'link' }],
			};

			const result = (converter as any).convertNode(linkWithoutHref);
			expect(result).toBe('[broken link](#)');
		});

		it('should decode HTML entities in text', () => {
			const textWithEntities = {
				type: 'text',
				text: 'Action Items &amp; Next Steps',
			};

			const result = (converter as any).convertNode(textWithEntities);
			expect(result).toBe('Action Items & Next Steps');
		});

		it('should decode multiple HTML entities', () => {
			const textWithMultipleEntities = {
				type: 'text',
				text: '&lt;div&gt; &quot;Hello&quot; &amp; &apos;World&apos; &mdash; &copy; 2024',
			};

			const result = (converter as any).convertNode(textWithMultipleEntities);
			expect(result).toBe('<div> "Hello" & \'World\' — © 2024');
		});

		it('should decode numeric HTML entities', () => {
			const textWithNumericEntities = {
				type: 'text',
				text: '&#65; &#x42; &#8212;',
			};

			const result = (converter as any).convertNode(textWithNumericEntities);
			expect(result).toBe('A B —');
		});

		it('should preserve HTML entities in formatted text', () => {
			const boldTextWithEntities = {
				type: 'text',
				text: 'Q&amp;A Session',
				marks: [{ type: 'strong' }],
			};

			const result = (converter as any).convertNode(boldTextWithEntities);
			expect(result).toBe('**Q&A Session**');
		});
	});

	describe('convertNode - code blocks', () => {
		it('should convert code blocks with language', () => {
			const codeBlockNode = {
				type: 'codeBlock',
				attrs: { language: 'javascript' },
				content: [
					{ type: 'text', text: 'function hello() {\n  console.log("Hello!");\n}' },
				],
			};

			const result = (converter as any).convertNode(codeBlockNode);
			expect(result).toBe(
				'```javascript\nfunction hello() {\n  console.log("Hello!");\n}\n```'
			);
		});

		it('should convert code blocks without language', () => {
			const codeBlockNode = {
				type: 'codeBlock',
				content: [{ type: 'text', text: 'some code' }],
			};

			const result = (converter as any).convertNode(codeBlockNode);
			expect(result).toBe('```\nsome code\n```');
		});

		it('should handle empty code blocks', () => {
			const emptyCodeBlock = {
				type: 'codeBlock',
			};

			const result = (converter as any).convertNode(emptyCodeBlock);
			expect(result).toBe('```\n\n```');
		});
	});

	describe('convertNode - blockquotes', () => {
		it('should convert blockquotes', () => {
			const blockquoteNode = {
				type: 'blockquote',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: 'This is a quote' }],
					},
				],
			};

			const result = (converter as any).convertNode(blockquoteNode);
			expect(result).toBe('> This is a quote');
		});

		it('should handle multi-line blockquotes', () => {
			const multiLineBlockquote = {
				type: 'blockquote',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: 'Line one\nLine two' }],
					},
				],
			};

			const result = (converter as any).convertNode(multiLineBlockquote);
			expect(result).toBe('> Line one\n> Line two');
		});

		it('should handle empty blockquotes', () => {
			const emptyBlockquote = { type: 'blockquote' };
			const result = (converter as any).convertNode(emptyBlockquote);
			expect(result).toBe('> ');
		});
	});

	describe('convertNode - tables', () => {
		it('should convert simple tables', () => {
			const tableNode = {
				type: 'table',
				content: [
					{
						type: 'tableRow',
						content: [
							{ type: 'tableCell', content: [{ type: 'text', text: 'Header 1' }] },
							{ type: 'tableCell', content: [{ type: 'text', text: 'Header 2' }] },
						],
					},
					{
						type: 'tableRow',
						content: [
							{ type: 'tableCell', content: [{ type: 'text', text: 'Cell 1' }] },
							{ type: 'tableCell', content: [{ type: 'text', text: 'Cell 2' }] },
						],
					},
				],
			};

			const result = (converter as any).convertNode(tableNode);
			expect(result).toContain('| Header 1 | Header 2 |');
			expect(result).toContain('| --- | --- |');
			expect(result).toContain('| Cell 1 | Cell 2 |');
		});

		it('should handle empty tables', () => {
			const emptyTable = { type: 'table' };
			const result = (converter as any).convertNode(emptyTable);
			expect(result).toBe('');
		});

		it('should handle table rows with missing cells', () => {
			const tableRowNode = {
				type: 'tableRow',
			};

			const result = (converter as any).convertTableRow(tableRowNode);
			expect(result).toBe('|  |');
		});
	});

	describe('convertNode - misc elements', () => {
		it('should convert hard breaks', () => {
			const hardBreakNode = { type: 'hardBreak' };
			const result = (converter as any).convertNode(hardBreakNode);
			expect(result).toBe('\n');
		});

		it('should convert horizontal rules', () => {
			const hrNode = { type: 'horizontalRule' };
			const result = (converter as any).convertNode(hrNode);
			expect(result).toBe('---');
		});

		it('should handle unknown nodes with content', () => {
			const unknownNode = {
				type: 'unknown',
				content: [{ type: 'text', text: 'some content' }],
			};

			const result = (converter as any).convertNode(unknownNode);
			expect(result).toBe('some content');
		});

		it('should handle unknown nodes with text', () => {
			const unknownTextNode = {
				type: 'unknown',
				text: 'fallback text',
			};

			const result = (converter as any).convertNode(unknownTextNode);
			expect(result).toBe('fallback text');
		});

		it('should handle unknown nodes with neither content nor text', () => {
			const unknownEmptyNode = { type: 'unknown' };
			const result = (converter as any).convertNode(unknownEmptyNode);
			expect(result).toBe('');
		});
	});

	describe('sanitizeFilename', () => {
		it('should remove invalid characters', () => {
			const unsafeFilename = 'My Document: "Special" <Notes> | 2024';
			const result = (converter as any).sanitizeFilename(unsafeFilename);
			expect(result).toBe('My Document- -Special- -Notes- - 2024');
		});

		it('should normalize whitespace', () => {
			const whitespaceFilename = 'Multiple   spaces    here';
			const result = (converter as any).sanitizeFilename(whitespaceFilename);
			expect(result).toBe('Multiple spaces here');
		});

		it('should trim whitespace', () => {
			const paddedFilename = '  padded filename  ';
			const result = (converter as any).sanitizeFilename(paddedFilename);
			expect(result).toBe('padded filename');
		});

		it('should truncate long filenames', () => {
			const longFilename = 'A'.repeat(200);
			const result = (converter as any).sanitizeFilename(longFilename);
			expect(result).toBe('A'.repeat(100));
			expect(result.length).toBe(100);
		});

		it('should handle empty filename', () => {
			const result = (converter as any).sanitizeFilename('');
			expect(result).toBe('');
		});
	});

	describe('generateFrontmatter', () => {
		it('should create basic frontmatter when enhanced frontmatter is disabled', () => {
			mockSettings.content.includeEnhancedFrontmatter = false;
			converter.updateSettings(mockSettings);

			const doc: GranolaDocument = {
				id: 'test-id',
				title: 'Test Title',
				created_at: '2024-01-01T10:00:00Z',
				updated_at: '2024-01-01T11:00:00Z',
				content: { type: 'doc', content: [] },
			};

			const result = (converter as any).generateFrontmatter(doc);
			expect(result).toEqual({
				created: '2024-01-01T10:00:00Z',
				source: 'Granola',
			});
		});

		it('should create enhanced frontmatter when setting is enabled', () => {
			mockSettings.content.includeEnhancedFrontmatter = true;
			converter.updateSettings(mockSettings);

			const doc: GranolaDocument = {
				id: 'test-id',
				title: 'Test Title',
				created_at: '2024-01-01T10:00:00Z',
				updated_at: '2024-01-01T11:00:00Z',
				content: { type: 'doc', content: [] },
			};

			const result = (converter as any).generateFrontmatter(doc);
			expect(result).toEqual({
				id: 'test-id',
				title: 'Test Title',
				created: '2024-01-01T10:00:00Z',
				updated: '2024-01-01T11:00:00Z',
				source: 'Granola',
			});
		});

		it('should decode HTML entities in title for frontmatter', () => {
			mockSettings.content.includeEnhancedFrontmatter = true;
			converter = new ProseMirrorConverter(createMockLogger(), mockSettings);

			const docWithEncodedTitle: GranolaDocument = {
				id: 'test-id',
				title: 'RFP Updates &amp; Next Steps',
				created_at: '2024-01-01T10:00:00Z',
				updated_at: '2024-01-01T11:00:00Z',
				user_id: 'test-user',
				notes: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'Test content' }],
						},
					],
				},
			};

			const result = converter.convertDocument(docWithEncodedTitle);
			expect(result.frontmatter.title).toBe('RFP Updates & Next Steps');
			// Filename will have & sanitized to -
			expect(result.filename).toContain('RFP Updates - Next Steps');
		});

		it('should handle missing title in enhanced frontmatter', () => {
			mockSettings.content.includeEnhancedFrontmatter = true;
			converter.updateSettings(mockSettings);

			const doc: GranolaDocument = {
				id: 'test-id',
				title: '',
				created_at: '2024-01-01T10:00:00Z',
				updated_at: '2024-01-01T11:00:00Z',
				content: { type: 'doc' as const, content: [] },
			};

			const result = (converter as any).generateFrontmatter(doc);
			expect(result.title).toBe('Untitled');
		});
	});

	describe('generateFileContent', () => {
		it('should combine basic frontmatter and markdown', () => {
			const frontmatter = {
				created: '2024-01-01T10:00:00Z',
				source: 'Granola',
			};
			const markdown = '# Test Content\n\nSome text here.';

			const result = (converter as any).generateFileContent(frontmatter, markdown);

			expect(result).toContain('---');
			expect(result).toContain('created: 2024-01-01T10:00:00Z');
			expect(result).toContain('source: Granola');
			expect(result).toContain('# Test Content');
			expect(result).toContain('Some text here.');
		});

		it('should combine enhanced frontmatter and markdown', () => {
			const frontmatter = {
				id: 'test-id',
				title: 'Test Title',
				created: '2024-01-01T10:00:00Z',
				updated: '2024-01-01T11:00:00Z',
				source: 'Granola',
			};
			const markdown = '# Test Content\n\nSome text here.';

			const result = (converter as any).generateFileContent(frontmatter, markdown);

			expect(result).toContain('---');
			expect(result).toContain('id: test-id');
			expect(result).toContain('title: "Test Title"');
			expect(result).toContain('created: 2024-01-01T10:00:00Z');
			expect(result).toContain('updated: 2024-01-01T11:00:00Z');
			expect(result).toContain('source: Granola');
			expect(result).toContain('# Test Content');
			expect(result).toContain('Some text here.');
		});

		it('should escape quotes in title', () => {
			const frontmatter = {
				id: 'test-id',
				title: 'My "Special" Document',
				created: '2024-01-01T10:00:00Z',
				updated: '2024-01-01T11:00:00Z',
				source: 'Granola',
			};
			const markdown = 'Content';

			const result = (converter as any).generateFileContent(frontmatter, markdown);
			expect(result).toContain('title: "My \\"Special\\" Document"');
		});
	});

	describe('debug logging and content source selection', () => {
		it('should use last_viewed_panel.content when available and valid', () => {
			const docWithLastViewedPanel: GranolaDocument = {
				id: 'test-doc-id',
				title: 'Test Document',
				created_at: '2024-01-01T10:00:00Z',
				updated_at: '2024-01-01T11:00:00Z',
				user_id: 'test-user-id',
				notes_plain: 'Some plain text',
				notes_markdown: '# Markdown content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'paragraph',
								content: [{ type: 'text', text: 'Panel content' }],
							},
						],
					},
				},
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

			const result = converter.convertDocument(docWithLastViewedPanel);

			// Should use content from last_viewed_panel
			expect(result.content).toContain('Panel content');
			expect(result.content).not.toContain('Notes content');
		});

		it('should fallback to notes field when last_viewed_panel is empty', () => {
			const docWithEmptyPanel: GranolaDocument = {
				id: 'test-doc-id',
				title: 'Test Document',
				created_at: '2024-01-01T10:00:00Z',
				updated_at: '2024-01-01T11:00:00Z',
				user_id: 'test-user-id',
				notes_plain: 'Some plain text',
				notes_markdown: '# Markdown content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [], // Empty content
					},
				},
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

			const result = converter.convertDocument(docWithEmptyPanel);

			// Should fallback to notes field
			expect(result.content).toContain('Notes content');
		});

		it('should fallback to notes_markdown when ProseMirror conversions fail', () => {
			const docWithInvalidStructure: GranolaDocument = {
				id: 'test-doc-id',
				title: 'Test Document',
				created_at: '2024-01-01T10:00:00Z',
				updated_at: '2024-01-01T11:00:00Z',
				user_id: 'test-user-id',
				notes_plain: 'Some plain text',
				notes_markdown: '# Markdown fallback content',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: undefined,
					},
				},
				notes: {
					type: 'doc',
					content: undefined,
				},
			};

			const result = converter.convertDocument(docWithInvalidStructure);

			// Should fallback to notes_markdown
			expect(result.content).toContain('Markdown fallback content');
		});

		it('should use notes_plain as final fallback', () => {
			const docOnlyPlainText: GranolaDocument = {
				id: 'test-doc-id',
				title: 'Test Document',
				created_at: '2024-01-01T10:00:00Z',
				updated_at: '2024-01-01T11:00:00Z',
				user_id: 'test-user-id',
				notes_plain: 'Final fallback plain text',
				notes_markdown: '', // No markdown content
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: undefined,
					},
				},
				notes: {
					type: 'doc',
					content: undefined,
				},
			};

			const result = converter.convertDocument(docOnlyPlainText);

			// Should use plain text as final fallback
			expect(result.content).toContain('Final fallback plain text');
		});

		it('should handle document with no extractable content', () => {
			const emptyDoc: GranolaDocument = {
				id: 'test-doc-id',
				title: 'Empty Document',
				created_at: '2024-01-01T10:00:00Z',
				updated_at: '2024-01-01T11:00:00Z',
				user_id: 'test-user-id',
				notes: { type: 'doc', content: [] },
				notes_plain: '',
				notes_markdown: '',
			};

			const result = converter.convertDocument(emptyDoc);

			// Should create placeholder content
			expect(result.content).toContain('# Empty Document');
			expect(result.content).toContain(
				'This document appears to have no extractable content'
			);
		});
	});
});
