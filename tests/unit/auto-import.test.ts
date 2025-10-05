import GranolaImporterPlugin from '../../main';
import { DEFAULT_SETTINGS } from '../../src/types';

describe('Auto-Import Timer', () => {
	let plugin: GranolaImporterPlugin;
	let setIntervalSpy: jest.SpyInstance;
	let clearIntervalSpy: jest.SpyInstance;

	beforeEach(() => {
		// Mock setInterval and clearInterval
		setIntervalSpy = jest.spyOn(global, 'setInterval');
		clearIntervalSpy = jest.spyOn(global, 'clearInterval');

		// Create a partial plugin instance with the methods we need
		plugin = {
			settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), // Deep copy to avoid mutation
			logger: {
				debug: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
			},
			openImportModal: jest.fn(),
			saveSettings: jest.fn().mockResolvedValue(undefined),
			saveData: jest.fn().mockResolvedValue(undefined),
			autoImportTimer: undefined,
		} as any;

		// Bind the actual methods from the plugin class to our mock instance
		// We need to get the actual implementation from main.ts
		const GranolaImporterPluginProto = GranolaImporterPlugin.prototype;
		plugin.setupAutoImport = GranolaImporterPluginProto['setupAutoImport'].bind(plugin);
		plugin.cleanupAutoImport = GranolaImporterPluginProto['cleanupAutoImport'].bind(plugin);
		plugin.performAutoImport = GranolaImporterPluginProto['performAutoImport'].bind(plugin);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('setupAutoImport', () => {
		it('should not create timer when auto-import is disabled', () => {
			plugin.settings.autoImport.enabled = false;

			// Call the private method using type assertion
			(plugin as any).setupAutoImport();

			expect(setIntervalSpy).not.toHaveBeenCalled();
			expect(plugin.logger.debug).toHaveBeenCalledWith('Auto-import is disabled');
		});

		it('should create timer when auto-import is enabled', () => {
			plugin.settings.autoImport.enabled = true;
			plugin.settings.autoImport.interval = 3600000; // 1 hour

			(plugin as any).setupAutoImport();

			expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 3600000);
			expect(plugin.logger.info).toHaveBeenCalledWith(
				'Setting up auto-import timer with 3600000ms interval'
			);
		});

		it('should use correct interval from settings', () => {
			plugin.settings.autoImport.enabled = true;
			plugin.settings.autoImport.interval = 14400000; // 4 hours

			(plugin as any).setupAutoImport();

			expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 14400000);
		});

		it('should clean up existing timer before creating new one', () => {
			plugin.settings.autoImport.enabled = true;
			plugin.settings.autoImport.interval = 3600000;

			// Create first timer
			(plugin as any).setupAutoImport();
			const firstTimerId = (plugin as any).autoImportTimer;

			// Create second timer (should clear first one)
			(plugin as any).setupAutoImport();

			expect(clearIntervalSpy).toHaveBeenCalledWith(firstTimerId);
			expect(setIntervalSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe('cleanupAutoImport', () => {
		it('should clear timer when timer exists', () => {
			plugin.settings.autoImport.enabled = true;

			// Setup timer first
			(plugin as any).setupAutoImport();
			const timerId = (plugin as any).autoImportTimer;

			// Clean up
			(plugin as any).cleanupAutoImport();

			expect(clearIntervalSpy).toHaveBeenCalledWith(timerId);
			expect((plugin as any).autoImportTimer).toBeUndefined();
		});

		it('should not throw when no timer exists', () => {
			expect(() => (plugin as any).cleanupAutoImport()).not.toThrow();
			expect(clearIntervalSpy).not.toHaveBeenCalled();
		});
	});

	describe('performAutoImport', () => {
		it('should call openImportModal', async () => {
			await plugin.performAutoImport();

			expect(plugin.openImportModal).toHaveBeenCalled();
			expect(plugin.logger.info).toHaveBeenCalledWith('Starting automatic import');
		});

		it('should handle authentication errors and disable auto-import', async () => {
			// Mock openImportModal to reject with an auth error
			plugin.openImportModal = jest.fn(() => {
				throw new Error('Invalid token');
			});

			await plugin.performAutoImport();

			expect(plugin.logger.error).toHaveBeenCalled();
			expect(plugin.settings.autoImport.enabled).toBe(false);
			expect(plugin.saveSettings).toHaveBeenCalled();
		});

		it('should handle credentials errors and disable auto-import', async () => {
			plugin.openImportModal = jest.fn(() => {
				throw new Error('credentials not found');
			});

			await plugin.performAutoImport();

			expect(plugin.settings.autoImport.enabled).toBe(false);
			expect(plugin.saveSettings).toHaveBeenCalled();
		});

		it('should handle unauthorized errors and disable auto-import', async () => {
			plugin.openImportModal = jest.fn(() => {
				throw new Error('unauthorized access');
			});

			await plugin.performAutoImport();

			expect(plugin.settings.autoImport.enabled).toBe(false);
			expect(plugin.saveSettings).toHaveBeenCalled();
		});

		it('should handle expired token errors and disable auto-import', async () => {
			plugin.openImportModal = jest.fn(() => {
				throw new Error('Token expired');
			});

			await plugin.performAutoImport();

			expect(plugin.settings.autoImport.enabled).toBe(false);
			expect(plugin.saveSettings).toHaveBeenCalled();
		});

		it('should not disable auto-import for non-auth errors', async () => {
			// Enable auto-import first
			plugin.settings.autoImport.enabled = true;
			
			plugin.openImportModal = jest.fn(() => {
				throw new Error('Network error');
			});

			await plugin.performAutoImport();

			expect(plugin.logger.error).toHaveBeenCalled();
			expect(plugin.settings.autoImport.enabled).toBe(true);
			expect(plugin.saveSettings).not.toHaveBeenCalled();
		});

		it('should log warning for non-auth errors', async () => {
			// Enable auto-import first
			plugin.settings.autoImport.enabled = true;
			
			plugin.openImportModal = jest.fn(() => {
				throw new Error('Some other error');
			});

			await plugin.performAutoImport();

			expect(plugin.logger.warn).toHaveBeenCalledWith(
				'Auto-import encountered an error, will retry on next interval'
			);
		});
	});

	describe('saveSettings integration', () => {
		it('should call setupAutoImport when saveSettings is called', async () => {
			// For this test, we need to temporarily bind the real saveSettings
			const setupSpy = jest.spyOn(plugin, 'setupAutoImport');
			const realSaveSettings = GranolaImporterPlugin.prototype['saveSettings'].bind(plugin);
			
			// Add mocks that saveSettings needs
			plugin.converter = {
				updateSettings: jest.fn(),
			} as any;
			plugin.metadataService = {
				updateSettings: jest.fn(),
			} as any;

			plugin.settings.autoImport.enabled = true;
			plugin.settings.autoImport.interval = 14400000;

			await realSaveSettings();

			// Should have called setupAutoImport
			expect(setupSpy).toHaveBeenCalled();
			expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
		});
	});

	describe('timer intervals', () => {
		it('should support 1 hour interval', () => {
			plugin.settings.autoImport.enabled = true;
			plugin.settings.autoImport.interval = 3600000;

			(plugin as any).setupAutoImport();

			expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 3600000);
		});

		it('should support 4 hours interval', () => {
			plugin.settings.autoImport.enabled = true;
			plugin.settings.autoImport.interval = 14400000;

			(plugin as any).setupAutoImport();

			expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 14400000);
		});

		it('should support 12 hours interval', () => {
			plugin.settings.autoImport.enabled = true;
			plugin.settings.autoImport.interval = 43200000;

			(plugin as any).setupAutoImport();

			expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 43200000);
		});

		it('should support daily interval', () => {
			plugin.settings.autoImport.enabled = true;
			plugin.settings.autoImport.interval = 86400000;

			(plugin as any).setupAutoImport();

			expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 86400000);
		});
	});
});
