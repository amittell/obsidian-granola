import { jest } from '@jest/globals';

/**
 * Bundle Integration Tests
 *
 * These tests verify that the plugin can be imported and instantiated correctly
 * without relying on extensive mocking. This catches initialization order issues
 * that might be hidden by Jest mocks.
 */
describe('Bundle Integration Tests', () => {
	beforeEach(() => {
		// Clear module cache to ensure fresh imports
		jest.resetModules();
	});

	describe('Plugin Import and Instantiation', () => {
		it('should import main plugin without throwing', async () => {
			// This test imports the actual plugin module to catch import-time errors
			expect(async () => {
				const { default: GranolaImporterPlugin } = await import('../../main');
				expect(GranolaImporterPlugin).toBeDefined();
				expect(typeof GranolaImporterPlugin).toBe('function');
			}).not.toThrow();
		});

		it('should instantiate plugin without undefined errors', async () => {
			const { default: GranolaImporterPlugin } = await import('../../main');
			const { mockApp } = await import('../__mocks__/obsidian');

			expect(() => {
				const plugin = new GranolaImporterPlugin(mockApp as any, {
					id: 'granola-importer',
					name: 'Granola Importer',
					version: '1.0.0',
					minAppVersion: '0.15.0',
					description: 'Import Granola notes',
					author: 'Test',
					authorUrl: 'https://example.com',
					isDesktopOnly: false,
				});
				expect(plugin).toBeInstanceOf(GranolaImporterPlugin);
			}).not.toThrow();
		});

		it('should initialize plugin without logger errors', async () => {
			const { default: GranolaImporterPlugin } = await import('../../main');
			const { mockApp } = await import('../__mocks__/obsidian');

			const plugin = new GranolaImporterPlugin(mockApp as any, {
				id: 'granola-importer',
				name: 'Granola Importer',
				version: '1.0.0',
				minAppVersion: '0.15.0',
				description: 'Import Granola notes',
				author: 'Test',
				authorUrl: 'https://example.com',
				isDesktopOnly: false,
			});

			// Should not throw when onload is called
			await expect(plugin.onload()).resolves.not.toThrow();

			// Logger should be properly initialized after onload
			expect((plugin as any).logger).toBeDefined();
		});
	});
});
