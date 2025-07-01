import {
	LogLevel,
	ImportStrategy,
	DatePrefixFormat,
	ContentPriority,
	GranolaSettings,
	Logger,
	DEFAULT_SETTINGS,
	GranolaSettingTab,
} from '../../src/settings';
import { App, PluginSettingTab } from 'obsidian';
import GranolaImporterPlugin from '../../main';

// Mock the Setting class globally
jest.mock('obsidian', () => ({
	...jest.requireActual('obsidian'),
	Setting: jest.fn().mockImplementation(() => ({
		setName: jest.fn().mockReturnThis(),
		setDesc: jest.fn().mockReturnThis(),
		addToggle: jest.fn().mockReturnThis(),
		addDropdown: jest.fn().mockReturnThis(),
		addText: jest.fn().mockReturnThis(),
		addSlider: jest.fn().mockReturnThis(),
		addButton: jest.fn().mockReturnThis(),
	})),
	App: jest.fn(),
	PluginSettingTab: jest.fn(),
}));

describe('Settings Module', () => {
	describe('LogLevel enum', () => {
		it('should have correct values', () => {
			expect(LogLevel.ERROR).toBe(0);
			expect(LogLevel.WARN).toBe(1);
			expect(LogLevel.INFO).toBe(2);
			expect(LogLevel.DEBUG).toBe(3);
		});

		it('should be ordered by severity', () => {
			expect(LogLevel.ERROR < LogLevel.WARN).toBe(true);
			expect(LogLevel.WARN < LogLevel.INFO).toBe(true);
			expect(LogLevel.INFO < LogLevel.DEBUG).toBe(true);
		});

		it('should have all expected log levels', () => {
			const logLevels = Object.values(LogLevel).filter(v => typeof v === 'number');
			expect(logLevels).toHaveLength(4);
			expect(logLevels).toEqual([0, 1, 2, 3]);
		});
	});

	describe('ImportStrategy enum', () => {
		it('should have correct string values', () => {
			expect(ImportStrategy.SKIP_EXISTING).toBe('skip');
			expect(ImportStrategy.UPDATE_EXISTING).toBe('update');
			expect(ImportStrategy.ALWAYS_PROMPT).toBe('prompt');
		});

		it('should have all expected strategies', () => {
			const strategies = Object.values(ImportStrategy);
			expect(strategies).toContain('skip');
			expect(strategies).toContain('update');
			expect(strategies).toContain('prompt');
			expect(strategies).toHaveLength(3);
		});

		it('should be valid strategy identifiers', () => {
			Object.values(ImportStrategy).forEach(strategy => {
				expect(typeof strategy).toBe('string');
				expect(strategy.length).toBeGreaterThan(0);
				expect(/^[a-z_]+$/.test(strategy)).toBe(true);
			});
		});
	});

	describe('DatePrefixFormat enum', () => {
		it('should have correct format values', () => {
			expect(DatePrefixFormat.ISO_DATE).toBe('YYYY-MM-DD');
			expect(DatePrefixFormat.US_DATE).toBe('MM-DD-YYYY');
			expect(DatePrefixFormat.EU_DATE).toBe('DD-MM-YYYY');
			expect(DatePrefixFormat.DOT_DATE).toBe('YYYY.MM.DD');
			expect(DatePrefixFormat.NONE).toBe('none');
		});

		it('should have all expected formats', () => {
			const formats = Object.values(DatePrefixFormat);
			expect(formats).toContain('YYYY-MM-DD');
			expect(formats).toContain('MM-DD-YYYY');
			expect(formats).toContain('DD-MM-YYYY');
			expect(formats).toContain('YYYY.MM.DD');
			expect(formats).toContain('none');
			expect(formats).toHaveLength(5);
		});

		it('should have valid date format patterns', () => {
			const dateFormats = [
				DatePrefixFormat.ISO_DATE,
				DatePrefixFormat.US_DATE,
				DatePrefixFormat.EU_DATE,
				DatePrefixFormat.DOT_DATE,
			];

			dateFormats.forEach(format => {
				expect(format).toMatch(/[YMDH.-]+/);
				expect(format).toContain('YYYY');
				expect(format).toContain('MM');
				expect(format).toContain('DD');
			});
		});
	});

	describe('ContentPriority enum', () => {
		it('should have correct priority values', () => {
			expect(ContentPriority.PANEL_FIRST).toBe('panel_first');
			expect(ContentPriority.NOTES_FIRST).toBe('notes_first');
			expect(ContentPriority.PANEL_ONLY).toBe('panel_only');
			expect(ContentPriority.NOTES_ONLY).toBe('notes_only');
		});

		it('should have all expected priorities', () => {
			const priorities = Object.values(ContentPriority);
			expect(priorities).toContain('panel_first');
			expect(priorities).toContain('notes_first');
			expect(priorities).toContain('panel_only');
			expect(priorities).toContain('notes_only');
			expect(priorities).toHaveLength(4);
		});

		it('should be valid priority identifiers', () => {
			Object.values(ContentPriority).forEach(priority => {
				expect(typeof priority).toBe('string');
				expect(priority.length).toBeGreaterThan(0);
				expect(/^[a-z_]+$/.test(priority)).toBe(true);
			});
		});
	});

	describe('GranolaSettings interface structure', () => {
		let validSettings: GranolaSettings;

		beforeEach(() => {
			validSettings = {
				debug: {
					enabled: false,
					logLevel: LogLevel.INFO,
					saveToFile: false,
				},
				import: {
					strategy: ImportStrategy.SKIP_EXISTING,
					defaultFolder: '',
					createFolders: true,
					maxFilenameLength: 100,
				},
				content: {
					datePrefixFormat: DatePrefixFormat.ISO_DATE,
					contentPriority: ContentPriority.PANEL_FIRST,
					includeMetadata: true,
					customFrontmatter: [],
				},
				ui: {
					autoCloseModal: false,
					showProgressNotifications: true,
					selectAllByDefault: false,
				},
				connection: {
					lastValidated: 0,
					isConnected: false,
					timeoutMs: 30000,
				},
			};
		});

		it('should accept valid debug settings', () => {
			expect(validSettings.debug.enabled).toBe(false);
			expect(validSettings.debug.logLevel).toBe(LogLevel.INFO);
			expect(validSettings.debug.saveToFile).toBe(false);

			// Test with different values
			validSettings.debug.enabled = true;
			validSettings.debug.logLevel = LogLevel.DEBUG;
			validSettings.debug.saveToFile = true;

			expect(validSettings.debug.enabled).toBe(true);
			expect(validSettings.debug.logLevel).toBe(LogLevel.DEBUG);
			expect(validSettings.debug.saveToFile).toBe(true);
		});

		it('should accept valid import settings', () => {
			expect(validSettings.import.strategy).toBe(ImportStrategy.SKIP_EXISTING);
			expect(validSettings.import.defaultFolder).toBe('');
			expect(validSettings.import.createFolders).toBe(true);
			expect(validSettings.import.maxFilenameLength).toBe(100);

			// Test with different values
			validSettings.import.strategy = ImportStrategy.UPDATE_EXISTING;
			validSettings.import.defaultFolder = 'Granola Notes';
			validSettings.import.createFolders = false;
			validSettings.import.maxFilenameLength = 200;

			expect(validSettings.import.strategy).toBe(ImportStrategy.UPDATE_EXISTING);
			expect(validSettings.import.defaultFolder).toBe('Granola Notes');
			expect(validSettings.import.createFolders).toBe(false);
			expect(validSettings.import.maxFilenameLength).toBe(200);
		});

		it('should accept valid content settings', () => {
			expect(validSettings.content.datePrefixFormat).toBe(DatePrefixFormat.ISO_DATE);
			expect(validSettings.content.contentPriority).toBe(ContentPriority.PANEL_FIRST);
			expect(validSettings.content.includeMetadata).toBe(true);
			expect(validSettings.content.customFrontmatter).toEqual([]);

			// Test with different values
			validSettings.content.datePrefixFormat = DatePrefixFormat.US_DATE;
			validSettings.content.contentPriority = ContentPriority.NOTES_ONLY;
			validSettings.content.includeMetadata = false;
			validSettings.content.customFrontmatter = ['tags', 'category'];

			expect(validSettings.content.datePrefixFormat).toBe(DatePrefixFormat.US_DATE);
			expect(validSettings.content.contentPriority).toBe(ContentPriority.NOTES_ONLY);
			expect(validSettings.content.includeMetadata).toBe(false);
			expect(validSettings.content.customFrontmatter).toEqual(['tags', 'category']);
		});

		it('should accept valid UI settings', () => {
			expect(validSettings.ui.autoCloseModal).toBe(false);
			expect(validSettings.ui.showProgressNotifications).toBe(true);

			// Test with different values
			validSettings.ui.autoCloseModal = true;
			validSettings.ui.showProgressNotifications = false;

			expect(validSettings.ui.autoCloseModal).toBe(true);
			expect(validSettings.ui.showProgressNotifications).toBe(false);
		});

		it('should support all enum combinations', () => {
			// Test all LogLevel values
			Object.values(LogLevel)
				.filter(v => typeof v === 'number')
				.forEach(level => {
					validSettings.debug.logLevel = level as LogLevel;
					expect(validSettings.debug.logLevel).toBe(level);
				});

			// Test all ImportStrategy values
			Object.values(ImportStrategy).forEach(strategy => {
				validSettings.import.strategy = strategy;
				expect(validSettings.import.strategy).toBe(strategy);
			});

			// Test all DatePrefixFormat values
			Object.values(DatePrefixFormat).forEach(format => {
				validSettings.content.datePrefixFormat = format;
				expect(validSettings.content.datePrefixFormat).toBe(format);
			});

			// Test all ContentPriority values
			Object.values(ContentPriority).forEach(priority => {
				validSettings.content.contentPriority = priority;
				expect(validSettings.content.contentPriority).toBe(priority);
			});
		});

		it('should support custom frontmatter arrays', () => {
			const customFields = ['author', 'source', 'tags', 'category', 'project'];
			validSettings.content.customFrontmatter = customFields;

			expect(validSettings.content.customFrontmatter).toEqual(customFields);
			expect(validSettings.content.customFrontmatter).toHaveLength(5);
		});

		it('should support reasonable filename length limits', () => {
			const testLengths = [50, 100, 150, 200, 255];

			testLengths.forEach(length => {
				validSettings.import.maxFilenameLength = length;
				expect(validSettings.import.maxFilenameLength).toBe(length);
				expect(validSettings.import.maxFilenameLength).toBeGreaterThan(0);
			});
		});

		it('should support folder path configurations', () => {
			const testPaths = [
				'',
				'Granola',
				'Notes/Granola',
				'Daily Notes/Granola',
				'Archive/2023/Granola',
			];

			testPaths.forEach(path => {
				validSettings.import.defaultFolder = path;
				expect(validSettings.import.defaultFolder).toBe(path);
			});
		});
	});

	describe('enum validation helpers', () => {
		it('should validate LogLevel values', () => {
			const validLogLevels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
			validLogLevels.forEach(level => {
				expect(Object.values(LogLevel)).toContain(level);
			});

			// Test invalid values
			expect(Object.values(LogLevel)).not.toContain(-1);
			expect(Object.values(LogLevel)).not.toContain(4);
		});

		it('should validate ImportStrategy values', () => {
			const validStrategies = ['skip', 'update', 'prompt'];
			validStrategies.forEach(strategy => {
				expect(Object.values(ImportStrategy)).toContain(strategy);
			});

			// Test invalid values
			expect(Object.values(ImportStrategy)).not.toContain('invalid');
			expect(Object.values(ImportStrategy)).not.toContain('delete');
		});

		it('should validate DatePrefixFormat values', () => {
			const validFormats = ['YYYY-MM-DD', 'MM-DD-YYYY', 'DD-MM-YYYY', 'YYYY.MM.DD', 'none'];
			validFormats.forEach(format => {
				expect(Object.values(DatePrefixFormat)).toContain(format);
			});

			// Test invalid values
			expect(Object.values(DatePrefixFormat)).not.toContain('invalid');
			expect(Object.values(DatePrefixFormat)).not.toContain('DD/MM/YYYY');
		});

		it('should validate ContentPriority values', () => {
			const validPriorities = ['panel_first', 'notes_first', 'panel_only', 'notes_only'];
			validPriorities.forEach(priority => {
				expect(Object.values(ContentPriority)).toContain(priority);
			});

			// Test invalid values
			expect(Object.values(ContentPriority)).not.toContain('invalid');
			expect(Object.values(ContentPriority)).not.toContain('markdown_first');
		});
	});

	describe('settings defaults and ranges', () => {
		it('should support reasonable default values', () => {
			const defaultSettings: GranolaSettings = {
				debug: {
					enabled: false,
					logLevel: LogLevel.WARN,
					saveToFile: false,
				},
				import: {
					strategy: ImportStrategy.SKIP_EXISTING,
					defaultFolder: '',
					createFolders: true,
					maxFilenameLength: 100,
				},
				content: {
					datePrefixFormat: DatePrefixFormat.ISO_DATE,
					contentPriority: ContentPriority.PANEL_FIRST,
					includeMetadata: true,
					customFrontmatter: [],
				},
				ui: {
					autoCloseModal: false,
					showProgressNotifications: true,
					selectAllByDefault: false,
				},
				connection: {
					lastValidated: 0,
					isConnected: false,
					timeoutMs: 30000,
				},
			};

			// Verify all defaults are reasonable
			expect(defaultSettings.debug.enabled).toBe(false);
			expect(defaultSettings.debug.logLevel).toBe(LogLevel.WARN);
			expect(defaultSettings.import.strategy).toBe(ImportStrategy.SKIP_EXISTING);
			expect(defaultSettings.import.maxFilenameLength).toBeGreaterThan(0);
			expect(defaultSettings.content.datePrefixFormat).toBe(DatePrefixFormat.ISO_DATE);
			expect(defaultSettings.content.includeMetadata).toBe(true);
			expect(defaultSettings.ui.showProgressNotifications).toBe(true);
		});

		it('should support edge case configurations', () => {
			const edgeCaseSettings: GranolaSettings = {
				debug: {
					enabled: true,
					logLevel: LogLevel.DEBUG,
					saveToFile: true,
				},
				import: {
					strategy: ImportStrategy.ALWAYS_PROMPT,
					defaultFolder: 'Very/Deep/Nested/Folder/Structure',
					createFolders: false,
					maxFilenameLength: 255,
				},
				content: {
					datePrefixFormat: DatePrefixFormat.NONE,
					contentPriority: ContentPriority.NOTES_ONLY,
					includeMetadata: false,
					customFrontmatter: ['field1', 'field2', 'field3', 'field4', 'field5'],
				},
				ui: {
					autoCloseModal: true,
					showProgressNotifications: false,
					selectAllByDefault: true,
				},
			};

			// Verify edge cases work
			expect(edgeCaseSettings.debug.enabled).toBe(true);
			expect(edgeCaseSettings.import.defaultFolder).toContain('/');
			expect(edgeCaseSettings.import.maxFilenameLength).toBe(255);
			expect(edgeCaseSettings.content.customFrontmatter).toHaveLength(5);
		});
	});

	describe('DEFAULT_SETTINGS', () => {
		it('should have reasonable default values', () => {
			expect(DEFAULT_SETTINGS.debug.enabled).toBe(false);
			expect(DEFAULT_SETTINGS.debug.logLevel).toBe(LogLevel.WARN);
			expect(DEFAULT_SETTINGS.debug.saveToFile).toBe(false);

			expect(DEFAULT_SETTINGS.import.strategy).toBe(ImportStrategy.ALWAYS_PROMPT);
			expect(DEFAULT_SETTINGS.import.defaultFolder).toBe('');
			expect(DEFAULT_SETTINGS.import.createFolders).toBe(true);
			expect(DEFAULT_SETTINGS.import.maxFilenameLength).toBe(100);

			expect(DEFAULT_SETTINGS.content.datePrefixFormat).toBe(DatePrefixFormat.ISO_DATE);
			expect(DEFAULT_SETTINGS.content.contentPriority).toBe(ContentPriority.PANEL_FIRST);
			expect(DEFAULT_SETTINGS.content.includeMetadata).toBe(true);
			expect(DEFAULT_SETTINGS.content.customFrontmatter).toEqual([]);

			expect(DEFAULT_SETTINGS.ui.autoCloseModal).toBe(false);
			expect(DEFAULT_SETTINGS.ui.showProgressNotifications).toBe(true);
			expect(DEFAULT_SETTINGS.ui.selectAllByDefault).toBe(false);

			expect(DEFAULT_SETTINGS.connection.lastValidated).toBe(0);
			expect(DEFAULT_SETTINGS.connection.isConnected).toBe(false);
			expect(DEFAULT_SETTINGS.connection.timeoutMs).toBe(30000);
		});

		it('should be a valid GranolaSettings object', () => {
			// Type check - should not throw compilation errors
			const settings: GranolaSettings = DEFAULT_SETTINGS;
			expect(settings).toBeDefined();
		});

		it('should use valid enum values', () => {
			expect(Object.values(LogLevel)).toContain(DEFAULT_SETTINGS.debug.logLevel);
			expect(Object.values(ImportStrategy)).toContain(DEFAULT_SETTINGS.import.strategy);
			expect(Object.values(DatePrefixFormat)).toContain(
				DEFAULT_SETTINGS.content.datePrefixFormat
			);
			expect(Object.values(ContentPriority)).toContain(
				DEFAULT_SETTINGS.content.contentPriority
			);
		});
	});

	describe('Logger class', () => {
		let logger: Logger;
		let testSettings: GranolaSettings;
		let consoleErrorSpy: jest.SpyInstance;
		let consoleWarnSpy: jest.SpyInstance;
		let consoleInfoSpy: jest.SpyInstance;
		let consoleLogSpy: jest.SpyInstance;

		beforeEach(() => {
			testSettings = {
				debug: {
					enabled: false,
					logLevel: LogLevel.WARN,
					saveToFile: false,
				},
				import: {
					strategy: ImportStrategy.SKIP_EXISTING,
					defaultFolder: '',
					createFolders: true,
					maxFilenameLength: 100,
				},
				content: {
					datePrefixFormat: DatePrefixFormat.ISO_DATE,
					contentPriority: ContentPriority.PANEL_FIRST,
					includeMetadata: true,
					customFrontmatter: [],
				},
				ui: {
					autoCloseModal: false,
					showProgressNotifications: true,
					selectAllByDefault: false,
				},
				connection: {
					lastValidated: 0,
					isConnected: false,
					timeoutMs: 30000,
				},
			};

			logger = new Logger(testSettings);

			// Spy on console methods
			consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
			consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
			consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
			consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		describe('constructor', () => {
			it('should initialize with settings', () => {
				expect(logger).toBeInstanceOf(Logger);
			});
		});

		describe('updateSettings', () => {
			it('should update logger settings', () => {
				const newSettings = { ...testSettings };
				newSettings.debug.logLevel = LogLevel.DEBUG;

				logger.updateSettings(newSettings);

				// Verify settings were updated by testing log behavior
				logger.debug('test message');
				expect(consoleLogSpy).not.toHaveBeenCalled(); // debug is disabled

				newSettings.debug.enabled = true;
				logger.updateSettings(newSettings);
				logger.debug('test message');
				expect(consoleLogSpy).toHaveBeenCalledWith('[Granola Importer Debug] test message');
			});
		});

		describe('error', () => {
			it('should log error messages when log level allows', () => {
				testSettings.debug.logLevel = LogLevel.ERROR;
				logger.updateSettings(testSettings);

				logger.error('Test error message', 'extra', 'args');

				expect(consoleErrorSpy).toHaveBeenCalledWith(
					'[Granola Importer] Test error message',
					'extra',
					'args'
				);
			});

			it('should not log error messages when log level is too low', () => {
				testSettings.debug.logLevel = -1 as LogLevel; // Below ERROR level
				logger.updateSettings(testSettings);

				logger.error('Test error message');

				expect(consoleErrorSpy).not.toHaveBeenCalled();
			});
		});

		describe('warn', () => {
			it('should log warning messages when log level allows', () => {
				testSettings.debug.logLevel = LogLevel.WARN;
				logger.updateSettings(testSettings);

				logger.warn('Test warning message', { detail: 'object' });

				expect(consoleWarnSpy).toHaveBeenCalledWith(
					'[Granola Importer] Test warning message',
					{ detail: 'object' }
				);
			});

			it('should not log warning messages when log level is too low', () => {
				testSettings.debug.logLevel = LogLevel.ERROR;
				logger.updateSettings(testSettings);

				logger.warn('Test warning message');

				expect(consoleWarnSpy).not.toHaveBeenCalled();
			});
		});

		describe('info', () => {
			it('should log info messages when log level allows', () => {
				testSettings.debug.logLevel = LogLevel.INFO;
				logger.updateSettings(testSettings);

				logger.info('Test info message', 123, true);

				expect(consoleInfoSpy).toHaveBeenCalledWith(
					'[Granola Importer] Test info message',
					123,
					true
				);
			});

			it('should not log info messages when log level is too low', () => {
				testSettings.debug.logLevel = LogLevel.WARN;
				logger.updateSettings(testSettings);

				logger.info('Test info message');

				expect(consoleInfoSpy).not.toHaveBeenCalled();
			});
		});

		describe('debug', () => {
			it('should log debug messages when debug is enabled and log level allows', () => {
				testSettings.debug.enabled = true;
				testSettings.debug.logLevel = LogLevel.DEBUG;
				logger.updateSettings(testSettings);

				logger.debug('Test debug message', ['array', 'data']);

				expect(consoleLogSpy).toHaveBeenCalledWith(
					'[Granola Importer Debug] Test debug message',
					['array', 'data']
				);
			});

			it('should not log debug messages when debug is disabled', () => {
				testSettings.debug.enabled = false;
				testSettings.debug.logLevel = LogLevel.DEBUG;
				logger.updateSettings(testSettings);

				logger.debug('Test debug message');

				expect(consoleLogSpy).not.toHaveBeenCalled();
			});

			it('should not log debug messages when log level is too low', () => {
				testSettings.debug.enabled = true;
				testSettings.debug.logLevel = LogLevel.INFO;
				logger.updateSettings(testSettings);

				logger.debug('Test debug message');

				expect(consoleLogSpy).not.toHaveBeenCalled();
			});

			it('should require both debug enabled and proper log level', () => {
				// Test all combinations
				const testCases = [
					{ enabled: false, logLevel: LogLevel.DEBUG, shouldLog: false },
					{ enabled: true, logLevel: LogLevel.INFO, shouldLog: false },
					{ enabled: false, logLevel: LogLevel.INFO, shouldLog: false },
					{ enabled: true, logLevel: LogLevel.DEBUG, shouldLog: true },
				];

				testCases.forEach(({ enabled, logLevel, shouldLog }, index) => {
					consoleLogSpy.mockClear();
					testSettings.debug.enabled = enabled;
					testSettings.debug.logLevel = logLevel;
					logger.updateSettings(testSettings);

					logger.debug(`Test message ${index}`);

					if (shouldLog) {
						expect(consoleLogSpy).toHaveBeenCalledWith(
							`[Granola Importer Debug] Test message ${index}`
						);
					} else {
						expect(consoleLogSpy).not.toHaveBeenCalled();
					}
				});
			});
		});

		describe('log level hierarchy', () => {
			it('should respect log level hierarchy for all methods', () => {
				// Set to INFO level
				testSettings.debug.enabled = true; // For debug method
				testSettings.debug.logLevel = LogLevel.INFO;
				logger.updateSettings(testSettings);

				logger.error('error'); // Should log
				logger.warn('warn'); // Should log
				logger.info('info'); // Should log
				logger.debug('debug'); // Should NOT log

				expect(consoleErrorSpy).toHaveBeenCalledWith('[Granola Importer] error');
				expect(consoleWarnSpy).toHaveBeenCalledWith('[Granola Importer] warn');
				expect(consoleInfoSpy).toHaveBeenCalledWith('[Granola Importer] info');
				expect(consoleLogSpy).not.toHaveBeenCalled();
			});

			it('should handle minimum log level correctly', () => {
				testSettings.debug.logLevel = LogLevel.ERROR;
				logger.updateSettings(testSettings);

				logger.error('error'); // Should log
				logger.warn('warn'); // Should NOT log
				logger.info('info'); // Should NOT log

				expect(consoleErrorSpy).toHaveBeenCalledWith('[Granola Importer] error');
				expect(consoleWarnSpy).not.toHaveBeenCalled();
				expect(consoleInfoSpy).not.toHaveBeenCalled();
			});
		});
	});

	describe('GranolaSettingTab class', () => {
		let mockApp: App;
		let mockPlugin: GranolaImporterPlugin;
		let settingTab: GranolaSettingTab;

		beforeEach(() => {
			mockApp = {} as App;
			mockPlugin = {
				settings: DEFAULT_SETTINGS,
				saveSettings: jest.fn().mockResolvedValue(undefined),
			} as unknown as GranolaImporterPlugin;

			settingTab = new GranolaSettingTab(mockApp, mockPlugin);
		});

		describe('constructor', () => {
			it('should initialize with app and plugin', () => {
				expect(settingTab).toBeInstanceOf(GranolaSettingTab);
				expect(settingTab).toBeInstanceOf(PluginSettingTab);
				expect(settingTab.plugin).toBe(mockPlugin);
			});
		});

		describe('display', () => {
			it('should create containerEl for settings', () => {
				// Mock containerEl and its methods
				const mockContainerEl = {
					empty: jest.fn(),
					createEl: jest.fn().mockReturnThis(),
					createDiv: jest.fn().mockReturnThis(),
					addClass: jest.fn().mockReturnThis(),
					appendChild: jest.fn(),
					addEventListener: jest.fn(),
				};
				settingTab.containerEl = mockContainerEl as any;

				// Call display - should not throw
				expect(() => settingTab.display()).not.toThrow();
				expect(mockContainerEl.empty).toHaveBeenCalled();
			});
		});
	});
});
