import { isEmptyDocument, extractTextFromContent } from '../../src/utils/prosemirror';
import { GranolaDocument } from '../../src/api';

describe('ProseMirror Utils - isEmptyDocument', () => {
	let baseDocument: GranolaDocument;

	beforeEach(() => {
		baseDocument = {
			id: 'test-doc',
			title: 'Test Document',
			created_at: '2023-01-01T10:00:00Z',
			updated_at: '2023-01-02T15:30:00Z',
			user_id: 'user-123',
			notes_plain: 'This is a test document with content.',
			notes_markdown: '# Test\n\nThis is a test document with content.',
			notes: {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [
							{ type: 'text', text: 'This is a test document with content.' },
						],
					},
				],
			},
			last_viewed_panel: {
				content: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [
								{ type: 'text', text: 'This is a test document with content.' },
							],
						},
					],
				},
			},
		};
	});

	describe('empty document detection', () => {
		it('should detect empty documents with identical created/updated dates', () => {
			const emptyDoc: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-01T10:00:00Z', // Same as created_at
				notes_plain: '',
				notes_markdown: '',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: null,
			};

			expect(isEmptyDocument(emptyDoc)).toBe(true);
		});

		it('should not detect documents with different created/updated dates as empty if they have content', () => {
			const nonEmptyDoc: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z', // Different from created_at
			};

			expect(isEmptyDocument(nonEmptyDoc)).toBe(false);
		});

		it('should not detect documents with content as empty even if dates match', () => {
			const docWithContent: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-01T10:00:00Z', // Same as created_at
				notes_plain: 'This document has content',
			};

			expect(isEmptyDocument(docWithContent)).toBe(false);
		});

		it('should detect empty documents with no content in any field even with different dates', () => {
			const emptyDoc: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z', // Different dates
				notes_plain: '',
				notes_markdown: '',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: null,
			};

			expect(isEmptyDocument(emptyDoc)).toBe(true);
		});

		it('should detect documents with no content even if dates are same', () => {
			const emptyDoc: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-01T10:00:00Z', // Same dates
				notes_plain: '',
				notes_markdown: '',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: null,
			};

			expect(isEmptyDocument(emptyDoc)).toBe(true);
		});

		it('should not detect documents with last_viewed_panel content as empty', () => {
			const docWithLastViewedContent: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-01T10:00:00Z', // Same as created_at
				notes_plain: '',
				notes_markdown: '',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'paragraph',
								content: [{ type: 'text', text: 'Content in last viewed panel' }],
							},
						],
					},
				},
			};

			expect(isEmptyDocument(docWithLastViewedContent)).toBe(false);
		});

		it('should not detect documents with notes_plain content as empty', () => {
			const docWithPlainContent: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-01T10:00:00Z', // Same as created_at
				notes_plain: 'Plain text content',
				notes_markdown: '',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: null,
			};

			expect(isEmptyDocument(docWithPlainContent)).toBe(false);
		});

		it('should not detect documents with notes_markdown content as empty', () => {
			const docWithMarkdownContent: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-01T10:00:00Z', // Same as created_at
				notes_plain: '',
				notes_markdown: '# Markdown content',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: null,
			};

			expect(isEmptyDocument(docWithMarkdownContent)).toBe(false);
		});

		it('should not detect documents with notes.content as empty', () => {
			const docWithNotesContent: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-01T10:00:00Z', // Same as created_at
				notes_plain: '',
				notes_markdown: '',
				notes: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'Notes content' }],
						},
					],
				},
				last_viewed_panel: null,
			};

			expect(isEmptyDocument(docWithNotesContent)).toBe(false);
		});

		it('should handle documents with whitespace-only content as empty', () => {
			const docWithWhitespace: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z', // Different dates
				notes_plain: '   \t\n\r\n   ',
				notes_markdown: '\n\n\t\t\n',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: null,
			};

			expect(isEmptyDocument(docWithWhitespace)).toBe(true);
		});

		it('should handle documents with empty array content as empty', () => {
			const docWithEmptyArray: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z', // Different dates
				notes_plain: '',
				notes_markdown: '',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [], // Empty array
					},
				},
			};

			expect(isEmptyDocument(docWithEmptyArray)).toBe(true);
		});

		it('should handle documents with single empty element array as empty', () => {
			const docWithSingleEmptyElement: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z', // Different dates
				notes_plain: '',
				notes_markdown: '',
				notes: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [], // Empty paragraph
						},
					],
				},
				last_viewed_panel: null,
			};

			expect(isEmptyDocument(docWithSingleEmptyElement)).toBe(true);
		});

		it('should handle null/undefined content fields gracefully', () => {
			const docWithNullFields: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z', // Different dates
				notes_plain: null as any,
				notes_markdown: undefined as any,
				notes: null as any,
				last_viewed_panel: null,
			};

			expect(isEmptyDocument(docWithNullFields)).toBe(true);
		});

		it('should handle malformed ProseMirror content gracefully', () => {
			const docWithMalformedContent: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z', // Different dates
				notes_plain: '',
				notes_markdown: '',
				notes: {
					type: 'doc',
					content: 'invalid content' as any, // Invalid content type
				},
				last_viewed_panel: null,
			};

			expect(isEmptyDocument(docWithMalformedContent)).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('should handle documents with complex ProseMirror structures', () => {
			const docWithComplexStructure: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-01T10:00:00Z', // Same as created_at
				notes_plain: '',
				notes_markdown: '',
				notes: {
					type: 'doc',
					content: [
						{
							type: 'heading',
							attrs: { level: 1 },
							content: [{ type: 'text', text: 'Title' }],
						},
						{
							type: 'bulletList',
							content: [
								{
									type: 'listItem',
									content: [
										{
											type: 'paragraph',
											content: [{ type: 'text', text: 'Item' }],
										},
									],
								},
							],
						},
					],
				},
				last_viewed_panel: null,
			};

			expect(isEmptyDocument(docWithComplexStructure)).toBe(false);
		});

		it('should handle documents with nested empty structures', () => {
			const docWithNestedEmpty: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z', // Different dates
				notes_plain: '',
				notes_markdown: '',
				notes: {
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
											content: [], // Empty paragraph in list item
										},
									],
								},
							],
						},
					],
				},
				last_viewed_panel: null,
			};

			expect(isEmptyDocument(docWithNestedEmpty)).toBe(true);
		});

		it('should prioritize last_viewed_panel over other content fields', () => {
			const docWithPriorityContent: GranolaDocument = {
				...baseDocument,
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-01T10:00:00Z', // Same as created_at
				notes_plain: '', // Empty
				notes_markdown: '', // Empty
				notes: { type: 'doc', content: [] }, // Empty
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'paragraph',
								content: [{ type: 'text', text: 'Last viewed content' }],
							},
						],
					},
				},
			};

			expect(isEmptyDocument(docWithPriorityContent)).toBe(false);
		});
	});
});