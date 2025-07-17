import {
	ConflictResolutionModal,
	ConflictResolution,
} from '../../src/ui/conflict-resolution-modal';
import { GranolaDocument } from '../../src/api';
import { DocumentDisplayMetadata } from '../../src/services/document-metadata';
import { Logger } from '../../src/types';
import { App, TFile } from 'obsidian';

// Mock Obsidian App
const mockApp = {
	vault: {
		read: jest.fn(),
	},
} as unknown as App;

// Mock TFile
const mockFile = Object.create(TFile.prototype);
Object.assign(mockFile, {
	name: 'test-document.md',
	path: 'test-document.md',
	basename: 'test-document',
	extension: 'md',
});

// Mock Logger
const mockLogger = {
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	updateSettings: jest.fn(),
} as unknown as Logger;

describe('ConflictResolutionModal', () => {
	let modal: ConflictResolutionModal;
	let mockDocument: GranolaDocument;
	let mockMetadata: DocumentDisplayMetadata;

	describe('constructor', () => {
		it('should create modal instance', () => {
			const mockDoc: GranolaDocument = {
				id: 'test-id',
				title: 'Test Document',
				created_at: '2023-01-01T00:00:00Z',
				updated_at: '2023-01-01T00:00:00Z',
				user_id: 'test-user',
				notes: { content: [] },
				last_viewed_panel: { content: { type: 'doc', content: [] } }
			};
			const mockMeta: DocumentDisplayMetadata = {
				id: 'test-id',
				title: 'Test Document',
				createdDate: '2023-01-01',
				updatedDate: '2023-01-01',
				timeAgo: '1 year ago',
				wordCount: 0,
				preview: '',
				selected: false,
				importStatus: {
					status: 'CONFLICT',
					reason: 'Test conflict',
					requiresUserChoice: true,
				},
			};
			const mockFile = Object.create(TFile.prototype);
			const testModal = new ConflictResolutionModal(
				mockApp,
				mockDoc,
				mockMeta,
				mockFile,
				mockLogger
			);
			expect(testModal).toBeInstanceOf(ConflictResolutionModal);
		});
	});

	beforeEach(() => {
		mockDocument = {
			id: 'test-doc-1',
			title: 'Test Document',
			created_at: '2023-01-01T10:00:00Z',
			updated_at: '2023-01-02T15:30:00Z',
			user_id: 'user-123',
			notes_plain: 'Test content',
			notes_markdown: '# Test Document\n\nTest content',
			notes: { type: 'doc', content: [] },
			last_viewed_panel: { content: { type: 'doc', content: [] } },
		};

		mockMetadata = {
			id: 'test-doc-1',
			title: 'Test Document',
			createdDate: '2023-01-01',
			updatedDate: '2023-01-02',
			createdAgo: '1 day ago',
			updatedAgo: '1 hour ago',
			preview: 'Test document preview',
			wordCount: 100,
			readingTime: 1,
			importStatus: { status: 'CONFLICT', reason: 'File exists', requiresUserChoice: true },
			visible: true,
			selected: true,
		};

		modal = new ConflictResolutionModal(
			mockApp,
			mockDocument,
			mockMetadata,
			mockFile,
			mockLogger
		);

		// Reset mocks
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create modal with document and metadata', () => {
			expect(modal).toBeInstanceOf(ConflictResolutionModal);
		});

		it('should create modal without existing file', () => {
			const modalWithoutFile = new ConflictResolutionModal(
				mockApp,
				mockDocument,
				mockMetadata,
				undefined,
				mockLogger
			);
			expect(modalWithoutFile).toBeInstanceOf(ConflictResolutionModal);
		});
	});

	describe('ConflictResolution type', () => {
		it('should support skip action', () => {
			const resolution: ConflictResolution = {
				action: 'skip',
				reason: 'User chose to skip',
			};

			expect(resolution.action).toBe('skip');
			expect(resolution.reason).toBe('User chose to skip');
		});

		it('should support overwrite action', () => {
			const resolution: ConflictResolution = {
				action: 'overwrite',
				createBackup: true,
			};

			expect(resolution.action).toBe('overwrite');
			expect(resolution.createBackup).toBe(true);
		});

		it('should support merge action', () => {
			const resolution: ConflictResolution = {
				action: 'merge',
				strategy: 'append',
			};

			expect(resolution.action).toBe('merge');
			expect(resolution.strategy).toBe('append');
		});

		it('should support rename action', () => {
			const resolution: ConflictResolution = {
				action: 'rename',
				newFilename: 'renamed-document.md',
			};

			expect(resolution.action).toBe('rename');
			expect(resolution.newFilename).toBe('renamed-document.md');
		});

		it('should support view-diff action', () => {
			const resolution: ConflictResolution = {
				action: 'view-diff',
			};

			expect(resolution.action).toBe('view-diff');
		});
	});

	describe('type checking', () => {
		it('should validate ConflictResolution discriminated union', () => {
			const resolutions: ConflictResolution[] = [
				{ action: 'skip', reason: 'test' },
				{ action: 'overwrite', createBackup: false },
				{ action: 'merge', strategy: 'prepend' },
				{ action: 'rename', newFilename: 'new.md' },
				{ action: 'view-diff' },
			];

			resolutions.forEach(resolution => {
				expect(resolution.action).toBeDefined();
				expect(['skip', 'overwrite', 'merge', 'rename', 'view-diff']).toContain(
					resolution.action
				);
			});
		});

		it('should handle merge strategies correctly', () => {
			const appendMerge: ConflictResolution = { action: 'merge', strategy: 'append' };
			const prependMerge: ConflictResolution = { action: 'merge', strategy: 'prepend' };

			expect(appendMerge.strategy).toBe('append');
			expect(prependMerge.strategy).toBe('prepend');
		});

		it('should handle backup options correctly', () => {
			const withBackup: ConflictResolution = { action: 'overwrite', createBackup: true };
			const withoutBackup: ConflictResolution = { action: 'overwrite', createBackup: false };

			expect(withBackup.createBackup).toBe(true);
			expect(withoutBackup.createBackup).toBe(false);
		});
	});

	describe('modal properties', () => {
		it('should store document reference', () => {
			// Access private properties through any cast for testing
			const anyModal = modal as any;
			expect(anyModal.document).toBe(mockDocument);
		});

		it('should store metadata reference', () => {
			const anyModal = modal as any;
			expect(anyModal.metadata).toBe(mockMetadata);
		});

		it('should store existing file reference', () => {
			const anyModal = modal as any;
			expect(anyModal.existingFile).toBe(mockFile);
		});

		it('should initialize with empty existing content', () => {
			const anyModal = modal as any;
			expect(anyModal.existingContent).toBe('');
		});
	});

	describe('showConflictResolution', () => {
		it('should return a promise', () => {
			const promise = modal.showConflictResolution();
			expect(promise).toBeInstanceOf(Promise);

			// Close modal to prevent hanging test
			modal.close();
		});

		it('should open the modal when called', () => {
			// Mock the open method
			const openSpy = jest.spyOn(modal, 'open').mockImplementation();

			modal.showConflictResolution();

			expect(openSpy).toHaveBeenCalled();

			openSpy.mockRestore();
		});
	});

	describe('error handling', () => {
		it('should handle invalid document data gracefully', () => {
			const invalidDocument: GranolaDocument = {
				id: '',
				title: '',
				created_at: '',
				updated_at: '',
				user_id: '',
				notes: {},
				last_viewed_panel: {}
			};
			const invalidModal = new ConflictResolutionModal(
				mockApp,
				invalidDocument,
				mockMetadata,
				undefined,
				mockLogger
			);

			expect(invalidModal).toBeInstanceOf(ConflictResolutionModal);
		});

		it('should handle missing metadata gracefully', () => {
			const invalidMetadata: DocumentDisplayMetadata = {
				id: '',
				title: '',
				createdDate: '',
				updatedDate: '',
				timeAgo: '',
				wordCount: 0,
				preview: '',
				selected: false,
				importStatus: {
					status: 'UNKNOWN',
					reason: 'Missing metadata',
					requiresUserChoice: false,
				},
			};
			const invalidModal = new ConflictResolutionModal(
				mockApp,
				mockDocument,
				invalidMetadata,
				undefined,
				mockLogger
			);

			expect(invalidModal).toBeInstanceOf(ConflictResolutionModal);
		});
	});
});
