import { jest } from '@jest/globals';
import GranolaImporterPlugin from '../../main';
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
		plugin = new GranolaImporterPlugin(mockApp as any, {
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

			// Debug command is only registered when __DEV__ is true
			// Check if it should be called 1 or 2 times based on dev environment
			// @ts-ignore - esbuild will replace this constant
			const expectedCalls = typeof __DEV__ !== 'undefined' && __DEV__ ? 2 : 1;
			expect(addCommandSpy).toHaveBeenCalledTimes(expectedCalls);
		});

		it('should initialize plugin components', async () => {
			await plugin.onload();

			// Verify plugin components are initialized
			expect((plugin as any).auth).toBeDefined();
			expect((plugin as any).api).toBeDefined();
			expect((plugin as any).converter).toBeDefined();
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

			(plugin as any).auth = mockAuthInstance;
			(plugin as any).api = mockApiInstance;
			(plugin as any).converter = mockConverterInstance;

			// Since this method creates a complex modal, we'll just verify it doesn't throw
			expect(() => plugin.openImportModal()).not.toThrow();
		});

		it('should handle authentication errors gracefully', async () => {
			// Mock auth failure
			const { GranolaAuth } = require('../../src/auth');
			const mockAuthInstance = new GranolaAuth();
			mockAuthInstance.loadCredentials.mockRejectedValueOnce(new Error('Auth failed'));

			(plugin as any).auth = mockAuthInstance;

			// Should not throw, but handle the error gracefully
			expect(() => plugin.openImportModal()).not.toThrow();
		});
	});
});
