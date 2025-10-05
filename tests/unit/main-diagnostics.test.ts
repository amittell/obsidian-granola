import { jest } from '@jest/globals';
import GranolaImporterPlugin from '../../main';
import { mockApp, Notice } from '../__mocks__/obsidian';
import { createMockFs, mockDocument, mockCredentials } from '../helpers';
import type { GranolaDocument } from '../../src/types';

// Mock the source modules
jest.mock('../../src/auth', () => ({
	GranolaAuth: jest.fn().mockImplementation(() => ({
		loadCredentials: jest.fn().mockResolvedValue(mockCredentials),
		getBearerToken: jest.fn().mockReturnValue('test-token'),
		hasValidCredentials: jest.fn().mockReturnValue(true),
		isTokenExpired: jest.fn().mockReturnValue(false),
		clearCredentials: jest.fn(),
		refreshToken: jest.fn(),
	})),
}));

jest.mock('../../src/api', () => ({
	GranolaAPI: jest.fn().mockImplementation(() => ({
		getAllDocuments: jest.fn().mockResolvedValue([mockDocument]),
		getDocuments: jest.fn().mockResolvedValue({
			documents: [mockDocument],
			total_count: 1,
			has_more: false,
		}),
		loadCredentials: jest.fn().mockResolvedValue(undefined),
	})),
}));

jest.mock('../../src/converter', () => ({
	ProseMirrorConverter: jest.fn().mockImplementation(() => ({
		convertDocument: jest.fn().mockReturnValue({
			filename: 'Test Document.md',
			content:
				'---\nid: test-doc-id\ntitle: "Test Document"\n---\n\n# Test Document\n\nTest content',
			frontmatter: {
				id: 'test-doc-id',
				title: 'Test Document',
				created: '2025-01-01T00:00:00.000Z',
				updated: '2025-01-01T00:00:00.000Z',
				source: 'Granola',
			},
		}),
		updateSettings: jest.fn(),
	})),
}));

describe('GranolaImporterPlugin - Diagnostic Methods', () => {
	let plugin: GranolaImporterPlugin;
	let mockApiInstance: any;
	let mockConverterInstance: any;

	beforeEach(async () => {
		jest.clearAllMocks();
		createMockFs();

		plugin = new GranolaImporterPlugin(mockApp, {
			id: 'granola-importer',
			name: 'Granola Importer',
			version: '1.0.0',
			minAppVersion: '0.15.0',
			description: 'Import Granola notes',
			author: 'Test',
			authorUrl: 'https://example.com',
			isDesktopOnly: false,
		});

		await plugin.onload();

		// Get mock instances
		const { GranolaAPI } = require('../../src/api');
		const { ProseMirrorConverter } = require('../../src/converter');
		mockApiInstance = new GranolaAPI();
		mockConverterInstance = new ProseMirrorConverter();

		// Set private properties
		Object.defineProperty(plugin, 'api', {
			value: mockApiInstance,
			writable: true,
			configurable: true,
		});
		Object.defineProperty(plugin, 'converter', {
			value: mockConverterInstance,
			writable: true,
			configurable: true,
		});

		// Mock logger methods
		jest.spyOn(plugin.logger, 'error').mockImplementation();
		jest.spyOn(plugin.logger, 'warn').mockImplementation();
		jest.spyOn(plugin.logger, 'info').mockImplementation();
		jest.spyOn(plugin.logger, 'debug').mockImplementation();

		// Mock clipboard
		Object.assign(navigator, {
			clipboard: {
				writeText: jest.fn().mockResolvedValue(undefined),
			},
		});
	});

	describe('diagnoseEmptyDocuments', () => {
		it('should diagnose documents and create report', async () => {
			// Mock document with content
			const docWithContent: GranolaDocument = {
				...mockDocument,
				id: 'doc-with-content',
				title: 'Document with Content',
				notes_plain: 'Some content',
			};

			// Mock empty document (placeholder)
			const emptyDoc: GranolaDocument = {
				id: 'empty-doc',
				title: 'Empty Document',
				created_at: '2025-01-01T00:00:00.000Z',
				updated_at: '2025-01-01T00:00:00.000Z',
				notes: { type: 'doc', content: [] },
				notes_plain: '',
				notes_markdown: '',
				people: [],
				last_viewed_panel: null,
			};

			mockApiInstance.getAllDocuments.mockResolvedValue([docWithContent, emptyDoc]);

			// Mock converter to return placeholder for empty doc
			mockConverterInstance.convertDocument.mockImplementation((doc: GranolaDocument) => {
				if (doc.id === 'empty-doc') {
					return {
						filename: 'Empty Document.md',
						content:
							'This document appears to have no extractable content. It may be a placeholder.',
						frontmatter: {},
					};
				}
				return {
					filename: 'Document.md',
					content: 'Content',
					frontmatter: {},
				};
			});

			await plugin.diagnoseEmptyDocuments();

			// Verify API calls
			expect(mockApiInstance.loadCredentials).toHaveBeenCalled();
			expect(mockApiInstance.getAllDocuments).toHaveBeenCalled();

			// Verify clipboard and vault operations
			expect(navigator.clipboard.writeText).toHaveBeenCalled();
			expect(mockApp.vault.create).toHaveBeenCalledWith(
				expect.stringMatching(/Granola Empty Document Diagnosis/),
				expect.stringContaining('Total Documents:')
			);

			// Verify workspace operations
			expect(mockApp.workspace.getLeaf).toHaveBeenCalledWith('tab');
		});

		it('should handle no documents found', async () => {
			mockApiInstance.getAllDocuments.mockResolvedValue([]);

			await plugin.diagnoseEmptyDocuments();

			expect(mockApiInstance.getAllDocuments).toHaveBeenCalled();
			// Should show notice but not create report
			expect(mockApp.vault.create).not.toHaveBeenCalled();
		});

		it('should handle API errors gracefully', async () => {
			mockApiInstance.loadCredentials.mockRejectedValue(new Error('API Error'));

			await plugin.diagnoseEmptyDocuments();

			// Should handle error without throwing
			expect(plugin.logger.error).toHaveBeenCalledWith(
				'Failed to diagnose empty documents:',
				expect.any(Error)
			);
		});

		it('should categorize truly empty vs conversion failures', async () => {
			const trulyEmpty: GranolaDocument = {
				id: 'truly-empty',
				title: 'Never Modified',
				created_at: '2025-01-01T00:00:00.000Z',
				updated_at: '2025-01-01T00:00:00.000Z', // Same as created
				notes: { type: 'doc', content: [] },
				notes_plain: '',
				notes_markdown: '',
				people: [],
				last_viewed_panel: null,
			};

			const hasContentButFailed: GranolaDocument = {
				id: 'conversion-failed',
				title: 'Has Content',
				created_at: '2025-01-01T00:00:00.000Z',
				updated_at: '2025-01-02T00:00:00.000Z', // Modified
				notes: { type: 'doc', content: [] },
				notes_plain: 'Some actual content',
				notes_markdown: '',
				people: [],
				last_viewed_panel: null,
			};

			mockApiInstance.getAllDocuments.mockResolvedValue([trulyEmpty, hasContentButFailed]);

			mockConverterInstance.convertDocument.mockImplementation(() => ({
				filename: 'doc.md',
				content: 'This document appears to have no extractable content',
				frontmatter: {},
			}));

			await plugin.diagnoseEmptyDocuments();

			const reportCall = (navigator.clipboard.writeText as jest.MockedFunction<any>).mock
				.calls[0][0];

			expect(reportCall).toContain('Truly Empty:');
			expect(reportCall).toContain('Conversion Failures:');
			expect(reportCall).toContain('Never modified after creation');
			expect(reportCall).toContain('Has text content but conversion failed');
		});

		it('should handle conversion errors', async () => {
			const problematicDoc: GranolaDocument = {
				...mockDocument,
				id: 'problematic',
				title: 'Problematic Document',
			};

			mockApiInstance.getAllDocuments.mockResolvedValue([problematicDoc]);
			mockConverterInstance.convertDocument.mockImplementation(() => {
				throw new Error('Conversion failed');
			});

			await plugin.diagnoseEmptyDocuments();

			// Should complete without throwing
			expect(navigator.clipboard.writeText).toHaveBeenCalled();
			const reportCall = (navigator.clipboard.writeText as jest.MockedFunction<any>).mock
				.calls[0][0];
			expect(reportCall).toContain('Conversion error');
		});

		it('should show success message when all documents have content', async () => {
			const goodDoc: GranolaDocument = {
				...mockDocument,
				notes_plain: 'Good content',
			};

			mockApiInstance.getAllDocuments.mockResolvedValue([goodDoc]);
			mockConverterInstance.convertDocument.mockReturnValue({
				filename: 'doc.md',
				content: 'Good content here',
				frontmatter: {},
			});

			await plugin.diagnoseEmptyDocuments();

			const reportCall = (navigator.clipboard.writeText as jest.MockedFunction<any>).mock
				.calls[0][0];
			expect(reportCall).toContain('All documents have content and can be imported');
		});
	});

	// Note: debugAPIResponse() tests are not included because it's a dev-only method
	// that gets stripped at build time via the __DEV__ constant

	describe('loadSettings', () => {
		it('should migrate custom filename template setting', async () => {
			const savedData = {
				content: {
					filenameTemplate: '{title} - {created_date}',
					// useCustomFilenameTemplate is undefined (not set)
				},
			};

			plugin.loadData = jest.fn().mockResolvedValue(savedData);
			plugin.saveSettings = jest.fn().mockResolvedValue(undefined);

			await plugin.loadSettings();

			// Should enable custom template toggle
			expect(plugin.settings.content.useCustomFilenameTemplate).toBe(true);
			expect(plugin.saveSettings).toHaveBeenCalled();
		});

		it('should not migrate if using default template', async () => {
			const savedData = {
				content: {
					filenameTemplate: '{created_date} - {title}', // Default
				},
			};

			plugin.loadData = jest.fn().mockResolvedValue(savedData);
			plugin.saveSettings = jest.fn().mockResolvedValue(undefined);

			await plugin.loadSettings();

			// Should not trigger migration
			expect(plugin.saveSettings).not.toHaveBeenCalled();
		});

		it('should not migrate if toggle already set', async () => {
			const savedData = {
				content: {
					filenameTemplate: '{title}',
					useCustomFilenameTemplate: false, // Already set
				},
			};

			plugin.loadData = jest.fn().mockResolvedValue(savedData);
			plugin.saveSettings = jest.fn().mockResolvedValue(undefined);

			await plugin.loadSettings();

			// Should not trigger migration
			expect(plugin.saveSettings).not.toHaveBeenCalled();
		});
	});

	describe('saveSettings', () => {
		it('should update converter settings when saving', async () => {
			await plugin.saveSettings();

			expect(mockConverterInstance.updateSettings).toHaveBeenCalledWith(plugin.settings);
		});

		it('should update metadata service settings when saving', async () => {
			// Access metadataService through type assertion
			const metadataService = (plugin as any).metadataService;
			const updateSettingsSpy = jest
				.spyOn(metadataService, 'updateSettings')
				.mockImplementation();

			await plugin.saveSettings();

			expect(updateSettingsSpy).toHaveBeenCalledWith(plugin.settings);
		});

		it('should handle missing converter gracefully', async () => {
			Object.defineProperty(plugin, 'converter', {
				value: undefined,
				writable: true,
				configurable: true,
			});

			await expect(plugin.saveSettings()).resolves.not.toThrow();
		});

		it('should handle missing metadata service gracefully', async () => {
			Object.defineProperty(plugin, 'metadataService', {
				value: undefined,
				writable: true,
				configurable: true,
			});

			await expect(plugin.saveSettings()).resolves.not.toThrow();
		});
	});
});
