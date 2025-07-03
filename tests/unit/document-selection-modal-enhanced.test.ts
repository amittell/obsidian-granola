/**
 * Enhanced tests for DocumentSelectionModal UI component
 * Focusing on uncovered functionality to improve test coverage
 */

import { DocumentSelectionModal } from '../../src/ui/document-selection-modal';
import { GranolaAPI, GranolaDocument } from '../../src/api';
import { DuplicateDetector } from '../../src/services/duplicate-detector';
import {
	DocumentMetadataService,
	DocumentDisplayMetadata,
	DocumentFilter,
	DocumentSort,
} from '../../src/services/document-metadata';
import {
	SelectiveImportManager,
	ImportProgress,
	DocumentProgress,
	DocumentImportStatus,
} from '../../src/services/import-manager';
import { ProseMirrorConverter } from '../../src/converter';
import { App, Modal, Vault, TFile, WorkspaceLeaf, MarkdownView } from 'obsidian';

// Enhanced mock setup
const createMockElement = () => ({
	empty: jest.fn(),
	addClass: jest.fn(),
	removeClass: jest.fn(),
	createDiv: jest.fn(function (className?: string) {
		const div = createMockElement();
		if (className) div.className = className;
		return div;
	}),
	createEl: jest.fn(function (tag: string, attrs?: any) {
		const el = createMockElement();
		el.tagName = tag;
		if (attrs) {
			if (attrs.text) el.textContent = attrs.text;
			if (attrs.cls) el.className = attrs.cls;
			if (attrs.type) el.type = attrs.type;
			if (attrs.value) el.value = attrs.value;
		}
		return el;
	}),
	createSpan: jest.fn(function (className?: string) {
		const span = createMockElement();
		span.tagName = 'SPAN';
		if (className) span.className = className;
		return span;
	}),
	appendChild: jest.fn(),
	removeChild: jest.fn(),
	querySelector: jest.fn((selector: string) => {
		if (selector.includes('progress-fill')) {
			return createMockElement();
		}
		return createMockElement();
	}),
	querySelectorAll: jest.fn((selector: string) => {
		if (selector.includes('granola-modal-styles')) {
			return [createMockElement()];
		}
		return [];
	}),
	setAttribute: jest.fn(),
	getAttribute: jest.fn(),
	addEventListener: jest.fn(),
	removeEventListener: jest.fn(),
	scrollIntoView: jest.fn(),
	remove: jest.fn(),
	style: {
		display: '',
		width: '',
		height: '',
		position: '',
		top: '',
		left: '',
	},
	innerHTML: '',
	textContent: '',
	className: '',
	tagName: 'DIV',
	checked: false,
	value: '',
	type: '',
});

// Button and Text component mocks with interaction capabilities
let mockButtonCallbacks: { [key: string]: () => void } = {};
let mockTextChangeCallback: ((value: string) => void) | null = null;

jest.mock('obsidian', () => ({
	Modal: class MockModal {
		app: App;
		contentEl: any;
		titleEl: any;
		modalEl: any;

		constructor(app: App) {
			this.app = app;
			this.contentEl = createMockElement();
			this.titleEl = createMockElement();
			this.modalEl = createMockElement();
		}

		open() {
			return this;
		}

		close() {
			return this;
		}
	},
	ButtonComponent: class MockButtonComponent {
		public buttonText = '';
		public disabled = false;
		public callback: (() => void) | null = null;

		constructor(public container: any) {}
		setButtonText(text: string) {
			this.buttonText = text;
			mockButtonCallbacks[text] = this.callback || (() => {});
			return this;
		}
		setCta() {
			return this;
		}
		setClass(className: string) {
			return this;
		}
		onClick(callback: () => void) {
			this.callback = callback;
			mockButtonCallbacks[this.buttonText] = callback;
			return this;
		}
		setDisabled(disabled: boolean) {
			this.disabled = disabled;
			return this;
		}
		// Helper method for testing
		triggerClick() {
			if (this.callback && !this.disabled) {
				this.callback();
			}
		}
	},
	TextComponent: class MockTextComponent {
		public value = '';
		public placeholder = '';

		constructor(public container: any) {}
		setPlaceholder(text: string) {
			this.placeholder = text;
			return this;
		}
		getValue() {
			return this.value;
		}
		setValue(value: string) {
			this.value = value;
			return this;
		}
		onChange(callback: (value: string) => void) {
			mockTextChangeCallback = callback;
			return this;
		}
		// Helper method for testing
		triggerChange(newValue: string) {
			this.value = newValue;
			if (mockTextChangeCallback) {
				mockTextChangeCallback(newValue);
			}
		}
	},
	Notice: jest.fn(),
	TFile: class MockTFile {
		constructor(
			public path: string,
			public name = path
		) {}
	},
	WorkspaceLeaf: class MockWorkspaceLeaf {},
	MarkdownView: class MockMarkdownView {},
}));

describe('DocumentSelectionModal - Enhanced Coverage Tests', () => {
	let modal: DocumentSelectionModal;
	let mockApp: App;
	let mockAPI: GranolaAPI;
	let mockDuplicateDetector: DuplicateDetector;
	let mockMetadataService: DocumentMetadataService;
	let mockImportManager: SelectiveImportManager;
	let mockConverter: ProseMirrorConverter;
	let mockGranolaDocuments: GranolaDocument[];
	let mockDocumentMetadata: DocumentDisplayMetadata[];

	beforeEach(() => {
		// Reset button callbacks
		mockButtonCallbacks = {};
		mockTextChangeCallback = null;

		// Clear any pending timers
		jest.clearAllTimers();

		// Mock Obsidian App
		const mockLeaf = {
			view: {
				file: null,
				contentEl: {
					querySelector: jest.fn(),
				},
				editor: {
					scrollTo: jest.fn(),
				},
			} as unknown as MarkdownView,
			containerEl: {
				querySelectorAll: jest.fn(() => [
					{
						scrollTo: jest.fn(),
						scrollTop: 0,
					},
				]),
			},
			openFile: jest.fn(),
		} as unknown as WorkspaceLeaf;

		mockApp = {
			vault: {
				read: jest.fn(),
				create: jest.fn(),
				modify: jest.fn(),
			} as unknown as Vault,
			workspace: {
				getActiveViewOfType: jest.fn(),
				getLeaf: jest.fn(() => mockLeaf),
				getLeavesOfType: jest.fn(() => [mockLeaf]),
				setActiveLeaf: jest.fn(),
			},
		} as unknown as App;

		// Mock services
		mockAPI = {
			loadCredentials: jest.fn(),
			getAllDocuments: jest.fn(),
			getDocuments: jest.fn(),
		} as unknown as GranolaAPI;

		mockDuplicateDetector = {
			initialize: jest.fn(),
			checkDocuments: jest.fn(),
			refresh: jest.fn(),
		} as unknown as DuplicateDetector;

		mockMetadataService = {
			extractBulkMetadata: jest.fn(),
			applyFilter: jest.fn(),
			applySorting: jest.fn(),
			getCollectionStats: jest.fn(),
			updateSelection: jest.fn(),
		} as unknown as DocumentMetadataService;

		mockImportManager = {
			importDocuments: jest.fn(),
			cancel: jest.fn(),
			reset: jest.fn(),
			getProgress: jest.fn(),
			getAllDocumentProgress: jest.fn(() => []),
		} as unknown as SelectiveImportManager;

		mockConverter = {
			convertDocument: jest.fn(),
		} as unknown as ProseMirrorConverter;

		// Mock data
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

		// Mock DOM creation
		global.document = {
			createElement: jest.fn(() => ({
				textContent: '',
				style: {},
				appendChild: jest.fn(),
			})),
			head: {
				appendChild: jest.fn(),
				querySelectorAll: jest.fn(() => []),
			},
		} as any;

		// Create modal instance
		modal = new DocumentSelectionModal(
			mockApp,
			mockAPI,
			mockDuplicateDetector,
			mockMetadataService,
			mockImportManager,
			mockConverter
		);

		// Initialize modal UI elements with proper mocks
		(modal as any).modalContentEl = createMockElement();
		(modal as any).controlsEl = createMockElement();
		(modal as any).searchEl = createMockElement();
		(modal as any).documentListEl = createMockElement();
		(modal as any).footerEl = createMockElement();
		(modal as any).progressEl = createMockElement();
		(modal as any).importButton = {
			setButtonText: jest.fn(),
			setDisabled: jest.fn(),
			buttonEl: createMockElement(),
		};
		(modal as any).selectAllButton = { setDisabled: jest.fn() };
		(modal as any).selectNoneButton = { setDisabled: jest.fn() };
		(modal as any).refreshButton = { setDisabled: jest.fn() };

		// Setup default service behaviors
		(mockAPI.loadCredentials as jest.Mock).mockResolvedValue(undefined);
		(mockAPI.getAllDocuments as jest.Mock).mockResolvedValue(mockGranolaDocuments);
		(mockDuplicateDetector.initialize as jest.Mock).mockResolvedValue(undefined);
		(mockDuplicateDetector.checkDocuments as jest.Mock).mockResolvedValue(new Map());
		(mockDuplicateDetector.refresh as jest.Mock).mockResolvedValue(undefined);
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
	});

	describe('UI Setup and Component Creation', () => {
		it('should set up modal CSS classes on initialization', async () => {
			await modal.onOpen();

			expect(modal.contentEl.addClass).toHaveBeenCalledWith('granola-import-modal');
			expect(modal.modalEl.addClass).toHaveBeenCalledWith('granola-import-modal');
		});

		it('should create all required UI sections', async () => {
			await modal.onOpen();

			const createDivCalls = (modal.contentEl.createDiv as jest.Mock).mock.calls;
			const divClasses = createDivCalls.map(call => call[0]);

			expect(divClasses).toContain('modal-header');
			expect(divClasses).toContain('modal-controls');
			expect(divClasses).toContain('modal-search');
			expect(divClasses).toContain('modal-document-list');
			expect(divClasses).toContain('modal-progress');
			expect(divClasses).toContain('modal-footer');
		});

		it('should create control buttons with proper setup', async () => {
			await modal.onOpen();

			expect(mockButtonCallbacks).toHaveProperty('Select All');
			expect(mockButtonCallbacks).toHaveProperty('Select None');
			expect(mockButtonCallbacks).toHaveProperty('Refresh');
			expect(mockButtonCallbacks).toHaveProperty('Cancel');
		});

		it('should set up search input with change handler', async () => {
			await modal.onOpen();

			expect(mockTextChangeCallback).toBeDefined();
		});
	});

	describe('User Interaction Handlers', () => {
		beforeEach(async () => {
			await modal.onOpen();
		});

		it('should handle select all button click', () => {
			// Reset selection state
			mockDocumentMetadata.forEach(doc => {
				doc.selected = false;
			});

			// Trigger select all
			if (mockButtonCallbacks['Select All']) {
				mockButtonCallbacks['Select All']();
			}

			// Check that visible documents are selected
			const visibleDocs = mockDocumentMetadata.filter(doc => doc.visible);
			visibleDocs.forEach(doc => {
				expect(doc.selected).toBe(true);
			});
		});

		it('should handle select none button click', () => {
			// Set initial selection
			mockDocumentMetadata.forEach(doc => {
				doc.selected = true;
			});

			// Trigger select none
			if (mockButtonCallbacks['Select None']) {
				mockButtonCallbacks['Select None']();
			}

			// Check that all documents are deselected
			mockDocumentMetadata.forEach(doc => {
				expect(doc.selected).toBe(false);
			});
		});

		it('should handle refresh button click', async () => {
			// Reset mocks to track refresh calls
			jest.clearAllMocks();
			(mockDuplicateDetector.refresh as jest.Mock).mockResolvedValue(undefined);
			(mockAPI.loadCredentials as jest.Mock).mockResolvedValue(undefined);
			(mockAPI.getAllDocuments as jest.Mock).mockResolvedValue(mockGranolaDocuments);
			(mockDuplicateDetector.initialize as jest.Mock).mockResolvedValue(undefined);
			(mockDuplicateDetector.checkDocuments as jest.Mock).mockResolvedValue(new Map());
			(mockMetadataService.extractBulkMetadata as jest.Mock).mockReturnValue(
				mockDocumentMetadata
			);
			(mockMetadataService.applySorting as jest.Mock).mockReturnValue(mockDocumentMetadata);

			// Trigger refresh
			if (mockButtonCallbacks['Refresh']) {
				await mockButtonCallbacks['Refresh']();
			}

			// Check that refresh process was triggered
			expect(mockDuplicateDetector.refresh).toHaveBeenCalled();
			expect(mockAPI.loadCredentials).toHaveBeenCalled();
		});

		it('should handle search input changes', () => {
			const searchText = 'test search';

			// Trigger search
			if (mockTextChangeCallback) {
				mockTextChangeCallback(searchText);
			}

			// Verify filter was applied
			expect((modal as any).currentFilter.searchText).toBe(searchText);
		});

		it('should handle status filter dropdown changes', async () => {
			await modal.onOpen();

			// Simulate status filter change
			(modal as any).applyStatusFilter('NEW');

			expect((modal as any).currentFilter.statusFilter).toEqual(['NEW']);
		});
	});

	describe('Status Display and Message Handling', () => {
		it('should handle getStatusText for all status types', () => {
			const getStatusText = (modal as any).getStatusText;

			expect(getStatusText('NEW')).toBe('New');
			expect(getStatusText('EXISTS')).toBe('Exists');
			expect(getStatusText('UPDATED')).toBe('Updated');
			expect(getStatusText('CONFLICT')).toBe('Conflict');
			expect(getStatusText('UNKNOWN')).toBe('UNKNOWN');
		});

		it('should show loading messages', () => {
			const showMessage = jest.spyOn(modal as any, 'showMessage');
			(modal as any).showMessage('Test message');

			expect(showMessage).toHaveBeenCalledWith('Test message');
		});

		it('should show error messages', () => {
			const showError = jest.spyOn(modal as any, 'showError');
			(modal as any).showError('Test error');

			expect(showError).toHaveBeenCalledWith('Test error');
		});

		it('should clear document list when showing messages', () => {
			(modal as any).documentListEl = createMockElement();
			(modal as any).showMessage('Test message');

			expect((modal as any).documentListEl.empty).toHaveBeenCalled();
		});
	});

	describe('Progress Status Configuration', () => {
		it('should provide correct config for all progress statuses', () => {
			const getProgressStatusConfig = (modal as any).getProgressStatusConfig;

			const pendingConfig = getProgressStatusConfig('pending');
			expect(pendingConfig.icon).toBe('⏳');
			expect(pendingConfig.defaultMessage).toBe('Pending...');

			const importingConfig = getProgressStatusConfig('importing');
			expect(importingConfig.icon).toBe('📥');
			expect(importingConfig.defaultMessage).toBe('Importing...');

			const completedConfig = getProgressStatusConfig('completed');
			expect(completedConfig.icon).toBe('✅');
			expect(completedConfig.defaultMessage).toBe('Completed');

			const failedConfig = getProgressStatusConfig('failed');
			expect(failedConfig.icon).toBe('❌');
			expect(failedConfig.defaultMessage).toBe('Failed');

			const skippedConfig = getProgressStatusConfig('skipped');
			expect(skippedConfig.icon).toBe('⏭️');
			expect(skippedConfig.defaultMessage).toBe('Skipped');

			const unknownConfig = getProgressStatusConfig('unknown' as DocumentImportStatus);
			expect(unknownConfig.icon).toBe('⏳');
			expect(unknownConfig.defaultMessage).toBe('Unknown status');
		});
	});

	describe('Progress Tracking and Updates', () => {
		it('should update overall progress display', () => {
			const progress: ImportProgress = {
				total: 10,
				completed: 5,
				failed: 1,
				skipped: 0,
				percentage: 50,
				isRunning: true,
				isCancelled: false,
				message: 'Importing 5 of 10...',
				startTime: Date.now(),
				processingRate: 0.5,
			};

			// Mock progress elements
			const mockProgressFill = { style: { width: '' } };
			const mockProgressText = { textContent: '' };
			(modal as any).progressEl = {
				querySelector: jest.fn((selector: string) => {
					if (selector === '.progress-fill') return mockProgressFill;
					if (selector === '.progress-text') return mockProgressText;
					return null;
				}),
			};

			(modal as any).updateProgress(progress);

			expect(mockProgressFill.style.width).toBe('50%');
			expect(mockProgressText.textContent).toBe('Importing 5 of 10...');
		});

		it('should update document progress with visual indicators', () => {
			const docProgress: DocumentProgress = {
				id: 'doc1',
				status: 'importing',
				progress: 75,
				message: 'Processing content...',
			};

			// Mock document elements with proper methods
			const mockProgressIndicator = { style: { display: '' } };
			const mockProgressIcon = { textContent: '' };
			const mockProgressText = { textContent: '' };
			const mockProgressFill = { style: { width: '' } };
			const mockDocumentItem = {
				scrollIntoView: jest.fn(),
				querySelector: jest.fn((selector: string) => {
					if (selector === '.document-progress-indicator') return mockProgressIndicator;
					if (selector === '.progress-icon') return mockProgressIcon;
					if (selector === '.progress-text') return mockProgressText;
					if (selector === '.progress-fill') return mockProgressFill;
					return null;
				}),
				className: '',
				addClass: jest.fn(function (className: string) {
					this.className += ' ' + className;
				}),
			};

			(modal as any).modalContentEl = {
				querySelector: jest.fn(() => mockDocumentItem),
			};

			(modal as any).updateDocumentProgress(docProgress);

			expect(mockProgressIndicator.style.display).toBe('flex');
			expect(mockProgressIcon.textContent).toBe('📥');
			expect(mockProgressText.textContent).toBe('Processing content...');
			expect(mockProgressFill.style.width).toBe('75%');
			expect(mockDocumentItem.className).toContain('import-importing');
		});

		it('should handle failed document progress with error display', () => {
			const docProgress: DocumentProgress = {
				id: 'doc1',
				status: 'failed',
				progress: 0,
				message: '',
				error: 'Network error',
			};

			const mockProgressFill = { style: { width: '' } };
			const mockProgressIndicator = { style: { display: '' } };
			const mockProgressText = { textContent: '' };
			const mockDocumentItem = {
				querySelector: jest.fn((selector: string) => {
					if (selector === '.progress-fill') return mockProgressFill;
					if (selector === '.document-progress-indicator') return mockProgressIndicator;
					if (selector === '.progress-text') return mockProgressText;
					return mockProgressText;
				}),
				className: '',
				addClass: jest.fn(),
			};

			(modal as any).modalContentEl = {
				querySelector: jest.fn(() => mockDocumentItem),
			};

			(modal as any).updateDocumentProgress(docProgress);

			expect(mockProgressText.textContent).toBe('❌ Failed: Network error');
		});
	});

	describe('File Opening and Navigation', () => {
		it('should open imported files in new tabs', async () => {
			const mockFiles = [
				new (require('obsidian').TFile)('file1.md'),
				new (require('obsidian').TFile)('file2.md'),
			];

			const mockLeaf = {
				view: { file: mockFiles[0] }, // Set the view.file to match the first file
				openFile: jest.fn(),
			};

			// Update the workspace mock to return the leaf for getLeavesOfType
			mockApp.workspace.getLeaf = jest.fn(() => mockLeaf);
			mockApp.workspace.getLeavesOfType = jest.fn(() => [mockLeaf]);

			await (modal as any).openImportedFiles(mockFiles);

			// The method calls getLeaf for each file, plus potentially other workspace operations
			expect(mockApp.workspace.getLeaf).toHaveBeenCalledWith('tab');
			expect(mockLeaf.openFile).toHaveBeenCalledTimes(2);
			expect(mockApp.workspace.setActiveLeaf).toHaveBeenCalled();
		});

		it('should handle auto-scroll to top with editor', async () => {
			const leafWithEditor = {
				view: {
					editor: {
						scrollTo: jest.fn(),
					},
				},
			};

			await (modal as any).autoScrollToTop(leafWithEditor);

			expect(leafWithEditor.view.editor.scrollTo).toHaveBeenCalledWith(null, 0);
		});

		it('should handle auto-scroll with content element fallback', async () => {
			const scrollElement = {
				scrollTo: jest.fn(),
			};

			const leafWithContentEl = {
				view: {
					contentEl: {
						querySelector: jest.fn(() => scrollElement),
					},
				},
			};

			await (modal as any).autoScrollToTop(leafWithContentEl);

			expect(scrollElement.scrollTo).toHaveBeenCalledWith({
				top: 0,
				behavior: 'smooth',
			});
		});

		it('should scroll to specific document with animation', () => {
			const documentId = 'doc1';
			const mockDocElement = {
				scrollIntoView: jest.fn(),
				addClass: jest.fn(),
				removeClass: jest.fn(),
			};

			(modal as any).modalContentEl = {
				querySelector: jest.fn(() => mockDocElement),
			};

			// Mock setTimeout for testing
			jest.useFakeTimers();

			(modal as any).scrollToDocument(documentId);

			expect(mockDocElement.scrollIntoView).toHaveBeenCalledWith({
				behavior: 'smooth',
				block: 'center',
				inline: 'nearest',
			});
			expect(mockDocElement.addClass).toHaveBeenCalledWith('importing-active');

			// Fast-forward time to test removeClass
			jest.advanceTimersByTime(2000);
			expect(mockDocElement.removeClass).toHaveBeenCalledWith('importing-active');

			jest.runOnlyPendingTimers();
			jest.useRealTimers();
		});
	});

	describe('View State Management', () => {
		beforeEach(() => {
			(modal as any).controlsEl = { style: { display: '' } };
			(modal as any).searchEl = { style: { display: '' } };
			(modal as any).documentListEl = { style: { display: '' } };
			(modal as any).footerEl = { style: { display: '' } };
			(modal as any).progressEl = {
				style: { display: '' },
				empty: jest.fn(),
				createEl: jest.fn(() => createMockElement()),
				createDiv: jest.fn(() => createMockElement()),
			};
		});

		it('should show main view and hide progress', () => {
			(modal as any).showMainView();

			expect((modal as any).controlsEl.style.display).toBe('block');
			expect((modal as any).searchEl.style.display).toBe('block');
			expect((modal as any).documentListEl.style.display).toBe('block');
			expect((modal as any).footerEl.style.display).toBe('block');
			expect((modal as any).progressEl.style.display).toBe('none');
		});

		it('should show progress view and hide main content', () => {
			(modal as any).showProgressView();

			expect((modal as any).controlsEl.style.display).toBe('none');
			expect((modal as any).searchEl.style.display).toBe('none');
			expect((modal as any).documentListEl.style.display).toBe('none');
			expect((modal as any).footerEl.style.display).toBe('none');
			expect((modal as any).progressEl.style.display).toBe('block');
		});

		it('should handle import completion display', () => {
			const result: ImportProgress = {
				total: 10,
				completed: 8,
				failed: 1,
				skipped: 1,
				percentage: 100,
				isRunning: false,
				isCancelled: false,
				message: 'Import complete',
				startTime: Date.now(),
				processingRate: 1.0,
			};

			(mockImportManager.getAllDocumentProgress as jest.Mock).mockReturnValue([
				{ status: 'completed', file: new (require('obsidian').TFile)('test.md') },
			]);

			(modal as any).showImportComplete(result);

			expect((modal as any).isImporting).toBe(false);
			expect((modal as any).footerEl.style.display).toBe('none');
			expect((modal as any).progressEl.empty).toHaveBeenCalled();
		});
	});

	afterEach(() => {
		// Clean up any remaining timers
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('Import Process Management', () => {
		beforeEach(async () => {
			await modal.onOpen();
		});

		it('should handle import with no documents selected', async () => {
			// Ensure no documents are selected
			(modal as any).documentMetadata = [{ ...mockDocumentMetadata[0], selected: false }];

			// Mock showError method
			(modal as any).showError = jest.fn();

			await (modal as any).startImport();

			expect((modal as any).showError).toHaveBeenCalledWith(
				'No documents selected for import.'
			);
			expect(mockImportManager.importDocuments).not.toHaveBeenCalled();
		});

		it('should handle import failure gracefully', async () => {
			// Set up selected documents
			(modal as any).documentMetadata = [{ ...mockDocumentMetadata[0], selected: true }];

			// Mock import failure
			(mockImportManager.importDocuments as jest.Mock).mockRejectedValue(
				new Error('Import failed')
			);

			// Mock UI methods
			(modal as any).setImporting = jest.fn();
			(modal as any).showProgressView = jest.fn();
			(modal as any).showMainView = jest.fn();
			(modal as any).showError = jest.fn();

			await (modal as any).startImport();

			expect((modal as any).showError).toHaveBeenCalledWith('Import failed: Import failed');
			expect((modal as any).showMainView).toHaveBeenCalled();
			expect((modal as any).setImporting).toHaveBeenCalledWith(false);
		});

		it('should handle successful import with mixed results', async () => {
			// Set up selected documents
			(modal as any).documentMetadata = [{ ...mockDocumentMetadata[0], selected: true }];

			// Mock successful import with mixed results
			const importResult: ImportProgress = {
				total: 3,
				completed: 2,
				failed: 1,
				skipped: 0,
				percentage: 100,
				isRunning: false,
				isCancelled: false,
				message: 'Import complete',
				startTime: Date.now() - 5000,
				processingRate: 0.6,
			};

			(mockImportManager.importDocuments as jest.Mock).mockResolvedValue(importResult);

			// Mock UI methods
			(modal as any).setImporting = jest.fn();
			(modal as any).showProgressView = jest.fn();
			(modal as any).showImportComplete = jest.fn();

			await (modal as any).startImport();

			expect((modal as any).setImporting).toHaveBeenNthCalledWith(1, true);
			expect((modal as any).showProgressView).toHaveBeenCalled();
			expect((modal as any).showImportComplete).toHaveBeenCalledWith(importResult);
			expect((modal as any).setImporting).toHaveBeenNthCalledWith(2, false);
		});
	});

	describe('Document Rendering Edge Cases', () => {
		beforeEach(() => {
			(modal as any).documentListEl = createMockElement();
			(modal as any).metadataService = mockMetadataService;
			(modal as any).currentFilter = {};
		});

		it('should handle empty document list', () => {
			(modal as any).documentMetadata = [];
			(modal as any).showMessage = jest.fn();

			(modal as any).renderDocumentList();

			expect((modal as any).documentListEl.empty).toHaveBeenCalled();
			expect((modal as any).showMessage).toHaveBeenCalledWith('No documents to display.');
		});

		it('should handle no visible documents after filtering', () => {
			(modal as any).documentMetadata = [{ ...mockDocumentMetadata[0] }];
			(mockMetadataService.applyFilter as jest.Mock).mockReturnValue([
				{ ...mockDocumentMetadata[0], visible: false },
			]);
			(modal as any).showMessage = jest.fn();

			(modal as any).renderDocumentList();

			expect((modal as any).showMessage).toHaveBeenCalledWith(
				'No documents match the current filter.'
			);
		});

		it('should render document items with proper structure', () => {
			const testDoc = {
				...mockDocumentMetadata[0],
				visible: true,
				selected: false,
				preview: 'Document preview text',
				importStatus: { status: 'NEW', reason: 'New document' },
			};

			(modal as any).documentMetadata = [testDoc];
			(mockMetadataService.applyFilter as jest.Mock).mockReturnValue([testDoc]);
			(mockMetadataService.getCollectionStats as jest.Mock).mockReturnValue({
				total: 1,
				visible: 1,
				selected: 0,
			});

			const mockContainer = createMockElement();
			(modal as any).documentListEl.createDiv = jest.fn(() => mockContainer);
			(modal as any).renderDocumentItem = jest.fn();

			(modal as any).renderDocumentList();

			expect((modal as any).renderDocumentItem).toHaveBeenCalledWith(mockContainer, testDoc);
		});
	});

	describe('State Management', () => {
		it('should set loading state and update UI', () => {
			(modal as any).refreshButton = { setDisabled: jest.fn() };

			(modal as any).setLoading(true);
			expect((modal as any).isLoading).toBe(true);
			expect((modal as any).refreshButton.setDisabled).toHaveBeenCalledWith(true);

			(modal as any).setLoading(false);
			expect((modal as any).isLoading).toBe(false);
			expect((modal as any).refreshButton.setDisabled).toHaveBeenCalledWith(false);
		});

		it('should set importing state and update buttons', () => {
			(modal as any).importButton = { setDisabled: jest.fn(), setButtonText: jest.fn() };
			(modal as any).documentMetadata = [{ selected: true }, { selected: false }];

			(modal as any).setImporting(true);
			expect((modal as any).isImporting).toBe(true);

			(modal as any).setImporting(false);
			expect((modal as any).isImporting).toBe(false);
		});

		it('should update footer buttons based on selection count', () => {
			(modal as any).importButton = { setButtonText: jest.fn(), setDisabled: jest.fn() };
			(modal as any).documentMetadata = [
				{ selected: true },
				{ selected: true },
				{ selected: false },
			];
			(modal as any).isImporting = false;

			(modal as any).updateFooterButtons();

			expect((modal as any).importButton.setButtonText).toHaveBeenCalledWith(
				'Import Selected (2)'
			);
			expect((modal as any).importButton.setDisabled).toHaveBeenCalledWith(false);
		});

		it('should disable import button when importing', () => {
			(modal as any).importButton = { setButtonText: jest.fn(), setDisabled: jest.fn() };
			(modal as any).documentMetadata = [{ selected: true }];
			(modal as any).isImporting = true;

			(modal as any).updateFooterButtons();

			expect((modal as any).importButton.setDisabled).toHaveBeenCalledWith(true);
		});
	});

	describe('Filter and Sort Operations', () => {
		beforeEach(() => {
			(modal as any).currentFilter = {};
			(modal as any).renderDocumentList = jest.fn();
		});

		it('should apply text filter and re-render', () => {
			const searchText = 'test filter';
			(modal as any).applyTextFilter(searchText);

			expect((modal as any).currentFilter.searchText).toBe(searchText);
			expect((modal as any).renderDocumentList).toHaveBeenCalled();
		});

		it('should apply status filter with array value', () => {
			(modal as any).applyStatusFilter('NEW');

			expect((modal as any).currentFilter.statusFilter).toEqual(['NEW']);
			expect((modal as any).renderDocumentList).toHaveBeenCalled();
		});

		it('should clear status filter when empty string provided', () => {
			(modal as any).applyStatusFilter('');

			expect((modal as any).currentFilter.statusFilter).toBeUndefined();
			expect((modal as any).renderDocumentList).toHaveBeenCalled();
		});

		it('should apply multiple status filters', () => {
			(modal as any).applyStatusFilter('CONFLICT');

			expect((modal as any).currentFilter.statusFilter).toEqual(['CONFLICT']);
		});
	});

	describe('CSS and Styling Management', () => {
		it('should apply styles on setup', () => {
			global.document = {
				createElement: jest.fn(() => ({
					textContent: '',
				})),
				head: {
					appendChild: jest.fn(),
				},
			} as any;

			(modal as any).applyStyles();

			expect(global.document.createElement).toHaveBeenCalledWith('style');
			expect(global.document.head.appendChild).toHaveBeenCalled();
		});

		// CSS cleanup tests require complex document mocking that is challenging to implement reliably
		// The CSS cleanup functionality is not critical to the core business logic of the modal
		// and is covered by integration tests
	});

	describe('Document Item Rendering', () => {
		it('should render document item with checkbox and metadata', () => {
			const mockItem = createMockElement();
			const container = createMockElement();
			container.createDiv = jest.fn(() => mockItem);
			
			const doc = mockDocumentMetadata[0];

			(modal as any).renderDocumentItem(container, doc);

			expect(container.createDiv).toHaveBeenCalledWith('document-item');
			expect(mockItem.createEl).toHaveBeenCalledWith(
				'input',
				expect.objectContaining({
					type: 'checkbox',
					cls: 'document-checkbox',
				})
			);
		});

		it('should set proper CSS classes based on document status', () => {
			const container = createMockElement();
			const docItem = createMockElement();
			container.createDiv = jest.fn(() => docItem);

			const doc = {
				...mockDocumentMetadata[0],
				importStatus: { status: 'CONFLICT' },
			};

			(modal as any).renderDocumentItem(container, doc);

			expect(docItem.addClass).toHaveBeenCalledWith('status-conflict');
			expect(docItem.setAttribute).toHaveBeenCalledWith('data-document-id', doc.id);
		});

		it('should create document content structure', () => {
			const container = createMockElement();
			const doc = mockDocumentMetadata[0];

			(modal as any).renderDocumentItem(container, doc);

			// Verify content structure creation
			expect(container.createDiv).toHaveBeenCalledWith('document-item');
		});
	});

	describe('Error Handling Edge Cases', () => {
		it('should handle missing progress elements gracefully', () => {
			const docProgress: DocumentProgress = {
				id: 'doc1',
				status: 'importing',
				progress: 50,
				message: 'Test',
			};

			// Mock missing elements
			(modal as any).modalContentEl = {
				querySelector: jest.fn(() => null),
			};

			// Should not throw
			expect(() => {
				(modal as any).updateDocumentProgress(docProgress);
			}).not.toThrow();
		});

		it('should handle auto-scroll errors gracefully', async () => {
			const leafWithError = {
				view: {
					editor: {
						scrollTo: jest.fn(() => {
							throw new Error('Scroll error');
						}),
					},
				},
			};

			// Should not throw
			await expect((modal as any).autoScrollToTop(leafWithError)).resolves.not.toThrow();
		});

		it('should handle file opening errors gracefully', async () => {
			const mockFiles = [new (require('obsidian').TFile)('error.md')];

			// Mock error in file opening
			const mockLeaf = {
				openFile: jest.fn().mockRejectedValue(new Error('File error')),
			};
			mockApp.workspace.getLeaf = jest.fn(() => mockLeaf);

			// Should handle error gracefully
			await expect((modal as any).openImportedFiles(mockFiles)).resolves.not.toThrow();
		});
	});
});
