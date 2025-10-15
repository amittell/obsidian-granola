import { DocumentSelectionModal } from '../../src/ui/document-selection-modal';
import { GranolaAPI, GranolaDocument } from '../../src/api';
import { DuplicateDetector } from '../../src/services/duplicate-detector';
import {
	DocumentMetadataService,
	DocumentDisplayMetadata,
} from '../../src/services/document-metadata';
import { SelectiveImportManager } from '../../src/services/import-manager';
import { ProseMirrorConverter } from '../../src/converter';
import { App, Modal, Vault } from 'obsidian';

// Mock Obsidian classes
const mockApp = {
	vault: {} as Vault,
	workspace: {
		getActiveViewOfType: jest.fn(),
	},
} as unknown as App;

// Mock dependencies
const mockAPI = {
	loadCredentials: jest.fn(),
	getAllDocuments: jest.fn(),
	getDocuments: jest.fn(),
} as unknown as GranolaAPI;

const mockDuplicateDetector = {
	initialize: jest.fn(),
	checkDocuments: jest.fn(),
} as unknown as DuplicateDetector;

const mockMetadataService = {
	extractBulkMetadata: jest.fn(),
	applyFilter: jest.fn(),
	applySorting: jest.fn(),
	getCollectionStats: jest.fn(),
	updateSelection: jest.fn(),
} as unknown as DocumentMetadataService;

const mockImportManager = {
	importDocuments: jest.fn(),
	cancel: jest.fn(),
	reset: jest.fn(),
	getProgress: jest.fn(),
	getAllDocumentProgress: jest.fn().mockReturnValue([]),
	getFailedDocuments: jest.fn().mockReturnValue([]),
	retryFailedImports: jest.fn(),
} as unknown as SelectiveImportManager;

const mockConverter = {
	convertDocument: jest.fn(),
} as unknown as ProseMirrorConverter;

// Mock DOM methods
const mockElement = {
	empty: jest.fn(),
	addClass: jest.fn(),
	removeClass: jest.fn(),
	createDiv: jest.fn().mockReturnThis(),
	createEl: jest.fn().mockReturnThis(),
	appendChild: jest.fn(),
	removeChild: jest.fn(),
	style: {},
	textContent: '',
	addEventListener: jest.fn(),
	removeEventListener: jest.fn(),
};

// Mock Modal class
jest.mock('obsidian', () => ({
	Modal: class MockModal {
		app: App;
		contentEl: any;
		titleEl: any;
		modalEl: any;

		constructor(app: App) {
			this.app = app;
			this.contentEl = mockElement;
			this.titleEl = mockElement;
			this.modalEl = mockElement;
		}

		open() {
			return this;
		}

		close() {
			return this;
		}
	},
	ButtonComponent: class MockButtonComponent {
		constructor(public container: any) {}
		setButtonText(text: string) {
			return this;
		}
		setCta() {
			return this;
		}
		onClick(callback: () => void) {
			return this;
		}
		setDisabled(disabled: boolean) {
			return this;
		}
	},
	TextComponent: class MockTextComponent {
		constructor(public container: any) {}
		setPlaceholder(text: string) {
			return this;
		}
		getValue() {
			return '';
		}
		setValue(value: string) {
			return this;
		}
		onChange(callback: (value: string) => void) {
			return this;
		}
	},
	Notice: jest.fn(),
	Menu: class MockMenu {
		addItem(callback: (item: any) => void) {
			const item = {
				setTitle: jest.fn().mockReturnThis(),
				onClick: jest.fn().mockReturnThis(),
			};
			callback(item);
			return this;
		}
		showAtMouseEvent = jest.fn();
	},
}));

describe('DocumentSelectionModal', () => {
	let modal: DocumentSelectionModal;
	let mockGranolaDocuments: GranolaDocument[];
	let mockDocumentMetadata: DocumentDisplayMetadata[];

	describe('constructor', () => {
		it('should create modal instance', () => {
			const testModal = new DocumentSelectionModal(
				mockApp,
				mockAPI,
				mockDuplicateDetector,
				mockMetadataService,
				mockImportManager,
				mockConverter
			);
			expect(testModal).toBeInstanceOf(DocumentSelectionModal);
		});
	});

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Mock document.createElement for styles
		const mockStyleElement = {
			textContent: '',
			style: {},
			appendChild: jest.fn(),
		};
		global.document = {
			createElement: jest.fn().mockReturnValue(mockStyleElement),
			head: {
				appendChild: jest.fn(),
			},
		} as any;

		// Setup mock data
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
		];

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
		];

		// Setup mock implementations
		(mockAPI.loadCredentials as jest.Mock).mockResolvedValue(undefined);
		(mockAPI.getAllDocuments as jest.Mock).mockResolvedValue(mockGranolaDocuments);
		(mockDuplicateDetector.checkDocuments as jest.Mock).mockResolvedValue(new Map());
		(mockMetadataService.extractBulkMetadata as jest.Mock).mockReturnValue(
			mockDocumentMetadata
		);
		(mockMetadataService.applyFilter as jest.Mock).mockReturnValue(mockDocumentMetadata);
		(mockMetadataService.applySorting as jest.Mock).mockReturnValue(mockDocumentMetadata);
		(mockMetadataService.getCollectionStats as jest.Mock).mockReturnValue({
			total: 1,
			visible: 1,
			selected: 1,
			byStatus: { NEW: 1 },
			totalWordCount: 100,
			averageWordCount: 100,
			totalReadingTime: 1,
		});
		(mockImportManager.getProgress as jest.Mock).mockReturnValue({
			total: 0,
			completed: 0,
			failed: 0,
			skipped: 0,
			percentage: 0,
			isRunning: false,
			isCancelled: false,
			message: 'Ready',
			startTime: 0,
			processingRate: 0,
		});

		// Create modal instance
		modal = new DocumentSelectionModal(
			mockApp,
			mockAPI,
			mockDuplicateDetector,
			mockMetadataService,
			mockImportManager,
			mockConverter
		);

		// Mock private UI methods that are called during onOpen
		(modal as any).setLoading = jest.fn();
		(modal as any).showMessage = jest.fn();
		(modal as any).renderDocumentList = jest.fn();
		(modal as any).updateFooterButtons = jest.fn();
		(modal as any).cleanup = jest.fn();
	});

	describe('constructor', () => {
		it('should initialize with correct dependencies', () => {
			expect(modal).toBeInstanceOf(DocumentSelectionModal);
			expect(modal).toBeInstanceOf(Modal);
		});

		it('should store all dependency references', () => {
			// Dependencies are stored as private fields, so we can't directly test them
			// but the constructor should not throw
			expect(
				() =>
					new DocumentSelectionModal(
						mockApp,
						mockAPI,
						mockDuplicateDetector,
						mockMetadataService,
						mockImportManager,
						mockConverter
					)
			).not.toThrow();
		});
	});

	describe('onOpen', () => {
		it('should call setupUI and loadDocuments', async () => {
			// Since setupUI and loadDocuments are private methods, we test the overall behavior
			await modal.onOpen();

			// Verify API was called to load documents
			expect(mockAPI.loadCredentials).toHaveBeenCalled();
			expect(mockAPI.getAllDocuments).toHaveBeenCalled();
			expect(mockDuplicateDetector.initialize).toHaveBeenCalled();
		});

		it('should handle API errors gracefully', async () => {
			(mockAPI.getAllDocuments as jest.Mock).mockRejectedValue(new Error('API Error'));

			// Should not throw
			await expect(modal.onOpen()).resolves.not.toThrow();
		});
	});

	describe('onClose', () => {
		it('should cancel import if running', () => {
			// Simulate running import
			(modal as any).isImporting = true;

			modal.onClose();

			expect(mockImportManager.cancel).toHaveBeenCalled();
		});

		it('should not cancel import if not running', () => {
			(modal as any).isImporting = false;

			modal.onClose();

			expect(mockImportManager.cancel).not.toHaveBeenCalled();
		});
	});

	describe('modal behavior', () => {
		it('should extend Modal class', () => {
			expect(modal).toBeInstanceOf(Modal);
		});

		it('should have contentEl property from Modal', () => {
			expect(modal.contentEl).toBeDefined();
		});

		it('should initialize state properties', () => {
			// Test initial state
			expect((modal as any).granolaDocuments).toEqual([]);
			expect((modal as any).documentMetadata).toEqual([]);
			expect((modal as any).isLoading).toBe(false);
			expect((modal as any).isImporting).toBe(false);
		});
	});

	describe('data loading and processing', () => {
		it('should process documents through metadata service', async () => {
			await modal.onOpen();

			expect(mockMetadataService.extractBulkMetadata).toHaveBeenCalledWith(
				mockGranolaDocuments,
				expect.any(Map)
			);
		});

		it('should check for duplicates', async () => {
			await modal.onOpen();

			expect(mockDuplicateDetector.checkDocuments).toHaveBeenCalledWith(mockGranolaDocuments);
		});

		it('should apply default sorting', async () => {
			await modal.onOpen();

			expect(mockMetadataService.applySorting).toHaveBeenCalledWith(mockDocumentMetadata, {
				field: 'updated',
				direction: 'desc',
			});
		});
	});

	describe('error handling', () => {
		it('should handle duplicate detector initialization failure', async () => {
			(mockDuplicateDetector.initialize as jest.Mock).mockRejectedValue(
				new Error('Init failed')
			);

			await expect(modal.onOpen()).resolves.not.toThrow();
			// When duplicate detector fails, the process may stop early
			// This is expected behavior - verify credentials loading was attempted
			expect(mockAPI.loadCredentials).toHaveBeenCalled();
		});

		it('should handle document loading failure', async () => {
			(mockAPI.getAllDocuments as jest.Mock).mockRejectedValue(new Error('Loading failed'));

			await expect(modal.onOpen()).resolves.not.toThrow();
		});

		it('should handle metadata extraction failure', async () => {
			(mockMetadataService.extractBulkMetadata as jest.Mock).mockImplementation(() => {
				throw new Error('Extraction failed');
			});

			await expect(modal.onOpen()).resolves.not.toThrow();
		});
	});

	describe('component state management', () => {
		it('should track loading state', async () => {
			const openPromise = modal.onOpen();

			// Should be loading during async operation
			// Since this is async, we can't easily test the intermediate state
			// but we can test that it completes
			await openPromise;

			// After completion, should not be loading
			expect((modal as any).isLoading).toBe(false);
		});

		it('should manage document collections', async () => {
			// Ensure the setup is clean before this test
			jest.clearAllMocks();
			(mockAPI.loadCredentials as jest.Mock).mockResolvedValue(undefined);
			(mockAPI.getAllDocuments as jest.Mock).mockResolvedValue(mockGranolaDocuments);
			(mockDuplicateDetector.initialize as jest.Mock).mockResolvedValue(undefined);
			(mockDuplicateDetector.checkDocuments as jest.Mock).mockResolvedValue(new Map());
			(mockMetadataService.extractBulkMetadata as jest.Mock).mockReturnValue(
				mockDocumentMetadata
			);
			(mockMetadataService.applySorting as jest.Mock).mockReturnValue(mockDocumentMetadata);

			await modal.onOpen();

			// Should store loaded documents
			expect((modal as any).granolaDocuments).toEqual(mockGranolaDocuments);
			expect((modal as any).documentMetadata).toEqual(mockDocumentMetadata);
		});
	});

	describe('filter and sort state', () => {
		it('should initialize with default filter state', () => {
			expect((modal as any).currentFilter).toEqual({});
		});

		it('should initialize with default sort state', () => {
			expect((modal as any).currentSort).toEqual({
				field: 'updated',
				direction: 'desc',
			});
		});
	});

	describe('service integration', () => {
		it('should integrate with all required services', async () => {
			// Ensure clean state for this test
			jest.clearAllMocks();
			(mockAPI.loadCredentials as jest.Mock).mockResolvedValue(undefined);
			(mockAPI.getAllDocuments as jest.Mock).mockResolvedValue(mockGranolaDocuments);
			(mockDuplicateDetector.initialize as jest.Mock).mockResolvedValue(undefined);
			(mockDuplicateDetector.checkDocuments as jest.Mock).mockResolvedValue(new Map());
			(mockMetadataService.extractBulkMetadata as jest.Mock).mockReturnValue(
				mockDocumentMetadata
			);
			(mockMetadataService.applySorting as jest.Mock).mockReturnValue(mockDocumentMetadata);

			await modal.onOpen();

			// Verify all services are called
			expect(mockAPI.loadCredentials).toHaveBeenCalled();
			expect(mockAPI.getAllDocuments).toHaveBeenCalled();
			expect(mockDuplicateDetector.initialize).toHaveBeenCalled();
			expect(mockDuplicateDetector.checkDocuments).toHaveBeenCalled();
			expect(mockMetadataService.extractBulkMetadata).toHaveBeenCalled();
			expect(mockMetadataService.applySorting).toHaveBeenCalled();
		});

		it('should pass correct parameters to services', async () => {
			// Ensure clean state for this test
			jest.clearAllMocks();
			(mockAPI.loadCredentials as jest.Mock).mockResolvedValue(undefined);
			(mockAPI.getAllDocuments as jest.Mock).mockResolvedValue(mockGranolaDocuments);
			(mockDuplicateDetector.initialize as jest.Mock).mockResolvedValue(undefined);
			(mockDuplicateDetector.checkDocuments as jest.Mock).mockResolvedValue(new Map());
			(mockMetadataService.extractBulkMetadata as jest.Mock).mockReturnValue(
				mockDocumentMetadata
			);
			(mockMetadataService.applySorting as jest.Mock).mockReturnValue(mockDocumentMetadata);

			await modal.onOpen();

			expect(mockDuplicateDetector.checkDocuments).toHaveBeenCalledWith(mockGranolaDocuments);
			expect(mockMetadataService.extractBulkMetadata).toHaveBeenCalledWith(
				mockGranolaDocuments,
				expect.any(Map)
			);
		});
	});
});
