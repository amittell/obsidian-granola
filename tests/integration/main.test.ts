import { jest } from '@jest/globals';
import GranolaImporterPlugin from '../../main.ts';
import { mockApp, mockVault, Notice } from '../__mocks__/obsidian';
import { createMockFs, mockDocument, mockCredentials, createMockLogger } from '../helpers';

// Mock the source modules completely
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
	})),
}));

jest.mock('../../src/converter', () => ({
	ProseMirrorConverter: jest.fn().mockImplementation(logger => ({
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

describe('GranolaImporterPlugin Integration', () => {
	let plugin: GranolaImporterPlugin;

	beforeEach(() => {
		// Clear all mocks
		jest.clearAllMocks();

		// Setup filesystem mocks
		createMockFs();

		// Create plugin instance
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

		// Mock vault operations
		mockVault.getAbstractFileByPath.mockReturnValue(null);
		mockVault.create.mockResolvedValue(undefined);
		mockVault.modify.mockResolvedValue(undefined);
	});

	describe('onload', () => {
		it('should initialize plugin components and register command', async () => {
			const addCommandSpy = jest.spyOn(plugin, 'addCommand');

			await plugin.onload();

			expect(addCommandSpy).toHaveBeenCalledWith({
				id: 'import-granola-notes',
				name: 'Import Granola Notes (Selective)',
				callback: expect.any(Function),
			});

			// All three commands are registered: import, diagnose, and debug (when __DEV__ is true)
			// In Jest environment, __DEV__ is true, so all three commands are registered
			expect(addCommandSpy).toHaveBeenCalledTimes(3);

			expect(addCommandSpy).toHaveBeenNthCalledWith(2, {
				id: 'diagnose-empty-granola-documents',
				name: 'Diagnose Empty Granola Documents',
				callback: expect.any(Function),
			});

			expect(addCommandSpy).toHaveBeenNthCalledWith(3, {
				id: 'debug-granola-api',
				name: 'Debug Granola API Response',
				callback: expect.any(Function),
			});
		});

		it('should initialize plugin components', async () => {
			await plugin.onload();

			// Verify plugin components are initialized
			// Use type assertion to access private properties
			type PluginWithPrivates = GranolaImporterPlugin & {
				auth: unknown;
				api: unknown;
				converter: unknown;
			};
			const pluginWithPrivates = plugin as PluginWithPrivates;
			expect(pluginWithPrivates.auth).toBeDefined();
			expect(pluginWithPrivates.api).toBeDefined();
			expect(pluginWithPrivates.converter).toBeDefined();
		});
	});

	describe('onunload', () => {
		it('should complete cleanup', () => {
			// onunload method should execute without errors
			expect(() => plugin.onunload()).not.toThrow();
		});
	});

	describe('openImportModal', () => {
		beforeEach(async () => {
			await plugin.onload();
		});

		it('should open the document selection modal without errors', async () => {
			// Override the plugin's instances with properly mocked ones
			const { GranolaAuth } = require('../../src/auth');
			const { GranolaAPI } = require('../../src/api');
			const { ProseMirrorConverter } = require('../../src/converter');

			const mockAuthInstance = new GranolaAuth();
			const mockApiInstance = new GranolaAPI();
			const mockConverterInstance = new ProseMirrorConverter(createMockLogger());

			// Use Object.defineProperty to set private properties in tests
			Object.defineProperty(plugin, 'auth', {
				value: mockAuthInstance,
				writable: true,
				configurable: true,
			});
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

			// Since this method creates a complex modal, we'll just verify it doesn't throw
			expect(() => plugin.openImportModal()).not.toThrow();
		});

		it('should handle authentication errors gracefully', async () => {
			// Mock auth failure
			const { GranolaAuth } = require('../../src/auth');
			const mockAuthInstance = new GranolaAuth();
			mockAuthInstance.loadCredentials.mockRejectedValueOnce(new Error('Auth failed'));

			Object.defineProperty(plugin, 'auth', {
				value: mockAuthInstance,
				writable: true,
				configurable: true,
			});

			// Should not throw, but handle the error gracefully
			expect(() => plugin.openImportModal()).not.toThrow();
		});
	});

	describe('Ribbon Icon', () => {
		beforeEach(async () => {
			await plugin.onload();
		});

		it('should add ribbon icon when enabled in settings', async () => {
			const addRibbonIconSpy = jest.spyOn(plugin, 'addRibbonIcon');

			// Enable ribbon icon
			plugin.settings.ui.showRibbonIcon = true;
			await plugin.saveSettings();

			// Verify ribbon icon was added
			expect(addRibbonIconSpy).toHaveBeenCalledWith(
				'download',
				'Import Granola Notes',
				expect.any(Function)
			);
		});

		it('should remove ribbon icon when disabled in settings', async () => {
			// Mock ribbon icon element
			const mockRibbonEl = { remove: jest.fn() };
			Object.defineProperty(plugin, 'ribbonIconEl', {
				value: mockRibbonEl,
				writable: true,
				configurable: true,
			});

			// Disable ribbon icon
			plugin.settings.ui.showRibbonIcon = false;
			plugin.refreshRibbonIcon();

			// Verify ribbon icon was removed
			expect(mockRibbonEl.remove).toHaveBeenCalled();
			// Use type assertion to check private property
			type PluginWithRibbon = GranolaImporterPlugin & { ribbonIconEl: unknown };
			expect((plugin as PluginWithRibbon).ribbonIconEl).toBeNull();
		});

		it('should trigger import modal when ribbon icon is clicked', async () => {
			const openImportModalSpy = jest.spyOn(plugin, 'openImportModal');
			const addRibbonIconSpy = jest.spyOn(plugin, 'addRibbonIcon');

			// Enable ribbon icon
			plugin.settings.ui.showRibbonIcon = true;
			plugin.refreshRibbonIcon();

			// Get the callback from addRibbonIcon
			const ribbonCallback = addRibbonIconSpy.mock.calls[0][2];

			// Simulate ribbon icon click
			ribbonCallback();

			// Verify import modal was opened
			expect(openImportModalSpy).toHaveBeenCalled();
		});
	});
});
