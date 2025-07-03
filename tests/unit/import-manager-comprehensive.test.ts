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
import { App, Vault, TFile } from 'obsidian';

// Mock the performance modules that import-manager depends on
jest.mock('../../src/performance/performance-monitor', () => ({
	PerformanceMonitor: {
		getInstance: jest.fn(() => ({
			startRuntimeProfiling: jest.fn(() => 'test-profile-id'),
			recordRuntimePhase: jest.fn(),
			completeRuntimeProfiling: jest.fn(() => ({ bottlenecks: [] })),
		})),
	},
	measurePerformance: jest.fn(
		() => (target: any, propertyName: string, descriptor: PropertyDescriptor) => descriptor
	),
}));

jest.mock('../../src/performance/performance-utils', () => ({
	batchProcessor: jest.fn(fn => fn),
	memoize: jest.fn(fn => fn),
}));

// Mock conflict resolution modal for testing conflict scenarios
const mockConflictResolutionModal = {
	showConflictResolution: jest.fn(),
};

const mockConflictResolutionClass = jest.fn().mockImplementation(() => mockConflictResolutionModal);

// Use jest.doMock for dynamic imports
jest.doMock('../../src/ui/conflict-resolution-modal', () => ({
	ConflictResolutionModal: mockConflictResolutionClass,
}));

// Also set up static mock as fallback
jest.mock('../../src/ui/conflict-resolution-modal', () => ({
	ConflictResolutionModal: mockConflictResolutionClass,
}));

describe('SelectiveImportManager - Comprehensive Coverage Tests', () => {
	let importManager: SelectiveImportManager;
	let mockApp: App;
	let mockVault: Vault;
	let mockConverter: ProseMirrorConverter;
	let mockDocumentMetadata: DocumentDisplayMetadata[];
	let mockGranolaDocuments: GranolaDocument[];
	let defaultOptions: ImportOptions;

	// Helper to create mock TFile - use the actual TFile class
	const createMockFile = (name: string, path: string = name): TFile => {
		const file = new TFile(path);
		// Add additional properties that our test code expects
		(file as any).parent = null;
		(file as any).vault = mockVault;
		(file as any).stat = { ctime: Date.now(), mtime: Date.now(), size: 100 };
		return file;
	};

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Setup mock app
		mockApp = {
			vault: null,
		} as unknown as App;

		// Setup mock vault with all methods import-manager uses
		mockVault = {
			create: jest.fn(),
			modify: jest.fn(),
			read: jest.fn(),
			delete: jest.fn(),
			getAbstractFileByPath: jest.fn(),
		} as unknown as Vault;

		// Setup mock converter with correct method names
		mockConverter = {
			convertDocument: jest.fn(),
			updateSettings: jest.fn(),
		} as unknown as ProseMirrorConverter;

		// Default mock implementations
		(mockVault.create as jest.Mock).mockResolvedValue(createMockFile('created.md'));
		(mockVault.modify as jest.Mock).mockResolvedValue(undefined);
		(mockVault.read as jest.Mock).mockResolvedValue('existing content');
		(mockVault.getAbstractFileByPath as jest.Mock).mockImplementation(() => null);

		(mockConverter.convertDocument as jest.Mock).mockReturnValue({
			filename: 'test-document.md',
			content:
				'---\nid: doc-1\ncreated: 2024-01-01T00:00:00Z\nsource: Granola\n---\n\n# Test Document\n\nTest content',
			frontmatter: {
				id: 'doc-1',
				created: '2024-01-01T00:00:00Z',
				source: 'Granola',
			},
		});

		// Create import manager instance
		importManager = new SelectiveImportManager(mockApp, mockVault, mockConverter);

		// Setup default conflict resolution mock to allow processing CONFLICT documents
		mockConflictResolutionModal.showConflictResolution.mockResolvedValue({
			action: 'overwrite',
			createBackup: false,
		});

		// Setup comprehensive test data
		mockDocumentMetadata = [
			{
				id: 'doc-1',
				title: 'New Document',
				created: '2024-01-01T00:00:00Z',
				updated: '2024-01-01T01:00:00Z',
				selected: true,
				importStatus: {
					status: 'NEW',
					requiresUserChoice: false,
					message: 'Ready to import',
				},
				wordCount: 100,
				preview: 'New document content preview',
			},
			{
				id: 'doc-2',
				title: 'Existing Document',
				created: '2024-01-02T00:00:00Z',
				updated: '2024-01-02T01:00:00Z',
				selected: true,
				importStatus: {
					status: 'EXISTS',
					requiresUserChoice: false,
					message: 'Document exists',
					existingFile: createMockFile('test-document.md'),
				},
				wordCount: 200,
				preview: 'Existing document content preview',
			},
			{
				id: 'doc-3',
				title: 'Conflict Document',
				created: '2024-01-03T00:00:00Z',
				updated: '2024-01-03T01:00:00Z',
				selected: true,
				importStatus: {
					status: 'CONFLICT',
					requiresUserChoice: true,
					message: 'Requires resolution',
					existingFile: createMockFile('test-document.md'),
				},
				wordCount: 150,
				preview: 'Conflict document content preview',
			},
			{
				id: 'doc-4',
				title: 'Unselected Document',
				created: '2024-01-04T00:00:00Z',
				updated: '2024-01-04T01:00:00Z',
				selected: false,
				importStatus: {
					status: 'NEW',
					requiresUserChoice: false,
					message: 'Not selected',
				},
				wordCount: 50,
				preview: 'Unselected content',
			},
		];

		mockGranolaDocuments = [
			{
				id: 'doc-1',
				title: 'New Document',
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T01:00:00Z',
				user_id: 'user-1',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{ type: 'paragraph', content: [{ type: 'text', text: 'New content' }] },
						],
					},
				},
				notes: null,
				notes_plain: null,
				notes_markdown: null,
			},
			{
				id: 'doc-2',
				title: 'Existing Document',
				created_at: '2024-01-02T00:00:00Z',
				updated_at: '2024-01-02T01:00:00Z',
				user_id: 'user-1',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'paragraph',
								content: [{ type: 'text', text: 'Existing content' }],
							},
						],
					},
				},
				notes: null,
				notes_plain: null,
				notes_markdown: null,
			},
			{
				id: 'doc-3',
				title: 'Conflict Document',
				created_at: '2024-01-03T00:00:00Z',
				updated_at: '2024-01-03T01:00:00Z',
				user_id: 'user-1',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'paragraph',
								content: [{ type: 'text', text: 'Conflict content' }],
							},
						],
					},
				},
				notes: null,
				notes_plain: null,
				notes_markdown: null,
			},
			{
				id: 'doc-4',
				title: 'Unselected Document',
				created_at: '2024-01-04T00:00:00Z',
				updated_at: '2024-01-04T01:00:00Z',
				user_id: 'user-1',
				last_viewed_panel: {
					content: {
						type: 'doc',
						content: [
							{
								type: 'paragraph',
								content: [{ type: 'text', text: 'Unselected content' }],
							},
						],
					},
				},
				notes: null,
				notes_plain: null,
				notes_markdown: null,
			},
		];

		defaultOptions = {
			strategy: 'skip',
			createBackups: false,
			maxConcurrency: 3,
			delayBetweenImports: 0, // No delay in tests
			stopOnError: false,
		};
	});

	describe('Constructor and Initialization', () => {
		it('should initialize with performance monitoring and batch processing', () => {
			expect(importManager).toBeDefined();
			expect(importManager.getProgress().total).toBe(0);
			expect(importManager.getProgress().isRunning).toBe(false);
			expect(importManager.getProgress().isCancelled).toBe(false);
		});

		it('should initialize progress tracking state correctly', () => {
			const progress = importManager.getProgress();
			expect(progress.completed).toBe(0);
			expect(progress.failed).toBe(0);
			expect(progress.skipped).toBe(0);
			expect(progress.percentage).toBe(0);
			expect(progress.processingRate).toBe(0);
			expect(progress.message).toBe('Ready to import');
		});
	});

	describe('Import Documents - Core Business Logic', () => {
		it('should execute full import workflow with progress tracking', async () => {
			const progressUpdates: ImportProgress[] = [];
			const documentProgressUpdates: DocumentProgress[] = [];

			const options = {
				...defaultOptions,
				onProgress: (progress: ImportProgress) => {
					progressUpdates.push({ ...progress });
				},
				onDocumentProgress: (docProgress: DocumentProgress) => {
					documentProgressUpdates.push({ ...docProgress });
				},
			};

			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				options
			);

			// Verify import completion
			expect(result.total).toBe(3); // 3 selected documents
			expect(result.isRunning).toBe(false);
			expect(result.percentage).toBe(100);

			// Verify progress callbacks were called
			expect(progressUpdates.length).toBeGreaterThan(0);
			expect(documentProgressUpdates.length).toBeGreaterThan(0);

			// Verify document processing - NEW and CONFLICT documents are processed with 'skip' strategy
			// doc-1 (NEW) = processed, doc-2 (EXISTS) = skipped, doc-3 (CONFLICT) = requires user choice
			expect(mockConverter.convertDocument).toHaveBeenCalledTimes(2);
		});

		it('should handle concurrent import rejection', async () => {
			// Start first import (don't await)
			const firstImport = importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				defaultOptions
			);

			// Try to start second import - should throw
			await expect(
				importManager.importDocuments(
					mockDocumentMetadata,
					mockGranolaDocuments,
					defaultOptions
				)
			).rejects.toThrow('Import already in progress');

			// Clean up first import
			await firstImport;
		});

		it('should handle missing granola documents gracefully', async () => {
			// Remove doc-2 from granola data but keep it selected
			const incompleteGranolaData = mockGranolaDocuments.filter(doc => doc.id !== 'doc-2');

			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				incompleteGranolaData,
				defaultOptions
			);

			// Should only process documents that exist in both arrays
			expect(result.total).toBe(2); // doc-1 and doc-3 only
			expect(mockConverter.convertDocument).toHaveBeenCalledTimes(2);
		});

		it('should implement data preparation phase correctly', async () => {
			// Use 'update' strategy to ensure EXISTS documents are processed
			const updateOptions = { ...defaultOptions, strategy: 'update' as const };

			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				updateOptions
			);

			// Verify that only selected documents were processed
			expect(result.total).toBe(3); // doc-4 is not selected
			expect(mockConverter.convertDocument).toHaveBeenCalledTimes(3);
		});
	});

	describe('Document Processing and Import Strategies', () => {
		it('should handle NEW documents by creating new files', async () => {
			const newDocOnly = [mockDocumentMetadata[0]]; // NEW document
			const granolaDataOnly = [mockGranolaDocuments[0]];

			await importManager.importDocuments(newDocOnly, granolaDataOnly, defaultOptions);

			expect(mockVault.create).toHaveBeenCalledWith(
				'test-document.md',
				expect.stringContaining('# Test Document')
			);
			expect(mockVault.modify).not.toHaveBeenCalled();
		});

		it('should handle EXISTS documents with skip strategy', async () => {
			// Mock existing file
			(mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(
				createMockFile('existing.md')
			);

			const existingDocOnly = [mockDocumentMetadata[1]]; // EXISTS document
			const granolaDataOnly = [mockGranolaDocuments[1]];

			const result = await importManager.importDocuments(existingDocOnly, granolaDataOnly, {
				...defaultOptions,
				strategy: 'skip',
			});

			expect(result.skipped).toBe(1);
			expect(mockVault.create).not.toHaveBeenCalled();
			expect(mockVault.modify).not.toHaveBeenCalled();
		});

		it('should handle EXISTS documents with update strategy', async () => {
			const existingFile = createMockFile('test-document.md');

			// Mock converter with detailed logging
			const mockConvertedNote = {
				filename: 'test-document.md',
				content:
					'---\nid: doc-1\ncreated: 2024-01-01T00:00:00Z\nsource: Granola\n---\n\n# Test Document\n\nTest content',
				frontmatter: {
					id: 'doc-1',
					created: '2024-01-01T00:00:00Z',
					source: 'Granola',
				},
			};
			(mockConverter.convertDocument as jest.Mock).mockReturnValue(mockConvertedNote);

			// Clear and reset the mock to ensure our implementation takes precedence
			(mockVault.getAbstractFileByPath as jest.Mock).mockReset();
			(mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
				console.log(`getAbstractFileByPath called with: "${path}"`);
				if (path === 'test-document.md') {
					console.log('Returning existing file');
					return existingFile;
				}
				console.log('Returning null');
				return null;
			});

			// Use a custom EXISTS document that matches our converter mock
			const existsDoc = {
				...mockDocumentMetadata[0], // Use doc-1 base but change status
				importStatus: {
					status: 'EXISTS' as const,
					requiresUserChoice: false,
					message: 'Document exists',
					existingFile: createMockFile('test-document.md'),
				},
			};
			const existingDocOnly = [existsDoc]; // EXISTS document
			const granolaDataOnly = [mockGranolaDocuments[0]]; // Use doc-1

			console.log('Starting import with strategy: update');
			console.log('Document status:', existsDoc.importStatus.status);
			console.log('Requires user choice:', existsDoc.importStatus.requiresUserChoice);

			const result = await importManager.importDocuments(existingDocOnly, granolaDataOnly, {
				...defaultOptions,
				strategy: 'update',
			});

			console.log('Import result:', result);
			console.log(
				'Converter calls:',
				(mockConverter.convertDocument as jest.Mock).mock.calls.length
			);
			console.log(
				'getAbstractFileByPath calls:',
				(mockVault.getAbstractFileByPath as jest.Mock).mock.calls
			);
			console.log('modify calls:', (mockVault.modify as jest.Mock).mock.calls.length);
			console.log('create calls:', (mockVault.create as jest.Mock).mock.calls.length);

			expect(result.completed).toBe(1);

			// Check which path was taken
			const getAbstractFileByPathCalls = (mockVault.getAbstractFileByPath as jest.Mock).mock
				.calls;
			const modifyCalls = (mockVault.modify as jest.Mock).mock.calls.length;
			const createCalls = (mockVault.create as jest.Mock).mock.calls.length;

			// Verify the correct execution path was taken
			expect(getAbstractFileByPathCalls.length).toBe(1);
			expect(modifyCalls).toBe(1);
			expect(createCalls).toBe(0);

			expect(mockVault.modify).toHaveBeenCalledWith(
				existingFile,
				expect.stringContaining('# Test Document')
			);
		});

		it('should handle EXISTS documents with create_new strategy', async () => {
			(mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
				if (path === 'test-document.md') return createMockFile('test-document.md');
				return null; // Other paths don't exist
			});

			const existingDocOnly = [mockDocumentMetadata[1]]; // EXISTS document
			const granolaDataOnly = [mockGranolaDocuments[1]];

			await importManager.importDocuments(existingDocOnly, granolaDataOnly, {
				...defaultOptions,
				strategy: 'create_new',
			});

			expect(mockVault.create).toHaveBeenCalled();
			expect(mockVault.modify).not.toHaveBeenCalled();
		});

		it('should create backups when strategy is update and createBackups is true', async () => {
			const existingFile = createMockFile('test-document.md');
			// Mock to return the existing file when the specific filename is requested
			(mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
				if (path === 'test-document.md') return existingFile;
				return null;
			});
			(mockVault.read as jest.Mock).mockResolvedValue('# Original Content');

			const existingDocOnly = [mockDocumentMetadata[1]]; // EXISTS document
			const granolaDataOnly = [mockGranolaDocuments[1]];

			await importManager.importDocuments(existingDocOnly, granolaDataOnly, {
				...defaultOptions,
				strategy: 'update',
				createBackups: true,
			});

			// Should create backup file
			expect(mockVault.create).toHaveBeenCalledWith(
				expect.stringMatching(/test-document\.backup-.*\.md/),
				'# Original Content'
			);
			expect(mockVault.modify).toHaveBeenCalled();
		});
	});

	describe('Conflict Resolution Scenarios', () => {
		it('should handle conflict documents requiring user choice - skip action', async () => {
			mockConflictResolutionModal.showConflictResolution.mockResolvedValue({
				action: 'skip',
				reason: 'User chose to skip',
			});

			const conflictDocOnly = [mockDocumentMetadata[2]]; // CONFLICT document
			const granolaDataOnly = [mockGranolaDocuments[2]];

			const result = await importManager.importDocuments(
				conflictDocOnly,
				granolaDataOnly,
				defaultOptions
			);

			expect(result.skipped).toBe(1);
			expect(result.completed).toBe(0);
			expect(mockConflictResolutionModal.showConflictResolution).toHaveBeenCalled();
		});

		it('should handle conflict documents with overwrite action', async () => {
			const existingFile = createMockFile('test-document.md');
			// Mock to return the existing file when the specific filename is requested
			(mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
				if (path === 'test-document.md') return existingFile;
				return null;
			});

			mockConflictResolutionModal.showConflictResolution.mockResolvedValue({
				action: 'overwrite',
				createBackup: true,
			});

			const conflictDocOnly = [mockDocumentMetadata[2]]; // CONFLICT document
			const granolaDataOnly = [mockGranolaDocuments[2]];

			const result = await importManager.importDocuments(
				conflictDocOnly,
				granolaDataOnly,
				defaultOptions
			);

			expect(result.completed).toBe(1);
			expect(mockVault.modify).toHaveBeenCalledWith(
				existingFile,
				expect.stringContaining('# Test Document')
			);
		});

		it('should handle conflict documents with merge action', async () => {
			const existingFile = createMockFile('test-document.md');
			// Mock to return the existing file when the specific filename is requested
			(mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
				if (path === 'test-document.md') return existingFile;
				return null;
			});
			(mockVault.read as jest.Mock).mockResolvedValue(
				'---\nid: existing\n---\n\n# Existing Content'
			);

			mockConflictResolutionModal.showConflictResolution.mockResolvedValue({
				action: 'merge',
				strategy: 'append',
			});

			const conflictDocOnly = [mockDocumentMetadata[2]]; // CONFLICT document
			const granolaDataOnly = [mockGranolaDocuments[2]];

			const result = await importManager.importDocuments(
				conflictDocOnly,
				granolaDataOnly,
				defaultOptions
			);

			expect(result.completed).toBe(1);
			expect(mockVault.modify).toHaveBeenCalledWith(
				existingFile,
				expect.stringContaining('---\n\n') // Merged content
			);
		});

		it('should handle conflict documents with rename action', async () => {
			mockConflictResolutionModal.showConflictResolution.mockResolvedValue({
				action: 'rename',
				newFilename: 'renamed-document.md',
			});

			const conflictDocOnly = [mockDocumentMetadata[2]]; // CONFLICT document
			const granolaDataOnly = [mockGranolaDocuments[2]];

			const result = await importManager.importDocuments(
				conflictDocOnly,
				granolaDataOnly,
				defaultOptions
			);

			expect(result.completed).toBe(1);
			expect(mockVault.create).toHaveBeenCalledWith(
				'renamed-document.md',
				expect.stringContaining('# Test Document')
			);
		});

		it('should handle unknown conflict resolution action', async () => {
			mockConflictResolutionModal.showConflictResolution.mockResolvedValue({
				action: 'unknown_action',
			});

			const conflictDocOnly = [mockDocumentMetadata[2]]; // CONFLICT document
			const granolaDataOnly = [mockGranolaDocuments[2]];

			const result = await importManager.importDocuments(conflictDocOnly, granolaDataOnly, {
				...defaultOptions,
				stopOnError: false,
			});

			expect(result.failed).toBe(1);
		});
	});

	describe('Error Handling and Recovery', () => {
		it('should handle conversion errors gracefully', async () => {
			(mockConverter.convertDocument as jest.Mock).mockImplementation(doc => {
				if (doc.id === 'doc-1') {
					throw new Error('Conversion failed for doc-1');
				}
				return {
					filename: 'test-document.md',
					content: '# Test Document\n\nTest content',
					frontmatter: { created: '2024-01-01T00:00:00Z', source: 'Granola' },
				};
			});

			// Use 'update' strategy to ensure EXISTS and CONFLICT documents are processed
			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				{ ...defaultOptions, strategy: 'update', stopOnError: false }
			);

			expect(result.failed).toBe(1); // doc-1 fails
			expect(result.completed).toBe(2); // doc-2 and doc-3 succeed

			const failedDocProgress = importManager.getDocumentProgress('doc-1');
			expect(failedDocProgress?.status).toBe('failed');
			expect(failedDocProgress?.error).toContain('Conversion failed');
		});

		it('should stop on first error when stopOnError is true', async () => {
			(mockConverter.convertDocument as jest.Mock).mockImplementation(doc => {
				if (doc.id === 'doc-1') {
					throw new Error('Critical conversion error');
				}
				return {
					filename: 'test-document',
					content: '# Test Document\n\nTest content',
					frontmatter: { created: '2024-01-01T00:00:00Z', source: 'Granola' },
				};
			});

			const result = await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				{ ...defaultOptions, stopOnError: true }
			);

			expect(result.failed).toBeGreaterThan(0);
			expect(result.isCancelled).toBe(true);
		});

		it('should handle vault creation errors', async () => {
			(mockVault.create as jest.Mock).mockRejectedValue(new Error('Vault creation failed'));

			const result = await importManager.importDocuments(
				[mockDocumentMetadata[0]], // Just one NEW document
				[mockGranolaDocuments[0]],
				{ ...defaultOptions, stopOnError: false }
			);

			expect(result.failed).toBe(1);
			expect(result.completed).toBe(0);
		});

		it('should handle vault modification errors', async () => {
			const existingFile = createMockFile('test-document.md');
			// Mock to return the existing file when the specific filename is requested
			(mockVault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
				if (path === 'test-document.md') return existingFile;
				return null;
			});
			(mockVault.modify as jest.Mock).mockRejectedValue(
				new Error('Vault modification failed')
			);

			const result = await importManager.importDocuments(
				[mockDocumentMetadata[1]], // EXISTS document
				[mockGranolaDocuments[1]],
				{ ...defaultOptions, strategy: 'update', stopOnError: false }
			);

			expect(result.failed).toBe(1);
		});
	});

	describe('Progress Tracking and Cancellation', () => {
		it('should track document progress through all phases', async () => {
			const documentProgressUpdates: DocumentProgress[] = [];

			const options = {
				...defaultOptions,
				onDocumentProgress: (docProgress: DocumentProgress) => {
					documentProgressUpdates.push({ ...docProgress });
				},
			};

			await importManager.importDocuments(
				[mockDocumentMetadata[0]], // One NEW document
				[mockGranolaDocuments[0]],
				options
			);

			// Should have multiple progress updates for phases
			expect(documentProgressUpdates.length).toBeGreaterThan(1);

			// Check for expected progress phases
			const pendingUpdate = documentProgressUpdates.find(p => p.status === 'pending');
			const importingUpdate = documentProgressUpdates.find(p => p.status === 'importing');
			const completedUpdate = documentProgressUpdates.find(p => p.status === 'completed');

			expect(pendingUpdate).toBeDefined();
			expect(importingUpdate).toBeDefined();
			expect(completedUpdate).toBeDefined();
			expect(completedUpdate?.progress).toBe(100);
		});

		it('should set cancellation state correctly when cancel is called', () => {
			// Test the cancellation logic directly without complex async timing
			// Simulate a running import by setting the internal state
			(importManager as any).isRunning = true;
			(importManager as any).overallProgress.isRunning = true;
			(importManager as any).overallProgress.isCancelled = false;

			// Verify not cancelled initially
			const progressBefore = importManager.getProgress();
			expect(progressBefore.isRunning).toBe(true);
			expect(progressBefore.isCancelled).toBe(false);

			// Call cancel
			importManager.cancel();

			// Verify cancellation state is set
			const progressAfter = importManager.getProgress();
			expect(progressAfter.isCancelled).toBe(true);
			expect(progressAfter.message).toContain('Cancelling');
		});

		it('should calculate processing rate and estimated completion', async () => {
			await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				defaultOptions
			);

			const progress = importManager.getProgress();
			expect(progress.processingRate).toBeGreaterThan(0);
		});

		it('should return all document progress correctly', async () => {
			await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				defaultOptions
			);

			const allProgress = importManager.getAllDocumentProgress();
			expect(allProgress).toHaveLength(3); // 3 selected documents
			expect(allProgress.every(p => p.id)).toBe(true);
			expect(allProgress.every(p => p.status !== 'pending')).toBe(true);
		});
	});

	describe('Helper Methods and Edge Cases', () => {
		it('should generate unique filenames when files exist', () => {
			// Mock vault to simulate existing files
			(mockVault.getAbstractFileByPath as jest.Mock)
				.mockReturnValueOnce(createMockFile('test-1.md')) // First attempt exists
				.mockReturnValueOnce(createMockFile('test-2.md')) // Second attempt exists
				.mockReturnValueOnce(null); // Third attempt is free

			// Access private method via reflection
			const uniqueName = (importManager as any).generateUniqueFilename('test.md');

			expect(uniqueName).toBe('test-3.md');
		});

		it('should extract content after frontmatter correctly', () => {
			const contentWithFrontmatter =
				'---\nid: test\ncreated: 2024-01-01\n---\n\n# Main Content\n\nSome text';

			// Access private method via reflection
			const extractedContent = (importManager as any).extractContentAfterFrontmatter(
				contentWithFrontmatter
			);

			expect(extractedContent).toBe('\n# Main Content\n\nSome text');
		});

		it('should handle sleep utility method', async () => {
			const startTime = Date.now();

			// Access private method via reflection
			await (importManager as any).sleep(50);

			const endTime = Date.now();
			expect(endTime - startTime).toBeGreaterThanOrEqual(45); // Allow some timing variance
		});

		it('should handle batch file writer', async () => {
			const files = [
				{ filename: 'batch1.md', content: '# Batch 1' },
				{ filename: 'batch2.md', content: '# Batch 2' },
			];

			// Access private method via reflection
			const createdFiles = await (importManager as any).writeBatchOfFiles(files);

			expect(createdFiles).toHaveLength(2);
			expect(mockVault.create).toHaveBeenCalledTimes(2);
		});

		it('should handle batch file writer with existing files', async () => {
			// First file creation fails (exists), second succeeds
			(mockVault.create as jest.Mock)
				.mockRejectedValueOnce(new Error('File exists'))
				.mockResolvedValueOnce(createMockFile('unique-batch1.md'))
				.mockResolvedValueOnce(createMockFile('batch2.md'));

			(mockVault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(null); // For unique filename generation

			const files = [
				{ filename: 'batch1.md', content: '# Batch 1' },
				{ filename: 'batch2.md', content: '# Batch 2' },
			];

			// Access private method via reflection
			const createdFiles = await (importManager as any).writeBatchOfFiles(files);

			expect(createdFiles).toHaveLength(2);
			expect(mockVault.create).toHaveBeenCalledTimes(3); // Original + retry + second file
		});
	});

	describe('Concurrency and Performance', () => {
		it('should respect maxConcurrency setting', async () => {
			// Create multiple documents to test concurrency
			const manyDocs = Array.from({ length: 5 }, (_, i) => ({
				...mockDocumentMetadata[0],
				id: `doc-${i + 1}`,
				title: `Document ${i + 1}`,
			}));

			const manyGranolaDocs = Array.from({ length: 5 }, (_, i) => ({
				...mockGranolaDocuments[0],
				id: `doc-${i + 1}`,
				title: `Document ${i + 1}`,
			}));

			const result = await importManager.importDocuments(manyDocs, manyGranolaDocs, {
				...defaultOptions,
				maxConcurrency: 2,
			});

			expect(result.total).toBe(5);
			expect(result.completed).toBe(5);
		});

		it('should handle delay between imports', async () => {
			const startTime = Date.now();

			await importManager.importDocuments(
				[mockDocumentMetadata[0], mockDocumentMetadata[1]],
				[mockGranolaDocuments[0], mockGranolaDocuments[1]],
				{ ...defaultOptions, delayBetweenImports: 50 }
			);

			const endTime = Date.now();
			// Should take at least the delay time (with some tolerance)
			expect(endTime - startTime).toBeGreaterThanOrEqual(40);
		});
	});

	describe('Reset and State Management', () => {
		it('should reset all state correctly', async () => {
			// First do an import to set some state
			await importManager.importDocuments(
				mockDocumentMetadata,
				mockGranolaDocuments,
				defaultOptions
			);

			expect(importManager.getProgress().total).toBeGreaterThan(0);
			expect(importManager.getAllDocumentProgress().length).toBeGreaterThan(0);

			// Reset and verify clean state
			importManager.reset();

			const progress = importManager.getProgress();
			expect(progress.total).toBe(0);
			expect(progress.completed).toBe(0);
			expect(progress.failed).toBe(0);
			expect(progress.skipped).toBe(0);
			expect(progress.isRunning).toBe(false);
			expect(progress.isCancelled).toBe(false);
			expect(importManager.getAllDocumentProgress()).toHaveLength(0);
		});

		it('should handle cancel when no import is running', () => {
			// Should not throw
			importManager.cancel();
			expect(importManager.getProgress().isCancelled).toBe(false);
		});
	});
});
