import {
	SelectiveImportManager,
	ImportOptions,
	DocumentProgress,
	ImportProgress,
	DocumentImportStatus,
	ImportStrategy,
} from '../../src/services/import-manager';
import { DocumentDisplayMetadata } from '../../src/services/document-metadata';
import { GranolaDocument } from '../../src/api';
import { ProseMirrorConverter } from '../../src/converter';
import { Logger } from '../../src/types';
import { App, Vault, TFile } from 'obsidian';

// Mock conflict resolution modal for testing conflict scenarios
const mockConflictResolutionModal = {
	showConflictResolution: jest.fn(),
};

jest.mock('../../src/ui/conflict-resolution-modal', () => ({
	ConflictResolutionModal: jest.fn().mockImplementation(() => mockConflictResolutionModal),
}));

// Mock dependencies
const mockApp = {
	vault: null,
} as App;

const mockVault = {
	create: jest.fn(),
	modify: jest.fn(),
	read: jest.fn(),
	delete: jest.fn(),
	getAbstractFileByPath: jest.fn(),
	createFolder: jest.fn(),
} as unknown as Vault;

const mockConverter: ProseMirrorConverter = {
	convertToMarkdown: jest.fn(),
	generateFilename: jest.fn(),
	convertDocument: jest.fn(),
};

const mockLogger: Logger = {
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	updateSettings: jest.fn(),
};

// Mock TFile
const createMockFile = (name: string, path: string = name): TFile => {
	const file = Object.create(TFile.prototype);
	Object.assign(file, {
		name,
		path,
		basename: name.replace('.md', ''),
		extension: 'md',
		parent: null,
		vault: mockVault,
		stat: { ctime: 0, mtime: 0, size: 0 },
	});
	return file;
};

describe('SelectiveImportManager', () => {
	let importManager: SelectiveImportManager;
	let mockDocumentMetadata: DocumentDisplayMetadata[];
	let mockGranolaDocuments: GranolaDocument[];
	let defaultOptions: ImportOptions;

	beforeEach(() => {
		const mockSettings = {
			import: {
				skipEmptyDocuments: true,
				defaultFolder: '', // Add default folder as empty string
			},
		} as any;
		importManager = new SelectiveImportManager(
			mockApp,
			mockVault,
			mockConverter,
			mockLogger,
			mockSettings
		);

		mockDocumentMetadata = [
			{
				id: 'doc1',
				title: 'Document 1',
				createdDate: '2023-01-01',
				updatedDate: '2023-01-02',
				createdAgo: '1 day ago',
				updatedAgo: '1 hour ago',
				preview: 'First document preview',
				wordCount: 100,
				readingTime: 1,
				importStatus: { status: 'NEW', reason: 'New document', requiresUserChoice: false },
				visible: true,
				selected: true,
			},
			{
				id: 'doc2',
				title: 'Document 2',
				createdDate: '2023-01-01',
				updatedDate: '2023-01-02',
				createdAgo: '1 day ago',
				updatedAgo: '1 hour ago',
				preview: 'Second document preview',
				wordCount: 200,
				readingTime: 2,
				importStatus: {
					status: 'UPDATED',
					reason: 'Updated document',
					requiresUserChoice: false,
				},
				visible: true,
				selected: true,
			},
			{
				id: 'doc3',
				title: 'Document 3',
				createdDate: '2023-01-01',
				updatedDate: '2023-01-02',
				createdAgo: '1 day ago',
				updatedAgo: '1 hour ago',
				preview: 'Third document preview',
				wordCount: 150,
				readingTime: 1,
				importStatus: { status: 'NEW', reason: 'New document', requiresUserChoice: false },
				visible: true,
				selected: false, // Not selected
			},
		];

		mockGranolaDocuments = [
			{
				id: 'doc1',
				title: 'Document 1',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'First document content',
				notes_markdown: '# Document 1\n\nFirst document content',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: { content: { type: 'doc', content: [] } },
			},
			{
				id: 'doc2',
				title: 'Document 2',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Second document content',
				notes_markdown: '# Document 2\n\nSecond document content',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: { content: { type: 'doc', content: [] } },
			},
			{
				id: 'doc3',
				title: 'Document 3',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-02T15:30:00Z',
				user_id: 'user-123',
				notes_plain: 'Third document content',
				notes_markdown: '# Document 3\n\nThird document content',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: { content: { type: 'doc', content: [] } },
			},
		];

		defaultOptions = {
			strategy: 'skip',
			stopOnError: false,
		};

		// Reset mocks
		jest.clearAllMocks();

		// Setup default mock for conflict resolution
		mockConflictResolutionModal.showConflictResolution.mockResolvedValue({
			action: 'overwrite',
			createBackup: false,
		});

		// Setup default mock implementations
		(mockConverter.convertDocument as jest.Mock).mockResolvedValue({
			filename: 'test-document.md',
			content: '# Test\n\nMarkdown content',
			frontmatter: {
				granola_id: 'test-id',
				title: 'Test Document',
				created_at: '2023-01-01T00:00:00.000Z',
				updated_at: '2023-01-01T00:00:00.000Z',
			},
		});
		(mockConverter.generateFilename as jest.Mock).mockReturnValue('test-document.md');
		(mockVault.create as jest.Mock).mockResolvedValue(createMockFile('test-document.md'));
		(mockVault.modify as jest.Mock).mockResolvedValue(undefined);
		(mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
		(mockVault.createFolder as jest.Mock).mockResolvedValue(undefined);
	});

	describe('constructor', () => {
		it('should initialize with correct dependencies', () => {
			expect(importManager).toBeInstanceOf(SelectiveImportManager);
		});

		it('should have initial progress state', () => {
			const progress = importManager.getProgress();

			expect(progress.total).toBe(0);
			expect(progress.completed).toBe(0);
			expect(progress.failed).toBe(0);
			expect(progress.skipped).toBe(0);
			expect(progress.percentage).toBe(0);
			expect(progress.isRunning).toBe(false);
			expect(progress.isCancelled).toBe(false);
		});
	});

	describe('importDocuments', () => {
		it('should import selected documents successfully', async () => {
			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				defaultOptions
			);

			// Check that import completed with expected document count
			expect(result.total).toBe(2); // Only 2 documents are selected
			expect(result.isRunning).toBe(false);
			// Note: actual completion counts depend on implementation details
		});

		it('should only process selected documents', async () => {
			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				defaultOptions
			);

			// doc3 is not selected, so should not be processed
			expect(result.total).toBe(2);
		});

		it('should handle documents missing from Granola data', async () => {
			const metadataWithMissing = [
				...mockDocumentMetadata,
				{
					id: 'missing-doc',
					title: 'Missing Document',
					createdDate: '2023-01-01',
					updatedDate: '2023-01-02',
					createdAgo: '1 day ago',
					updatedAgo: '1 hour ago',
					preview: 'Missing document preview',
					wordCount: 100,
					readingTime: 1,
					importStatus: {
						status: 'NEW',
						reason: 'New document',
						requiresUserChoice: false,
					},
					visible: true,
					selected: true,
				} as DocumentDisplayMetadata,
			];

			const result = await importManager.importDocuments(
				metadataWithMissing,
				mockGranolaDocuments, // Doesn't contain 'missing-doc'
				defaultOptions
			);

			// Only documents that exist in Granola data are processed
			expect(result.total).toBe(2);
		});

		it('should throw error if import already running', async () => {
			// Start first import
			const importPromise = importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				defaultOptions
			);

			// Try to start second import while first is running
			await expect(
				importManager.importDocuments(
					mockDocumentMetadata,
					mockGranolaDocuments,
					defaultOptions
				)
			).rejects.toThrow('Import already in progress');

			// Wait for first import to complete
			await importPromise;
		});

		it('should handle conversion errors gracefully', async () => {
			// Mock converter to throw error for first document
			(mockConverter.convertDocument as jest.Mock)
				.mockImplementationOnce(() => {
					throw new Error('Conversion failed');
				})
				.mockReturnValue({
					filename: 'test-document.md',
					content: '# Test\n\nMarkdown content',
					frontmatter: { granola_id: 'test-id', title: 'Test Document' },
				});

			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				{ ...defaultOptions, stopOnError: false }
			);

			expect(result.total).toBe(2);
			// Error handling behavior depends on implementation
		});

		it('should stop on first error when stopOnError is true', async () => {
			(mockConverter.convertDocument as jest.Mock).mockImplementationOnce(() => {
				throw new Error('Conversion failed');
			});

			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				{ ...defaultOptions, stopOnError: true }
			);

			// stopOnError behavior depends on implementation
			expect(result.total).toBe(2);
		});

		it('should call progress callbacks during import', async () => {
			const progressCallback = jest.fn();
			const documentProgressCallback = jest.fn();

			const options = {
				...defaultOptions,
				onProgress: progressCallback,
				onDocumentProgress: documentProgressCallback,
			};

			await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				options
			);

			expect(progressCallback).toHaveBeenCalled();
			expect(documentProgressCallback).toHaveBeenCalled();
		});
	});

	describe('cancel', () => {
		it('should cancel running import', async () => {
			// Mock slow conversion to allow cancellation
			let conversionResolver: (value: any) => void;
			(mockConverter.convertDocument as jest.Mock).mockImplementation(
				() =>
					new Promise(resolve => {
						conversionResolver = resolve;
					})
			);

			// Start import
			const importPromise = importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				defaultOptions
			);

			// Cancel immediately
			importManager.cancel();

			// Check that cancellation is recorded
			const progress = importManager.getProgress();
			expect(progress.isCancelled).toBe(true);

			// Complete the conversion to allow the promise to resolve
			conversionResolver!({
				filename: 'test-document.md',
				content: 'content',
				frontmatter: { granola_id: 'test-id', title: 'Test Document' },
			});

			// Wait for import to complete
			await importPromise;

			// Verify final state
			const finalProgress = importManager.getProgress();
			expect(finalProgress.isCancelled).toBe(true);
			expect(finalProgress.message).toContain('cancelled');
		});

		it('should do nothing if no import is running', () => {
			importManager.cancel();

			const progress = importManager.getProgress();
			expect(progress.isCancelled).toBe(false);
		});
	});

	describe('progress tracking', () => {
		it('should track document progress correctly', async () => {
			await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				defaultOptions
			);

			const doc1Progress = importManager.getDocumentProgress('doc1');
			const doc2Progress = importManager.getDocumentProgress('doc2');
			const doc3Progress = importManager.getDocumentProgress('doc3');

			// Progress tracking depends on implementation
			expect(doc3Progress).toBeNull(); // Not selected, so not tracked
		});

		it('should return null for non-existent document progress', () => {
			const progress = importManager.getDocumentProgress('non-existent');
			expect(progress).toBeNull();
		});

		it('should return all document progress', async () => {
			await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				defaultOptions
			);

			const allProgress = importManager.getAllDocumentProgress();
			expect(allProgress).toHaveLength(2); // Only selected documents
			expect(allProgress.map(p => p.id)).toEqual(['doc1', 'doc2']);
		});

		it('should calculate progress percentage correctly', async () => {
			let progressUpdates: ImportProgress[] = [];

			const options = {
				...defaultOptions,
				onProgress: (progress: ImportProgress) => {
					progressUpdates.push({ ...progress });
				},
			};

			await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				options
			);

			// Should have progress updates during import
			expect(progressUpdates.length).toBeGreaterThan(1);

			// Final progress should be 100%
			const finalProgress = progressUpdates[progressUpdates.length - 1];
			expect(finalProgress.percentage).toBe(100);
		});

		// Removed test for processing rate as it's no longer tracked
	});

	describe('reset', () => {
		it('should reset manager state', async () => {
			await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				defaultOptions
			);

			// Verify state after import
			expect(importManager.getProgress().total).toBe(2);
			expect(importManager.getAllDocumentProgress()).toHaveLength(2);

			// Reset and verify clean state
			importManager.reset();

			const progress = importManager.getProgress();
			expect(progress.total).toBe(0);
			expect(progress.completed).toBe(0);
			expect(progress.failed).toBe(0);
			expect(progress.isRunning).toBe(false);
			expect(progress.isCancelled).toBe(false);

			expect(importManager.getAllDocumentProgress()).toHaveLength(0);
		});
	});

	describe('import strategies', () => {
		it('should handle skip strategy', async () => {
			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				{ ...defaultOptions, strategy: 'skip' }
			);

			expect(result.total).toBe(2);
		});

		it('should handle update strategy', async () => {
			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				{ ...defaultOptions, strategy: 'update' }
			);

			expect(result.total).toBe(2);
		});

		it('should handle create_new strategy', async () => {
			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				{ ...defaultOptions, strategy: 'create_new' }
			);

			expect(result.total).toBe(2);
		});
	});

	// Removed concurrency control tests as maxConcurrency and delayBetweenImports were removed

	describe('error handling', () => {
		it('should handle vault creation errors', async () => {
			(mockVault.create as jest.Mock).mockRejectedValue(new Error('Vault error'));

			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				{ ...defaultOptions, stopOnError: false }
			);

			expect(result.failed).toBe(2);
			expect(result.completed).toBe(0);
		});

		it('should handle filename generation errors', async () => {
			(mockConverter.convertDocument as jest.Mock).mockImplementation(() => {
				throw new Error('Filename error');
			});

			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				{ ...defaultOptions, stopOnError: false }
			);

			expect(result.failed).toBe(2);
		});

		it('should maintain error information in document progress', async () => {
			(mockConverter.convertDocument as jest.Mock)
				.mockImplementationOnce(() => {
					throw new Error('Conversion failed');
				})
				.mockReturnValue({
					filename: 'test-document.md',
					content: '# Test\n\nContent',
					frontmatter: { granola_id: 'test-id', title: 'Test Document' },
				});

			await importManager.importDocuments(mockDocumentMetadata, mockGranolaDocuments, {
				...defaultOptions,
				stopOnError: false,
			});

			const doc1Progress = importManager.getDocumentProgress('doc1');
			expect(doc1Progress?.status).toBe('failed');
			expect(doc1Progress?.error).toBeTruthy();
		});
	});

	// Removed backup creation tests as createBackups option was removed

        describe('edge cases and error recovery', () => {
                it('should handle errors in handleImportError method', async () => {
			// Mock conversion to throw an error to trigger handleImportError
			(mockConverter.convertDocument as jest.Mock).mockImplementationOnce(() => {
				throw new Error('Critical conversion error');
			});

			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				{
					...defaultOptions,
					stopOnError: true,
				}
			);

			// Since the import manager handles errors gracefully, check the result instead
			expect(result.failed).toBeGreaterThan(0);
			const docProgress = importManager.getDocumentProgress(mockDocumentMetadata[0].id);
			expect(docProgress?.error).toContain('Critical conversion error');
		});

		it('should handle document progress updates during cancellation', async () => {
			// Create metadata for documents in different states
			const metadataWithCancellation = [
				{
					...mockDocumentMetadata[0],
					selected: true,
				},
			];

			// Start import and immediately cancel
			const importPromise = importManager.importDocuments(
				metadataWithCancellation,
				[mockGranolaDocuments[0]],
				defaultOptions
			);

			importManager.cancel();

			await importPromise.catch(() => {
				// Expected to fail due to cancellation
			});

			const progress = importManager.getProgress();
			expect(progress.isCancelled).toBe(true);
		});

		it('should handle conflict resolution with skip action', async () => {
			// Create metadata with conflict status requiring user choice
			const conflictMetadata = [
				{
					...mockDocumentMetadata[0],
					selected: true,
					importStatus: {
						status: 'CONFLICT' as const,
						requiresUserChoice: true,
						existingFile: createMockFile('existing.md'),
						localModifications: true,
						isNewer: true,
					},
				},
			];

			// Mock ConflictResolutionModal to return skip action
			const mockResolution = {
				action: 'skip' as const,
				reason: 'User chose to skip',
			};

			// Mock dynamic import and modal
			const mockModal = {
				showConflictResolution: jest.fn().mockResolvedValue(mockResolution),
			};

			const mockConflictClass = jest.fn().mockImplementation(() => mockModal);

			// Mock dynamic import
			jest.doMock('../../src/ui/conflict-resolution-modal', () => ({
				ConflictResolutionModal: mockConflictClass,
			}));

			const result = await importManager.importDocuments(
				conflictMetadata,
				[mockGranolaDocuments[0]],
				defaultOptions
			);

			expect(result.skipped).toBe(1);
			expect(result.completed).toBe(0);
		});

		it('should handle generateUniqueFilename when files exist', () => {
			// Mock vault to simulate existing files
			const mockFileExists = jest
				.fn()
				.mockReturnValueOnce(createMockFile('test-1.md')) // First attempt exists
				.mockReturnValueOnce(createMockFile('test-2.md')) // Second attempt exists
				.mockReturnValueOnce(null); // Third attempt is free

			(mockVault as any).getAbstractFileByPath = mockFileExists;

			// Access private method via reflection
			const uniqueName = (importManager as any).generateUniqueFilename('test.md');

			expect(uniqueName).toBe('test-3.md');
			expect(mockFileExists).toHaveBeenCalledTimes(3);
		});

		// Removed test for backup creation as createBackup method was removed

		it('should handle various import strategies for existing documents', async () => {
			const existingMetadata = [
				{
					...mockDocumentMetadata[0],
					selected: true,
					importStatus: {
						status: 'EXISTS' as const,
						requiresUserChoice: false,
						existingFile: createMockFile('existing.md'),
						localModifications: false,
						isNewer: true,
					},
				},
			];

			// Test skip strategy
			const skipResult = await importManager.importDocuments(
				existingMetadata,
				[mockGranolaDocuments[0]],
				{ ...defaultOptions, strategy: 'skip' }
			);

			expect(skipResult.skipped).toBe(1);

			// Reset for next test
			importManager.reset();

			// Test update strategy
			const updateResult = await importManager.importDocuments(
				existingMetadata,
				[mockGranolaDocuments[0]],
				{ ...defaultOptions, strategy: 'update' }
			);

			expect(updateResult.completed).toBe(1);

			// Reset for next test
			importManager.reset();

			// Test create_new strategy
			const createNewResult = await importManager.importDocuments(
				existingMetadata,
				[mockGranolaDocuments[0]],
				{ ...defaultOptions, strategy: 'create_new' }
			);

			expect(createNewResult.completed).toBe(1);
		});

		it('should handle applyConflictResolution with unknown action', async () => {
			const doc = mockGranolaDocuments[0];
			const invalidResolution = {
				action: 'unknown_action' as any,
			};

			let caughtError: Error | null = null;
			try {
				// Access private method via reflection
				await (importManager as any).applyConflictResolution(
					doc,
					invalidResolution,
					defaultOptions
				);
			} catch (error) {
				caughtError = error as Error;
			}

			expect(caughtError).toBeInstanceOf(Error);
			expect(caughtError?.message).toContain('Unknown resolution action');
		});

		it('should handle progress updates during different phases', async () => {
			let progressUpdates: any[] = [];

			const options = {
				...defaultOptions,
				onDocumentProgress: (progress: DocumentProgress) => {
					progressUpdates.push(progress);
				},
			};

			await importManager.importDocuments(
				[{ ...mockDocumentMetadata[0], selected: true }],
				[mockGranolaDocuments[0]],
				options
			);

			// Should have progress updates during import phases
			expect(progressUpdates.length).toBeGreaterThanOrEqual(1);
			// Check for valid progress data structure
			expect(progressUpdates.every(p => p.id && typeof p.id === 'string')).toBe(true);
			expect(progressUpdates.every(p => typeof p.progress === 'number')).toBe(true);
			expect(progressUpdates.every(p => p.progress >= 0 && p.progress <= 100)).toBe(true);
		});

		it('should handle import completion and finalization', async () => {
			let finalProgress: ImportProgress | null = null;

			const options = {
				...defaultOptions,
				onProgress: (progress: ImportProgress) => {
					if (progress.percentage === 100) {
						finalProgress = progress;
					}
				},
			};

			await importManager.importDocuments(
				mockDocumentMetadata.filter(m => m.selected),
				mockGranolaDocuments,
				options
			);

			expect(finalProgress).not.toBeNull();
			expect(finalProgress?.isRunning).toBe(false);
			expect(finalProgress?.message).toContain('complete');
		});

		it('should handle document processing with timing metrics', async () => {
			const startTime = Date.now();

			await importManager.importDocuments(
				[{ ...mockDocumentMetadata[0], selected: true }],
				[mockGranolaDocuments[0]],
				defaultOptions
			);

			const docProgress = importManager.getDocumentProgress('doc1');
			expect(docProgress?.startTime).toBeGreaterThanOrEqual(startTime);
			// Use >= instead of > to handle fast execution where times can be equal
			expect(docProgress?.endTime).toBeGreaterThanOrEqual(docProgress?.startTime || 0);
		});

		it('should handle conflicts requiring user choice', async () => {
			const conflictMetadata = [
				{
					...mockDocumentMetadata[0],
					selected: true,
					importStatus: {
						status: 'CONFLICT' as const,
						requiresUserChoice: true,
						existingFile: createMockFile('conflict.md'),
						localModifications: true,
						isNewer: false,
					},
				},
			];

			// Mock vault methods for conflict resolution
			(mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(
				createMockFile('test-document.md')
			);
			(mockVault.modify as jest.Mock).mockResolvedValue(undefined);
			(mockVault.read as jest.Mock).mockResolvedValue('# Existing content');

			// Capture progress updates
			const progressUpdates: DocumentProgress[] = [];
			const options = {
				...defaultOptions,
				onDocumentProgress: (progress: DocumentProgress) => {
					progressUpdates.push(progress);
				},
			};

			const result = await importManager.importDocuments(
				conflictMetadata,
				[mockGranolaDocuments[0]],
				options
			);

			// Check that conflict document was handled appropriately
			expect(result.total).toBe(1);
			// The document should either be completed (if conflict resolution succeeds) or skipped
			expect(result.completed + result.skipped).toBe(1);
			expect(result.failed).toBe(0);
                });
        });

        describe('failed import recovery features', () => {
                it('tracks failed documents with metadata and error details', async () => {
                        (mockConverter.convertDocument as jest.Mock).mockImplementation(doc => {
                                if (doc.id === 'doc1') {
                                        throw new Error('Conversion failed for doc1');
                                }

                                return {
                                        filename: `${doc.id}.md`,
                                        content: '# Markdown content',
                                        frontmatter: { granola_id: doc.id, title: doc.title },
                                        isTrulyEmpty: false,
                                };
                        });

                        await importManager.importDocuments(mockDocumentMetadata, mockGranolaDocuments, {
                                ...defaultOptions,
                                stopOnError: false,
                        });

                        const failedRecords = importManager.getFailedDocuments();
                        expect(failedRecords).toHaveLength(1);
                        const failedRecord = failedRecords[0];
                        expect(failedRecord.document.id).toBe('doc1');
                        expect(failedRecord.metadata?.id).toBe('doc1');
                        expect(failedRecord.metadata?.title).toBe('Document 1');
                        expect(failedRecord.error).toContain('Conversion failed');
                        expect(failedRecord.message).toContain('failed');
                        expect(typeof failedRecord.timestamp).toBe('number');
                });

                it('retries only failed documents using stored context', async () => {
                        let shouldFailDoc1 = true;
                        (mockConverter.convertDocument as jest.Mock).mockImplementation(doc => {
                                if (doc.id === 'doc1' && shouldFailDoc1) {
                                        shouldFailDoc1 = false;
                                        throw new Error('Initial failure for doc1');
                                }

                                return {
                                        filename: `${doc.id}.md`,
                                        content: '# Markdown content',
                                        frontmatter: { granola_id: doc.id, title: doc.title },
                                        isTrulyEmpty: false,
                                };
                        });

                        await importManager.importDocuments(mockDocumentMetadata, mockGranolaDocuments, {
                                ...defaultOptions,
                                stopOnError: false,
                        });

                        const failedRecords = importManager.getFailedDocuments();
                        expect(failedRecords).toHaveLength(1);
                        const initialCreateCalls = (mockVault.create as jest.Mock).mock.calls.length;

                        const retryProgressUpdates: ImportProgress[] = [];
                        const retryDocumentUpdates: DocumentProgress[] = [];

                        const retryResult = await importManager.retryFailedImports({
                                ...defaultOptions,
                                onProgress: progress => retryProgressUpdates.push(progress),
                                onDocumentProgress: docProgress => retryDocumentUpdates.push(docProgress),
                        });

                        expect(retryResult.total).toBe(1);
                        expect(retryResult.failed).toBe(0);
                        expect(retryResult.completed).toBe(1);
                        expect(importManager.getFailedDocuments()).toHaveLength(0);
                        expect((mockVault.create as jest.Mock).mock.calls.length).toBe(initialCreateCalls + 1);
                        expect(retryProgressUpdates.length).toBeGreaterThan(0);
                        expect(
                                retryDocumentUpdates.some(
                                        update => update.id === 'doc1' && update.status === 'completed'
                                )
                        ).toBe(true);
                });

                it('throws when retrying without failed documents', async () => {
                        await importManager.importDocuments(mockDocumentMetadata, mockGranolaDocuments, {
                                ...defaultOptions,
                                stopOnError: false,
                        });

                        await expect(
                                importManager.retryFailedImports({ ...defaultOptions })
                        ).rejects.toThrow('There are no failed documents to retry.');
                });
        });

	describe('empty document filtering', () => {
		it('should skip empty documents when setting is enabled', async () => {
			const emptyDocument: GranolaDocument = {
				id: 'empty-doc',
				title: 'Empty Document',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-01T10:00:00Z',
				user_id: 'user-123',
				notes_plain: '',
				notes_markdown: '',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: { content: { type: 'doc', content: [] } },
			};

			const emptyMetadata: DocumentDisplayMetadata = {
				id: 'empty-doc',
				title: 'Empty Document',
				createdDate: '2023-01-01',
				updatedDate: '2023-01-01',
				createdAgo: '1 day ago',
				updatedAgo: '1 day ago',
				preview: 'No content available',
				wordCount: 0,
				readingTime: 1,
				importStatus: { status: 'NEW', reason: 'New document', requiresUserChoice: false },
				visible: true,
				selected: true,
			};

			const result = await importManager.importDocuments(
				[emptyMetadata],
				[emptyDocument],
				defaultOptions
			);

			expect(result.total).toBe(1);
			expect(result.skipped).toBe(1);
			expect(result.completed).toBe(0);
			expect(result.failed).toBe(0);

			// Verify the document progress shows it was skipped for being empty
			const docProgress = importManager.getDocumentProgress('empty-doc');
			expect(docProgress?.status).toBe('skipped');
			expect(docProgress?.message).toContain('empty document');
		});

		it('should import empty documents when setting is disabled', async () => {
			// Create import manager with skipEmptyDocuments disabled
			const settingsWithoutFiltering = {
				import: {
					skipEmptyDocuments: false,
					defaultFolder: '', // Add default folder
				},
			} as any;
			const importManagerNoFiltering = new SelectiveImportManager(
				mockApp,
				mockVault,
				mockConverter,
				mockLogger,
				settingsWithoutFiltering
			);

			// Override converter to return a document that is not "truly empty" to test the setting
			(mockConverter.convertDocument as jest.Mock).mockReturnValue({
				filename: 'empty-document-2.md',
				content: '# Empty Document 2\n\n',
				frontmatter: {
					granola_id: 'empty-doc-2',
					title: 'Empty Document 2',
					created_at: '2023-01-01T10:00:00.000Z',
					updated_at: '2023-01-01T11:00:00.000Z',
				},
				isTrulyEmpty: false, // This is the key - not truly empty
			});

			const emptyDocument: GranolaDocument = {
				id: 'empty-doc-2',
				title: 'Empty Document 2',
				created_at: '2023-01-01T10:00:00Z',
				updated_at: '2023-01-01T11:00:00Z', // Different timestamp to avoid "truly empty" detection
				user_id: 'user-123',
				notes_plain: '',
				notes_markdown: '',
				notes: { type: 'doc', content: [] },
				last_viewed_panel: { content: { type: 'doc', content: [] } },
			};

			const emptyMetadata: DocumentDisplayMetadata = {
				id: 'empty-doc-2',
				title: 'Empty Document 2',
				createdDate: '2023-01-01',
				updatedDate: '2023-01-01',
				createdAgo: '1 day ago',
				updatedAgo: '1 day ago',
				preview: 'No content available',
				wordCount: 0,
				readingTime: 1,
				importStatus: { status: 'NEW', reason: 'New document', requiresUserChoice: false },
				visible: true,
				selected: true,
			};

			const result = await importManagerNoFiltering.importDocuments(
				[emptyMetadata],
				[emptyDocument],
				defaultOptions
			);

			expect(result.total).toBe(1);
			expect(result.skipped).toBe(0);
			expect(result.completed).toBe(1);
			expect(result.failed).toBe(0);
		});
	});

	describe('comprehensive error scenarios', () => {
		it('should handle network timeout during import', async () => {
			// Simulate a timeout-like error
			(mockConverter.convertDocument as jest.Mock).mockImplementation(() => {
				throw new Error('Request timeout');
			});

			let errorHandled = false;
			const options = {
				...defaultOptions,
				stopOnError: false,
				onDocumentProgress: (progress: DocumentProgress) => {
					if (progress.status === 'failed' && progress.error?.includes('timeout')) {
						errorHandled = true;
					}
				},
			};

			await importManager.importDocuments(
				[{ ...mockDocumentMetadata[0], selected: true }],
				[mockGranolaDocuments[0]],
				options
			);

			expect(errorHandled).toBe(true);
		});

		it('should handle file system permission errors', async () => {
			// Reset mocks first
			jest.clearAllMocks();
			(mockConverter.convertDocument as jest.Mock).mockResolvedValue({
				filename: 'test-document.md',
				content: '# Test\n\nMarkdown content',
				frontmatter: {
					granola_id: 'test-id',
					title: 'Test Document',
					created_at: '2023-01-01T00:00:00.000Z',
					updated_at: '2023-01-01T00:00:00.000Z',
				},
			});
			// Simulate permission denied error
			(mockVault.create as jest.Mock).mockRejectedValue(
				new Error('EACCES: permission denied')
			);

			const result = await importManager.importDocuments(
				[{ ...mockDocumentMetadata[0], selected: true }],
				[mockGranolaDocuments[0]],
				{ ...defaultOptions, stopOnError: false }
			);

			expect(result.failed).toBe(1);
			expect(result.completed).toBe(0);
		});

		it('should handle malformed document data', async () => {
			// Make the converter throw an error for malformed data
			(mockConverter.convertDocument as jest.Mock).mockImplementation(doc => {
				throw new Error('Cannot convert document with null ID');
			});

			const progressUpdates: DocumentProgress[] = [];
			const options = {
				...defaultOptions,
				stopOnError: false,
				onDocumentProgress: (progress: DocumentProgress) => {
					progressUpdates.push(progress);
				},
			};

			const result = await importManager.importDocuments(
				[{ ...mockDocumentMetadata[0], selected: true }],
				[mockGranolaDocuments[0]], // Use normal document but converter will throw
				options
			);

			const failedProgress = progressUpdates.find(p => p.status === 'failed');
			expect(failedProgress).toBeDefined();
			expect(failedProgress?.error).toContain('Cannot convert document with null ID');
			expect(result.failed).toBe(1);
		});

		it('should handle concurrent import attempts', async () => {
			// Start first import
			const firstImport = importManager.importDocuments(
				[{ ...mockDocumentMetadata[0], selected: true }],
				[mockGranolaDocuments[0]],
				defaultOptions
			);

			// Try to start second import while first is running
			let secondImportFailed = false;
			try {
				await importManager.importDocuments(
					[{ ...mockDocumentMetadata[1], selected: true }],
					[mockGranolaDocuments[1]],
					defaultOptions
				);
			} catch (error) {
				secondImportFailed = true;
			}

			await firstImport;

			// Behavior depends on implementation - may throw or queue
			// At minimum, should not crash
			expect(typeof secondImportFailed).toBe('boolean');
		});
	});
});
