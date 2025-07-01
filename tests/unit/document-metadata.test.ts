import { DocumentMetadataService, DocumentFilter, DocumentSort } from '../../src/services/document-metadata';
import { GranolaDocument } from '../../src/api';
import { DuplicateCheckResult } from '../../src/services/duplicate-detector';

describe('DocumentMetadataService', () => {
	let service: DocumentMetadataService;
	let mockDocument: GranolaDocument;
	let mockImportStatus: DuplicateCheckResult;

	beforeEach(() => {
		service = new DocumentMetadataService();
		
		mockDocument = {
			id: 'test-doc-1',
			title: 'Test Document',
			created_at: '2023-01-01T10:00:00Z',
			updated_at: '2023-01-02T15:30:00Z',
			user_id: 'user-123',
			notes_plain: 'This is a test document with some content for testing purposes.',
			notes_markdown: '# Test Document\n\nThis is a test document with some content.',
			notes: {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: 'This is a test document with some content.' }]
					}
				]
			},
			last_viewed_panel: {
				content: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'This is a test document with some content.' }]
						}
					]
				}
			}
		};

		mockImportStatus = {
			status: 'NEW',
			reason: 'Document does not exist in vault',
			requiresUserChoice: false
		};
	});

	describe('extractMetadata', () => {
		it('should extract basic metadata from a document', () => {
			const metadata = service.extractMetadata(mockDocument, mockImportStatus);

			expect(metadata.id).toBe('test-doc-1');
			expect(metadata.title).toBe('Test Document');
			expect(metadata.importStatus).toEqual(mockImportStatus);
			expect(metadata.visible).toBe(true);
			expect(metadata.selected).toBe(true); // NEW status should be selected by default
		});

		it('should format dates correctly', () => {
			const metadata = service.extractMetadata(mockDocument, mockImportStatus);
			
			expect(metadata.createdDate).toMatch(/Jan 1, 2023/);
			expect(metadata.updatedDate).toMatch(/Jan 2, 2023/);
		});

		it('should generate time ago format', () => {
			const metadata = service.extractMetadata(mockDocument, mockImportStatus);
			
			// Since we're testing with fixed dates in the past, should show "days ago"
			expect(metadata.createdAgo).toMatch(/\d+ days? ago/);
			expect(metadata.updatedAgo).toMatch(/\d+ days? ago/);
		});

		it('should calculate word count from plain text', () => {
			const metadata = service.extractMetadata(mockDocument, mockImportStatus);
			
			expect(metadata.wordCount).toBeGreaterThan(0);
			expect(metadata.readingTime).toBeGreaterThan(0);
		});

		it('should generate preview text', () => {
			const metadata = service.extractMetadata(mockDocument, mockImportStatus);
			
			expect(metadata.preview).toContain('This is a test document');
			expect(metadata.preview.length).toBeLessThanOrEqual(153); // 150 + "..."
		});

		it('should handle empty title', () => {
			mockDocument.title = '';
			const metadata = service.extractMetadata(mockDocument, mockImportStatus);
			
			expect(metadata.title).toBe('Untitled Document');
		});

		it('should handle long titles', () => {
			mockDocument.title = 'A'.repeat(150);
			const metadata = service.extractMetadata(mockDocument, mockImportStatus);
			
			expect(metadata.title.length).toBe(100);
		});

		it('should cache metadata', () => {
			const metadata1 = service.extractMetadata(mockDocument, mockImportStatus);
			const metadata2 = service.extractMetadata(mockDocument, mockImportStatus);
			
			expect(metadata1).toBe(metadata2); // Should be the same object from cache
		});

		it('should update import status even when cached', () => {
			const metadata1 = service.extractMetadata(mockDocument, mockImportStatus);
			
			const newStatus: DuplicateCheckResult = {
				status: 'EXISTS',
				reason: 'Document exists',
				requiresUserChoice: false
			};
			
			const metadata2 = service.extractMetadata(mockDocument, newStatus);
			
			expect(metadata2.importStatus.status).toBe('EXISTS');
		});

		it('should select NEW and UPDATED documents by default', () => {
			const newStatus: DuplicateCheckResult = { status: 'NEW', reason: '', requiresUserChoice: false };
			const updatedStatus: DuplicateCheckResult = { status: 'UPDATED', reason: '', requiresUserChoice: false };
			const existsStatus: DuplicateCheckResult = { status: 'EXISTS', reason: '', requiresUserChoice: false };
			
			const newMetadata = service.extractMetadata(mockDocument, newStatus);
			const updatedMetadata = service.extractMetadata({ ...mockDocument, id: 'doc2' }, updatedStatus);
			const existsMetadata = service.extractMetadata({ ...mockDocument, id: 'doc3' }, existsStatus);
			
			expect(newMetadata.selected).toBe(true);
			expect(updatedMetadata.selected).toBe(true);
			expect(existsMetadata.selected).toBe(false);
		});
	});

	describe('extractBulkMetadata', () => {
		it('should process multiple documents', () => {
			const documents = [
				mockDocument,
				{ ...mockDocument, id: 'doc2', title: 'Second Document' }
			];
			
			const statusMap = new Map([
				['test-doc-1', mockImportStatus],
				['doc2', { status: 'EXISTS' as const, reason: 'Exists', requiresUserChoice: false }]
			]);
			
			const metadata = service.extractBulkMetadata(documents, statusMap);
			
			expect(metadata).toHaveLength(2);
			expect(metadata[0].id).toBe('test-doc-1');
			expect(metadata[1].id).toBe('doc2');
		});

		it('should handle missing status in map', () => {
			const documents = [mockDocument];
			const emptyStatusMap = new Map();
			
			const metadata = service.extractBulkMetadata(documents, emptyStatusMap);
			
			expect(metadata).toHaveLength(1);
			expect(metadata[0].importStatus.status).toBe('NEW');
		});
	});

	describe('applyFilter', () => {
		let testDocuments: any[];
		
		beforeEach(() => {
			testDocuments = [
				{
					id: 'doc1',
					title: 'JavaScript Guide',
					preview: 'Learn JavaScript programming',
					wordCount: 100,
					updatedDate: '2023-01-01T10:00:00Z',
					importStatus: { status: 'NEW' },
					visible: true
				},
				{
					id: 'doc2',
					title: 'Python Tutorial',
					preview: 'Python programming basics',
					wordCount: 200,
					updatedDate: '2023-01-02T10:00:00Z',
					importStatus: { status: 'EXISTS' },
					visible: true
				}
			];
		});

		it('should filter by search text', () => {
			const filter: DocumentFilter = { searchText: 'JavaScript' };
			const filtered = service.applyFilter(testDocuments, filter);
			
			expect(filtered[0].visible).toBe(true);
			expect(filtered[1].visible).toBe(false);
		});

		it('should filter by status', () => {
			const filter: DocumentFilter = { statusFilter: ['NEW'] };
			const filtered = service.applyFilter(testDocuments, filter);
			
			expect(filtered[0].visible).toBe(true);
			expect(filtered[1].visible).toBe(false);
		});

		it('should filter by word count', () => {
			const filter: DocumentFilter = { minWordCount: 150 };
			const filtered = service.applyFilter(testDocuments, filter);
			
			expect(filtered[0].visible).toBe(false);
			expect(filtered[1].visible).toBe(true);
		});

		it('should handle empty filter', () => {
			const filter: DocumentFilter = {};
			const filtered = service.applyFilter(testDocuments, filter);
			
			expect(filtered[0].visible).toBe(true);
			expect(filtered[1].visible).toBe(true);
		});
	});

	describe('applySorting', () => {
		let testDocuments: any[];
		
		beforeEach(() => {
			testDocuments = [
				{
					id: 'doc1',
					title: 'B Document',
					createdDate: '2023-01-02T10:00:00Z',
					updatedDate: '2023-01-02T10:00:00Z',
					wordCount: 200,
					importStatus: { status: 'NEW' }
				},
				{
					id: 'doc2',
					title: 'A Document',
					createdDate: '2023-01-01T10:00:00Z',
					updatedDate: '2023-01-01T10:00:00Z',
					wordCount: 100,
					importStatus: { status: 'EXISTS' }
				}
			];
		});

		it('should sort by title ascending', () => {
			const sort: DocumentSort = { field: 'title', direction: 'asc' };
			const sorted = service.applySorting(testDocuments, sort);
			
			expect(sorted[0].title).toBe('A Document');
			expect(sorted[1].title).toBe('B Document');
		});

		it('should sort by title descending', () => {
			const sort: DocumentSort = { field: 'title', direction: 'desc' };
			const sorted = service.applySorting(testDocuments, sort);
			
			expect(sorted[0].title).toBe('B Document');
			expect(sorted[1].title).toBe('A Document');
		});

		it('should sort by word count', () => {
			const sort: DocumentSort = { field: 'wordCount', direction: 'asc' };
			const sorted = service.applySorting(testDocuments, sort);
			
			expect(sorted[0].wordCount).toBe(100);
			expect(sorted[1].wordCount).toBe(200);
		});

		it('should sort by status', () => {
			const sort: DocumentSort = { field: 'status', direction: 'asc' };
			const sorted = service.applySorting(testDocuments, sort);
			
			expect(sorted[0].importStatus.status).toBe('NEW');
			expect(sorted[1].importStatus.status).toBe('EXISTS');
		});
	});

	describe('getCollectionStats', () => {
		it('should calculate statistics correctly', () => {
			const testDocuments = [
				{
					visible: true,
					selected: true,
					wordCount: 100,
					readingTime: 1,
					importStatus: { status: 'NEW' }
				},
				{
					visible: true,
					selected: false,
					wordCount: 200,
					readingTime: 2,
					importStatus: { status: 'EXISTS' }
				},
				{
					visible: false,
					selected: true,
					wordCount: 300,
					readingTime: 3,
					importStatus: { status: 'NEW' }
				}
			] as any[];

			const stats = service.getCollectionStats(testDocuments);

			expect(stats.total).toBe(3);
			expect(stats.visible).toBe(2);
			expect(stats.selected).toBe(1);
			expect(stats.byStatus['NEW']).toBe(2);
			expect(stats.byStatus['EXISTS']).toBe(1);
			expect(stats.totalWordCount).toBe(600);
			expect(stats.averageWordCount).toBe(200);
			expect(stats.totalReadingTime).toBe(6);
		});
	});

	describe('updateSelection', () => {
		it('should update selection based on provided IDs', () => {
			const testDocuments = [
				{ id: 'doc1', selected: false },
				{ id: 'doc2', selected: true },
				{ id: 'doc3', selected: false }
			] as any[];

			const updated = service.updateSelection(testDocuments, ['doc1', 'doc3']);

			expect(updated[0].selected).toBe(true);
			expect(updated[1].selected).toBe(false);
			expect(updated[2].selected).toBe(true);
		});
	});

	describe('clearCache', () => {
		it('should clear the metadata cache', () => {
			// Extract metadata to populate cache
			service.extractMetadata(mockDocument, mockImportStatus);
			
			// Clear cache
			service.clearCache();
			
			// Mock the document to have different content
			mockDocument.title = 'Modified Title';
			
			// Should not return cached result
			const metadata = service.extractMetadata(mockDocument, mockImportStatus);
			expect(metadata.title).toBe('Modified Title');
		});
	});

	describe('edge cases', () => {
		it('should handle document with no content', () => {
			const emptyDoc: GranolaDocument = {
				...mockDocument,
				notes_plain: '',
				notes_markdown: '',
				notes: { type: 'doc', content: [] }
			};

			const metadata = service.extractMetadata(emptyDoc, mockImportStatus);

			expect(metadata.preview).toBe('No content available');
			expect(metadata.wordCount).toBe(0);
			expect(metadata.readingTime).toBe(1); // Minimum reading time
		});

		it('should handle invalid dates', () => {
			const invalidDateDoc: GranolaDocument = {
				...mockDocument,
				created_at: 'invalid-date',
				updated_at: 'invalid-date'
			};

			const metadata = service.extractMetadata(invalidDateDoc, mockImportStatus);

			expect(metadata.createdDate).toBe('Invalid Date');
			expect(metadata.updatedDate).toBe('Invalid Date');
			expect(metadata.createdAgo).toBe('Unknown');
			expect(metadata.updatedAgo).toBe('Unknown');
		});

		it('should handle document with only ProseMirror content', () => {
			const proseMirrorDoc: GranolaDocument = {
				...mockDocument,
				notes_plain: '',
				notes_markdown: '',
				notes: {
					type: 'doc',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'ProseMirror content only' }]
						}
					]
				}
			};

			const metadata = service.extractMetadata(proseMirrorDoc, mockImportStatus);

			expect(metadata.preview).toContain('ProseMirror content only');
			expect(metadata.wordCount).toBe(3);
		});

		it('should handle malformed ProseMirror structure', () => {
			const malformedDoc: GranolaDocument = {
				...mockDocument,
				notes_plain: '',
				notes_markdown: '',
				notes: { type: 'doc' } // Missing content
			};

			const metadata = service.extractMetadata(malformedDoc, mockImportStatus);

			expect(metadata.preview).toBe('No content available');
		});
	});
});