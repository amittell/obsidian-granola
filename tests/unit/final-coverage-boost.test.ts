/**
 * Final targeted tests to push overall coverage over 70%
 * Focuses on easy wins in already well-tested modules
 */

import { DocumentMetadataService } from '../../src/services/document-metadata';
import { DuplicateDetector } from '../../src/services/duplicate-detector';
import { GranolaDocument } from '../../src/api';
import { App, TFile, Vault } from 'obsidian';

describe('Final Coverage Boost', () => {
	let service: DocumentMetadataService;
	let mockDuplicateDetector: DuplicateDetector;
	let mockApp: App;

	beforeEach(() => {
		mockApp = {
			vault: {
				getFiles: jest.fn(() => []),
				getMarkdownFiles: jest.fn(() => []),
				read: jest.fn(),
			} as unknown as Vault,
		} as unknown as App;

		mockDuplicateDetector = {
			checkDocuments: jest.fn().mockResolvedValue(new Map()),
		} as unknown as DuplicateDetector;

		service = new DocumentMetadataService(mockApp, mockDuplicateDetector);
	});

	describe('DocumentMetadataService edge cases', () => {
		it('should handle extractMetadata with all fallback scenarios', () => {
			// Test with completely minimal document
			const minimalDoc: GranolaDocument = {
				id: 'minimal',
				user_id: 'user',
				created_at: '',
				updated_at: '',
			};

			const metadata = service.extractMetadata(minimalDoc, {
				status: 'NEW',
				reason: 'Test',
				requiresUserChoice: false,
			});

			expect(metadata.id).toBe('minimal');
			expect(metadata.title).toBe('Untitled Document');
			expect(metadata.preview).toBe('No content available');
		});

		it('should handle getCollectionStats with empty collection', () => {
			const stats = service.getCollectionStats([]);

			expect(stats.total).toBe(0);
			expect(stats.visible).toBe(0);
			expect(stats.selected).toBe(0);
			expect(stats.byStatus).toEqual({});
		});

		it('should handle updateSelection with empty array', () => {
			const docs = [
				{
					id: 'doc1',
					title: 'Test',
					selected: false,
					visible: true,
				} as any,
			];

			service.updateSelection(docs, []);

			expect(docs[0].selected).toBe(false);
		});

		it('should handle applySorting with unknown sort field', () => {
			const docs = [
				{
					id: 'doc1',
					title: 'Test',
					wordCount: 100,
				} as any,
			];

			const result = service.applySorting(docs, 'unknownField' as any, 'asc');

			expect(result).toEqual(docs);
		});

		it('should handle applyFilter with empty search text', () => {
			const docs = [
				{
					id: 'doc1',
					title: 'Test Document',
					visible: true,
					preview: 'Test preview',
					importStatus: {
						status: 'NEW' as const,
						reason: 'Test document',
						requiresUserChoice: false,
					},
					wordCount: 100,
				} as any,
			];

			const result = service.applyFilter(docs, {
				searchText: '',
				statusFilter: [],
				minWordCount: 0,
				maxWordCount: 1000,
			});

			expect(result[0].visible).toBe(true);
		});
	});

	describe('DuplicateDetector additional coverage', () => {
		it('should handle initialize without vault files', async () => {
			const detector = new DuplicateDetector(mockApp.vault as any);

			// Mock empty file list
			(mockApp.vault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

			await detector.initialize();

			// Should complete without error
			expect(mockApp.vault.getMarkdownFiles).toHaveBeenCalled();
		});

		it('should handle checkDocuments with mixed document types', async () => {
			const detector = new DuplicateDetector(mockApp.vault as any);

			// Mock empty file list
			(mockApp.vault.getMarkdownFiles as jest.Mock).mockReturnValue([]);

			const docs: GranolaDocument[] = [
				{
					id: 'doc1',
					title: 'Test',
					user_id: 'user',
					created_at: '2023-01-01T10:00:00Z',
					updated_at: '2023-01-01T10:00:00Z',
				},
				{
					id: 'doc2',
					title: 'Test 2',
					user_id: 'user',
					created_at: '2023-01-01T10:00:00Z',
					updated_at: '2023-01-01T10:00:00Z',
				},
			];

			const result = await detector.checkDocuments(docs);

			expect(result.size).toBe(2);
			expect(result.get('doc1')).toEqual({
				status: 'NEW',
				reason: 'Document not found in vault',
				requiresUserChoice: false,
			});
		});
	});
});
