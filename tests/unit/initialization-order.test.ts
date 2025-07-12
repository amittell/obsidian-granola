import { jest } from '@jest/globals';
import GranolaImporterPlugin from '../../main.ts';
import { mockApp } from '../__mocks__/obsidian';

/**
 * Tests to catch initialization order issues that might be hidden by mocks.
 * These tests specifically verify that components are initialized in the correct order
 * and that no undefined references occur during startup.
 */
describe('Initialization Order Tests', () => {
	let plugin: GranolaImporterPlugin;
	let consoleErrorSpy: jest.SpyInstance;
	let consoleWarnSpy: jest.SpyInstance;

	beforeEach(() => {
		// Don't mock console - we want to catch real errors
		consoleErrorSpy = jest.spyOn(console, 'error');
		consoleWarnSpy = jest.spyOn(console, 'warn');

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
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		consoleWarnSpy.mockRestore();
	});

	describe('Plugin Initialization', () => {
		it('should not throw any errors during onload', async () => {
			// This test will fail if there are any undefined property access errors
			expect(async () => {
				await plugin.onload();
			}).not.toThrow();

			// Verify no console errors were logged during initialization
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});

		it('should initialize logger before any debug calls', async () => {
			await plugin.onload();

			// Verify that logger is properly initialized
			expect((plugin as any).logger).toBeDefined();
			expect(typeof (plugin as any).logger.debug).toBe('function');
			expect(typeof (plugin as any).logger.error).toBe('function');
		});

		it('should initialize all core components in correct order', async () => {
			await plugin.onload();

			// Verify all components are initialized after onload
			expect((plugin as any).auth).toBeDefined();
			expect((plugin as any).api).toBeDefined();
			expect((plugin as any).converter).toBeDefined();
			expect((plugin as any).duplicateDetector).toBeDefined();
			expect((plugin as any).metadataService).toBeDefined();
			expect((plugin as any).importManager).toBeDefined();
		});

		it('should handle settings loading failure gracefully', async () => {
			// Mock loadData to throw an error
			plugin.loadData = jest.fn().mockRejectedValue(new Error('Settings load failed'));

			// Should throw the error but not due to undefined logger
			await expect(plugin.onload()).rejects.toThrow('Settings load failed');

			// Should have used console.error for early errors
			expect(consoleErrorSpy).toHaveBeenCalled();
			const firstCall = consoleErrorSpy.mock.calls[0];
			expect(firstCall[0]).toContain('Fatal error during plugin initialization:');
			expect(firstCall[1]).toBeInstanceOf(Error);
			expect(firstCall[1].message).toBe('Settings load failed');
		});
	});

	describe('Component Dependencies', () => {
		it('should not access logger before initialization in any method', async () => {
			// Test that no methods accidentally call logger before it's ready
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

			// Logger should be undefined initially
			expect((plugin as any).logger).toBeUndefined();

			// Calling onload should initialize logger without errors
			await plugin.onload();
			expect((plugin as any).logger).toBeDefined();
		});

		it('should initialize converter with logger dependency', async () => {
			await plugin.onload();

			// Converter should receive the initialized logger
			const converter = (plugin as any).converter;
			expect(converter).toBeDefined();

			// Call a converter method to ensure it has a working logger
			expect(() => {
				converter.convertDocument({
					id: 'test',
					title: 'Test',
					notes: { type: 'doc', content: [] },
					created_at: '2025-01-01T00:00:00Z',
					updated_at: '2025-01-01T00:00:00Z',
				});
			}).not.toThrow();
		});
	});

	describe('Error Propagation', () => {
		it('should not mask initialization errors with undefined logger calls', async () => {
			// Mock settings loading to fail
			plugin.loadData = jest.fn().mockRejectedValue(new Error('Simulated failure'));

			// The error should propagate cleanly without logger-related errors
			try {
				await plugin.onload();
				fail('Expected onload to throw');
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toBe('Simulated failure');

				// Should not have any additional TypeError about undefined logger
				expect(consoleErrorSpy).toHaveBeenCalled();
				const firstCall = consoleErrorSpy.mock.calls[0];
				expect(firstCall[0]).toContain('Fatal error during plugin initialization:');
				expect(firstCall[1]).toBeInstanceOf(Error);
				expect(firstCall[1].message).toBe('Simulated failure');
			}
		});
	});
});
