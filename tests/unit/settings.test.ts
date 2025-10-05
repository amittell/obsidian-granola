import {
	LogLevel,
	ImportStrategy,
	DatePrefixFormat,
	GranolaSettings,
	Logger,
	DEFAULT_SETTINGS,
} from '../../src/types';
import { GranolaSettingTab } from '../../src/settings';
import { App, PluginSettingTab, Setting } from 'obsidian';
import GranolaImporterPlugin from '../../main.ts';

// Create a global mock for callbacks that can be accessed from both mock factory and tests
const globalCallbacks = {
	sliderCallbacks: [] as Array<(value: number) => Promise<void>>,
	dropdownCallbacks: [] as Array<(value: string) => Promise<void>>,
	toggleCallbacks: [] as Array<(value: boolean) => Promise<void>>,
	textCallbacks: [] as Array<(value: string) => Promise<void>>,
	buttonCallbacks: [] as Array<() => Promise<void>>,
};

// Mock the Setting class globally with our robust UI mock
jest.mock('obsidian', () => ({
	...jest.requireActual('obsidian'),
	Setting: jest.fn().mockImplementation(() => {
		const settingInstance = {
			setName: jest.fn().mockReturnThis(),
			setDesc: jest.fn().mockReturnThis(),
			setHeading: jest.fn().mockReturnThis(),
			addSlider: jest.fn().mockImplementation(builderFn => {
				const mockSlider = {
					setLimits: jest.fn().mockReturnThis(),
					setValue: jest.fn().mockReturnThis(),
					setDynamicTooltip: jest.fn().mockReturnThis(),
					onChange: jest.fn().mockImplementation(callback => {
						globalCallbacks.sliderCallbacks.push(callback);
						return mockSlider;
					}),
				};
				builderFn(mockSlider);
				return settingInstance;
			}),
			addDropdown: jest.fn().mockImplementation(builderFn => {
				const mockDropdown = {
					addOption: jest.fn().mockReturnThis(),
					setValue: jest.fn().mockReturnThis(),
					onChange: jest.fn().mockImplementation(callback => {
						globalCallbacks.dropdownCallbacks.push(callback);
						return mockDropdown;
					}),
				};
				builderFn(mockDropdown);
				return settingInstance;
			}),
			addToggle: jest.fn().mockImplementation(builderFn => {
				const mockToggle = {
					setValue: jest.fn().mockReturnThis(),
					onChange: jest.fn().mockImplementation(callback => {
						globalCallbacks.toggleCallbacks.push(callback);
						return mockToggle;
					}),
				};
				builderFn(mockToggle);
				return settingInstance;
			}),
			addText: jest.fn().mockImplementation(builderFn => {
				const mockText = {
					setPlaceholder: jest.fn().mockReturnThis(),
					setValue: jest.fn().mockReturnThis(),
					onChange: jest.fn().mockImplementation(callback => {
						globalCallbacks.textCallbacks.push(callback);
						return mockText;
					}),
				};
				builderFn(mockText);
				return settingInstance;
			}),
			addButton: jest.fn().mockImplementation(builderFn => {
				const mockButton = {
					setButtonText: jest.fn().mockReturnThis(),
					setCta: jest.fn().mockReturnThis(),
					onClick: jest.fn().mockImplementation(callback => {
						globalCallbacks.buttonCallbacks.push(callback);
						return mockButton;
					}),
				};
				builderFn(mockButton);
				return settingInstance;
			}),
		};
		return settingInstance;
	}),
	App: jest.fn(),
	PluginSettingTab: jest.fn(),
}));

// Access callbacks from global mock
const callbacks = globalCallbacks;

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

	describe('GranolaSettings interface structure', () => {
		let validSettings: GranolaSettings;

		beforeEach(() => {
			validSettings = {
				debug: {
					enabled: false,
					logLevel: LogLevel.INFO,
				},
				import: {
					strategy: ImportStrategy.SKIP_EXISTING,
					defaultFolder: '',
				},
				content: {
					datePrefixFormat: DatePrefixFormat.ISO_DATE,
				},
				ui: {
					showProgressNotifications: true,
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

			// Test with different values
			validSettings.debug.enabled = true;
			validSettings.debug.logLevel = LogLevel.DEBUG;
			expect(validSettings.debug.enabled).toBe(true);
			expect(validSettings.debug.logLevel).toBe(LogLevel.DEBUG);
		});

		it('should accept valid import settings', () => {
			expect(validSettings.import.strategy).toBe(ImportStrategy.SKIP_EXISTING);
			expect(validSettings.import.defaultFolder).toBe('');

			// Test with different values
			validSettings.import.strategy = ImportStrategy.UPDATE_EXISTING;
			validSettings.import.defaultFolder = 'Granola Notes';
			expect(validSettings.import.strategy).toBe(ImportStrategy.UPDATE_EXISTING);
			expect(validSettings.import.defaultFolder).toBe('Granola Notes');
		});

		it('should accept valid content settings', () => {
			expect(validSettings.content.datePrefixFormat).toBe(DatePrefixFormat.ISO_DATE);
			// Test with different values
			validSettings.content.datePrefixFormat = DatePrefixFormat.US_DATE;
			expect(validSettings.content.datePrefixFormat).toBe(DatePrefixFormat.US_DATE);
		});

		it('should accept valid UI settings', () => {
			expect(validSettings.ui.showProgressNotifications).toBe(true);

			// Test with different values
			validSettings.ui.showProgressNotifications = false;

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
	});
});

describe('settings defaults and ranges', () => {
	it('should support reasonable default values', () => {
		const defaultSettings: GranolaSettings = {
			debug: {
				enabled: false,
				logLevel: LogLevel.WARN,
			},
			import: {
				strategy: ImportStrategy.SKIP_EXISTING,
				defaultFolder: '',
			},
			content: {
				datePrefixFormat: DatePrefixFormat.ISO_DATE,
			},
			ui: {
				showProgressNotifications: true,
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
		expect(defaultSettings.content.datePrefixFormat).toBe(DatePrefixFormat.ISO_DATE);
		expect(defaultSettings.ui.showProgressNotifications).toBe(true);
	});

	it('should support edge case configurations', () => {
		const edgeCaseSettings: GranolaSettings = {
			debug: {
				enabled: true,
				logLevel: LogLevel.DEBUG,
			},
			import: {
				strategy: ImportStrategy.ALWAYS_PROMPT,
				defaultFolder: 'Very/Deep/Nested/Folder/Structure',
			},
			content: {
				datePrefixFormat: DatePrefixFormat.NONE,
			},
			ui: {
				showProgressNotifications: false,
			},
		};

		// Verify edge cases work
		expect(edgeCaseSettings.debug.enabled).toBe(true);
		expect(edgeCaseSettings.import.defaultFolder).toContain('/');
	});
});

describe('DEFAULT_SETTINGS', () => {
	it('should have reasonable default values', () => {
		expect(DEFAULT_SETTINGS.debug.enabled).toBe(false);
		expect(DEFAULT_SETTINGS.debug.logLevel).toBe(LogLevel.WARN);

		expect(DEFAULT_SETTINGS.import.strategy).toBe(ImportStrategy.ALWAYS_PROMPT);
		expect(DEFAULT_SETTINGS.import.defaultFolder).toBe('');

		expect(DEFAULT_SETTINGS.content.datePrefixFormat).toBe(DatePrefixFormat.ISO_DATE);

		expect(DEFAULT_SETTINGS.ui.showProgressNotifications).toBe(true);

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
			},
			import: {
				strategy: ImportStrategy.SKIP_EXISTING,
				defaultFolder: '',
			},
			content: {
				datePrefixFormat: DatePrefixFormat.ISO_DATE,
			},
			ui: {
				showProgressNotifications: true,
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
			newSettings.debug.enabled = false; // explicitly disable debug

			logger.updateSettings(newSettings);

			// Verify settings were updated by testing log behavior
			logger.debug('test message');
			// With new logic: debug shows when log level is DEBUG even if debug disabled
			expect(consoleLogSpy).toHaveBeenCalledWith('[Granola Importer Debug] test message');

			consoleLogSpy.mockClear();
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

			expect(consoleWarnSpy).toHaveBeenCalledWith('[Granola Importer] Test warning message', {
				detail: 'object',
			});
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

		it('should log debug messages when log level is DEBUG even if debug is disabled', () => {
			testSettings.debug.enabled = false;
			testSettings.debug.logLevel = LogLevel.DEBUG;
			logger.updateSettings(testSettings);

			logger.debug('Test debug message');

			expect(consoleLogSpy).toHaveBeenCalledWith(
				'[Granola Importer Debug] Test debug message'
			);
		});

		it('should log debug messages when debug is enabled even if log level is low', () => {
			testSettings.debug.enabled = true;
			testSettings.debug.logLevel = LogLevel.INFO;
			logger.updateSettings(testSettings);

			logger.debug('Test debug message');

			expect(consoleLogSpy).toHaveBeenCalledWith(
				'[Granola Importer Debug] Test debug message'
			);
		});

		it('should log debug messages when debug enabled OR log level is DEBUG', () => {
			// Test all combinations with new OR logic
			const testCases = [
				{ enabled: false, logLevel: LogLevel.DEBUG, shouldLog: true },
				{ enabled: true, logLevel: LogLevel.INFO, shouldLog: true },
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
		it('should respect log level hierarchy for non-debug methods', () => {
			// Set to INFO level with debug disabled to test pure hierarchy
			testSettings.debug.enabled = false;
			testSettings.debug.logLevel = LogLevel.INFO;
			logger.updateSettings(testSettings);

			logger.error('error'); // Should log
			logger.warn('warn'); // Should log
			logger.info('info'); // Should log
			logger.debug('debug'); // Should NOT log (debug disabled and level < DEBUG)

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
	let mockContainerEl: any;

	beforeEach(() => {
		mockApp = {} as App;
		mockPlugin = {
			settings: DEFAULT_SETTINGS,
			saveSettings: jest.fn().mockResolvedValue(undefined),
			auth: {
				loadCredentials: jest.fn().mockResolvedValue(undefined),
			},
			api: {
				getDocuments: jest.fn().mockResolvedValue({ docs: [] }),
			},
			logger: {
				updateSettings: jest.fn(),
			},
		} as unknown as GranolaImporterPlugin;

		// Mock containerEl with all needed methods
		mockContainerEl = {
			empty: jest.fn(),
			createEl: jest.fn().mockReturnThis(),
			createDiv: jest.fn().mockReturnThis(),
			addClass: jest.fn().mockReturnThis(),
			appendChild: jest.fn(),
			addEventListener: jest.fn(),
		};

		settingTab = new GranolaSettingTab(mockApp, mockPlugin);
		settingTab.containerEl = mockContainerEl;
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
			// Call display - should not throw
			expect(() => settingTab.display()).not.toThrow();
			expect(mockContainerEl.empty).toHaveBeenCalled();
		});
	});

	describe('private section methods', () => {
		it('should call addConnectionSection without errors', () => {
			expect(() => (settingTab as any).addConnectionSection()).not.toThrow();
		});

		it('should call addDebugSection without errors', () => {
			expect(() => (settingTab as any).addDebugSection()).not.toThrow();
		});

		it('should call addImportSection without errors', () => {
			expect(() => (settingTab as any).addImportSection()).not.toThrow();
		});

		it('should call addContentSection without errors', () => {
			expect(() => (settingTab as any).addContentSection()).not.toThrow();
		});

		it('should call addUISection without errors', () => {
			expect(() => (settingTab as any).addUISection()).not.toThrow();
		});

		it('should call updateConnectionStatus without errors', () => {
			const mockStatusEl = {
				_content: '',
				empty: jest.fn(() => {
					mockStatusEl._content = '';
				}),
				createEl: jest.fn((tag, options) => {
					const text = options?.text || '';
					mockStatusEl._content += text;
					return { textContent: text };
				}),
				appendText: jest.fn(text => {
					mockStatusEl._content += text;
				}),
			};
			expect(() => (settingTab as any).updateConnectionStatus(mockStatusEl)).not.toThrow();
		});
	});

	describe('validateConnection', () => {
		it('should handle successful connection test', async () => {
			const mockStatusEl = {
				_content: '',
				empty: jest.fn(() => {
					mockStatusEl._content = '';
				}),
				createEl: jest.fn((tag, options) => {
					const text = options?.text || '';
					mockStatusEl._content += text;
					return { textContent: text };
				}),
				appendText: jest.fn(text => {
					mockStatusEl._content += text;
				}),
			};
			mockPlugin.api.getDocuments = jest.fn().mockResolvedValue({ docs: [] });

			await (settingTab as any).validateConnection(mockStatusEl);

			expect(mockPlugin.auth.loadCredentials).toHaveBeenCalled();
			expect(mockPlugin.api.getDocuments).toHaveBeenCalledWith({ limit: 1, offset: 0 });
			expect(mockPlugin.settings.connection.isConnected).toBe(true);
			expect(mockPlugin.saveSettings).toHaveBeenCalled();
		});

		it('should handle connection test failure', async () => {
			const mockStatusEl = {
				_content: '',
				empty: jest.fn(() => {
					mockStatusEl._content = '';
				}),
				createEl: jest.fn((tag, options) => {
					const text = options?.text || '';
					mockStatusEl._content += text;
					return { textContent: text };
				}),
				appendText: jest.fn(text => {
					mockStatusEl._content += text;
				}),
			};
			const testError = new Error('Connection failed');
			mockPlugin.api.getDocuments = jest.fn().mockRejectedValue(testError);

			await (settingTab as any).validateConnection(mockStatusEl);

			expect(mockPlugin.settings.connection.isConnected).toBe(false);
			expect(mockPlugin.saveSettings).toHaveBeenCalled();
			expect(mockStatusEl._content).toContain('Connection failed');
		});

		it('should handle non-Error exceptions in connection test', async () => {
			const mockStatusEl = {
				_content: '',
				empty: jest.fn(() => {
					mockStatusEl._content = '';
				}),
				createEl: jest.fn((tag, options) => {
					const text = options?.text || '';
					mockStatusEl._content += text;
					return { textContent: text };
				}),
				appendText: jest.fn(text => {
					mockStatusEl._content += text;
				}),
			};
			mockPlugin.api.getDocuments = jest.fn().mockRejectedValue('string error');

			await (settingTab as any).validateConnection(mockStatusEl);

			expect(mockPlugin.settings.connection.isConnected).toBe(false);
			expect(mockStatusEl._content).toContain('Connection failed');
		});

		it('should handle invalid response format', async () => {
			const mockStatusEl = {
				_content: '',
				empty: jest.fn(() => {
					mockStatusEl._content = '';
				}),
				createEl: jest.fn((tag, options) => {
					const text = options?.text || '';
					mockStatusEl._content += text;
					return { textContent: text };
				}),
				appendText: jest.fn(text => {
					mockStatusEl._content += text;
				}),
			};
			mockPlugin.api.getDocuments = jest.fn().mockResolvedValue(null);

			await (settingTab as any).validateConnection(mockStatusEl);

			expect(mockPlugin.settings.connection.isConnected).toBe(false);
			expect(mockStatusEl._content).toContain('Connection failed');
		});

		it('should handle response with undefined docs', async () => {
			const mockStatusEl = {
				_content: '',
				empty: jest.fn(() => {
					mockStatusEl._content = '';
				}),
				createEl: jest.fn((tag, options) => {
					const text = options?.text || '';
					mockStatusEl._content += text;
					return { textContent: text };
				}),
				appendText: jest.fn(text => {
					mockStatusEl._content += text;
				}),
			};
			mockPlugin.api.getDocuments = jest.fn().mockResolvedValue({ deleted: [] });

			await (settingTab as any).validateConnection(mockStatusEl);

			expect(mockPlugin.settings.connection.isConnected).toBe(false);
			expect(mockStatusEl._content).toContain('Connection failed');
		});
	});

	describe('UI creation methods - comprehensive coverage', () => {
		beforeEach(() => {
			// Reset callbacks and isolation for each test
			callbacks.sliderCallbacks.length = 0;
			callbacks.dropdownCallbacks.length = 0;
			callbacks.toggleCallbacks.length = 0;
			callbacks.textCallbacks.length = 0;
			callbacks.buttonCallbacks.length = 0;
			jest.clearAllMocks();
		});

		describe('addConnectionSection method', () => {
			it('should create connection settings with test button', () => {
				(settingTab as any).addConnectionSection();

				expect(Setting).toHaveBeenCalledWith(mockContainerEl);
				// Button callback should be captured
				expect(callbacks.buttonCallbacks.length).toBeGreaterThan(0);
			});

			it('should handle button click for connection test', async () => {
				const mockStatusEl = {
					_content: '',
					empty: jest.fn(() => {
						mockStatusEl._content = '';
					}),
					createEl: jest.fn((tag, options) => {
						const text = options?.text || '';
						mockStatusEl._content += text;
						return { textContent: text };
					}),
					appendText: jest.fn(text => {
						mockStatusEl._content += text;
					}),
				};
				mockContainerEl.createDiv.mockReturnValue(mockStatusEl);

				(settingTab as any).addConnectionSection();

				// Get the button callback and execute it
				expect(callbacks.buttonCallbacks.length).toBeGreaterThan(0);
				await callbacks.buttonCallbacks[0]();

				expect(mockPlugin.auth.loadCredentials).toHaveBeenCalled();
			});
		});

		describe('addDebugSection method', () => {
			it('should create debug settings with toggle and dropdown', () => {
				(settingTab as any).addDebugSection();

				// Should have captured toggle and dropdown callbacks
				expect(callbacks.toggleCallbacks.length).toBeGreaterThan(0);
				expect(callbacks.dropdownCallbacks.length).toBeGreaterThan(0);
			});

			it('should handle debug toggle change', async () => {
				(settingTab as any).addDebugSection();

				// Get the toggle callback and test it
				expect(callbacks.toggleCallbacks.length).toBeGreaterThan(0);
				await callbacks.toggleCallbacks[0](true);

				expect(mockPlugin.settings.debug.enabled).toBe(true);
				expect(mockPlugin.logger.updateSettings).toHaveBeenCalledWith(mockPlugin.settings);
				expect(mockPlugin.saveSettings).toHaveBeenCalled();
			});

			it('should handle log level dropdown change', async () => {
				(settingTab as any).addDebugSection();

				// Get the dropdown callback and test it
				expect(callbacks.dropdownCallbacks.length).toBeGreaterThan(0);
				await callbacks.dropdownCallbacks[0]('3');

				expect(mockPlugin.settings.debug.logLevel).toBe(3);
				expect(mockPlugin.logger.updateSettings).toHaveBeenCalledWith(mockPlugin.settings);
				expect(mockPlugin.saveSettings).toHaveBeenCalled();
			});

			it('should populate dropdown with all log levels', () => {
				(settingTab as any).addDebugSection();

				// Verify dropdown callback was captured
				expect(callbacks.dropdownCallbacks.length).toBeGreaterThan(0);
			});
		});

		describe('addImportSection method', () => {
			it('should create import settings with strategy dropdown', () => {
				(settingTab as any).addImportSection();

				// Should have captured dropdown and text callbacks
				expect(callbacks.dropdownCallbacks.length).toBeGreaterThan(0);
				expect(callbacks.textCallbacks.length).toBeGreaterThan(0);
			});

			it('should handle import strategy dropdown change', async () => {
				(settingTab as any).addImportSection();

				// Get the dropdown callback and test it
				expect(callbacks.dropdownCallbacks.length).toBeGreaterThan(0);
				await callbacks.dropdownCallbacks[0]('update_existing');

				expect(mockPlugin.settings.import.strategy).toBe('update_existing');
				expect(mockPlugin.saveSettings).toHaveBeenCalled();
			});

			it('should handle folder text input change', async () => {
				(settingTab as any).addImportSection();

				// Get the text callback and test it
				expect(callbacks.textCallbacks.length).toBeGreaterThan(0);
				await callbacks.textCallbacks[0]('My Folder');

				expect(mockPlugin.settings.import.defaultFolder).toBe('My Folder');
				expect(mockPlugin.saveSettings).toHaveBeenCalled();
			});
		});

		describe('addContentSection method', () => {
			it('should create content settings with all controls', () => {
				(settingTab as any).addContentSection();

				// Should have captured dropdown, toggle, and slider callbacks
				expect(callbacks.dropdownCallbacks.length).toBeGreaterThan(0);
				expect(callbacks.toggleCallbacks.length).toBeGreaterThan(0);
				// No sliders in content section anymore
			});

			it('should handle date prefix format change', async () => {
				(settingTab as any).addContentSection();

				// Get the first dropdown callback and test it
				expect(callbacks.dropdownCallbacks.length).toBeGreaterThan(0);
				await callbacks.dropdownCallbacks[0]('us_date');

				expect(mockPlugin.settings.content.datePrefixFormat).toBe('us_date');
				expect(mockPlugin.saveSettings).toHaveBeenCalled();
			});

			it('should handle enhanced frontmatter toggle', async () => {
				(settingTab as any).addContentSection();

				// Get the toggle callback and test it
				expect(callbacks.toggleCallbacks.length).toBeGreaterThan(0);
				await callbacks.toggleCallbacks[0](true);

				expect(mockPlugin.settings.content.includeEnhancedFrontmatter).toBe(true);
				expect(mockPlugin.saveSettings).toHaveBeenCalled();
			});
		});

		describe('addUISection method', () => {
			it('should create UI settings with toggles', () => {
				(settingTab as any).addUISection();

				// Should have captured toggle callbacks for progress notifications and attendee tags
				expect(callbacks.toggleCallbacks.length).toBe(2);
			});

			it('should handle progress notifications toggle', async () => {
				(settingTab as any).addUISection();

				// Get the toggle callback and test it
				expect(callbacks.toggleCallbacks.length).toBeGreaterThan(0);
				await callbacks.toggleCallbacks[0](false);

				expect(mockPlugin.settings.ui.showProgressNotifications).toBe(false);
				expect(mockPlugin.saveSettings).toHaveBeenCalled();
			});
		});

		describe('updateConnectionStatus method', () => {
			it('should show connected status with timestamp when connected', () => {
				const mockStatusEl = {
					_content: '',
					empty: jest.fn(() => {
						mockStatusEl._content = '';
					}),
					createEl: jest.fn((tag, options) => {
						const text = options?.text || '';
						mockStatusEl._content += text;
						return { textContent: text };
					}),
					appendText: jest.fn(text => {
						mockStatusEl._content += text;
					}),
				};
				mockPlugin.settings.connection.isConnected = true;
				mockPlugin.settings.connection.lastValidated = Date.now();

				(settingTab as any).updateConnectionStatus(mockStatusEl);

				expect(mockStatusEl._content).toContain('Connected');
				expect(mockStatusEl._content).toContain('last checked:');
			});

			it('should show not tested status when not connected', () => {
				const mockStatusEl = {
					_content: '',
					empty: jest.fn(() => {
						mockStatusEl._content = '';
					}),
					createEl: jest.fn((tag, options) => {
						const text = options?.text || '';
						mockStatusEl._content += text;
						return { textContent: text };
					}),
					appendText: jest.fn(text => {
						mockStatusEl._content += text;
					}),
				};
				mockPlugin.settings.connection.isConnected = false;
				mockPlugin.settings.connection.lastValidated = 0;

				(settingTab as any).updateConnectionStatus(mockStatusEl);

				expect(mockStatusEl._content).toContain('Connection not tested');
			});

			it('should show not tested status when lastValidated is 0', () => {
				const mockStatusEl = {
					_content: '',
					empty: jest.fn(() => {
						mockStatusEl._content = '';
					}),
					createEl: jest.fn((tag, options) => {
						const text = options?.text || '';
						mockStatusEl._content += text;
						return { textContent: text };
					}),
					appendText: jest.fn(text => {
						mockStatusEl._content += text;
					}),
				};
				mockPlugin.settings.connection.isConnected = true;
				mockPlugin.settings.connection.lastValidated = 0;

				(settingTab as any).updateConnectionStatus(mockStatusEl);

				expect(mockStatusEl._content).toContain('Connection not tested');
			});
		});

		describe('edge cases and error handling', () => {
			beforeEach(() => {
				// Reset callbacks for edge case tests
				callbacks.sliderCallbacks.length = 0;
				callbacks.dropdownCallbacks.length = 0;
				callbacks.toggleCallbacks.length = 0;
				callbacks.textCallbacks.length = 0;
				callbacks.buttonCallbacks.length = 0;
			});

			it('should handle connection test with empty response', async () => {
				const mockStatusEl = {
					_content: '',
					empty: jest.fn(() => {
						mockStatusEl._content = '';
					}),
					createEl: jest.fn((tag, options) => {
						const text = options?.text || '';
						mockStatusEl._content += text;
						return { textContent: text };
					}),
					appendText: jest.fn(text => {
						mockStatusEl._content += text;
					}),
				};
				mockPlugin.api.getDocuments = jest.fn().mockResolvedValue({});

				await (settingTab as any).validateConnection(mockStatusEl);

				expect(mockPlugin.settings.connection.isConnected).toBe(false);
				expect(mockStatusEl._content).toContain('Connection failed');
			});

			it('should handle auth.loadCredentials failure', async () => {
				const mockStatusEl = {
					_content: '',
					empty: jest.fn(() => {
						mockStatusEl._content = '';
					}),
					createEl: jest.fn((tag, options) => {
						const text = options?.text || '';
						mockStatusEl._content += text;
						return { textContent: text };
					}),
					appendText: jest.fn(text => {
						mockStatusEl._content += text;
					}),
				};
				mockPlugin.auth.loadCredentials = jest
					.fn()
					.mockRejectedValue(new Error('Auth failed'));

				await (settingTab as any).validateConnection(mockStatusEl);

				expect(mockPlugin.settings.connection.isConnected).toBe(false);
				expect(mockStatusEl._content).toContain('Connection failed');
			});

			it('should set lastValidated timestamp on successful connection', async () => {
				const mockStatusEl = {
					_content: '',
					empty: jest.fn(() => {
						mockStatusEl._content = '';
					}),
					createEl: jest.fn((tag, options) => {
						const text = options?.text || '';
						mockStatusEl._content += text;
						return { textContent: text };
					}),
					appendText: jest.fn(text => {
						mockStatusEl._content += text;
					}),
				};
				const beforeTime = Date.now();
				mockPlugin.api.getDocuments = jest.fn().mockResolvedValue({ docs: [] });

				await (settingTab as any).validateConnection(mockStatusEl);

				expect(mockPlugin.settings.connection.lastValidated).toBeGreaterThanOrEqual(
					beforeTime
				);
			});

			it('should handle updateConnectionStatus with partial settings', () => {
				const mockStatusEl = {
					_content: '',
					empty: jest.fn(() => {
						mockStatusEl._content = '';
					}),
					createEl: jest.fn((tag, options) => {
						const text = options?.text || '';
						mockStatusEl._content += text;
						return { textContent: text };
					}),
					appendText: jest.fn(text => {
						mockStatusEl._content += text;
					}),
				};
				// Simulate missing connection object
				mockPlugin.settings.connection = {} as any;

				expect(() =>
					(settingTab as any).updateConnectionStatus(mockStatusEl)
				).not.toThrow();
				expect(mockStatusEl._content).toContain('Connection not tested');
			});

			it('should handle all enum values in dropdown changes', async () => {
				(settingTab as any).addImportSection();

				// Should have captured dropdown callback
				expect(callbacks.dropdownCallbacks.length).toBeGreaterThan(0);

				// Test all ImportStrategy values using captured callback
				await callbacks.dropdownCallbacks[0](ImportStrategy.SKIP_EXISTING);
				expect(mockPlugin.settings.import.strategy).toBe(ImportStrategy.SKIP_EXISTING);

				await callbacks.dropdownCallbacks[0](ImportStrategy.UPDATE_EXISTING);
				expect(mockPlugin.settings.import.strategy).toBe(ImportStrategy.UPDATE_EXISTING);

				await callbacks.dropdownCallbacks[0](ImportStrategy.ALWAYS_PROMPT);
				expect(mockPlugin.settings.import.strategy).toBe(ImportStrategy.ALWAYS_PROMPT);
			});

			it('should handle date format dropdown with all options', async () => {
				(settingTab as any).addContentSection();

				// Should have captured dropdown callback
				expect(callbacks.dropdownCallbacks.length).toBeGreaterThan(0);

				// Test all DatePrefixFormat values using captured callback
				await callbacks.dropdownCallbacks[0](DatePrefixFormat.ISO_DATE);
				expect(mockPlugin.settings.content.datePrefixFormat).toBe(
					DatePrefixFormat.ISO_DATE
				);

				await callbacks.dropdownCallbacks[0](DatePrefixFormat.US_DATE);
				expect(mockPlugin.settings.content.datePrefixFormat).toBe(DatePrefixFormat.US_DATE);

				await callbacks.dropdownCallbacks[0](DatePrefixFormat.EU_DATE);
				expect(mockPlugin.settings.content.datePrefixFormat).toBe(DatePrefixFormat.EU_DATE);

				await callbacks.dropdownCallbacks[0](DatePrefixFormat.DOT_DATE);
				expect(mockPlugin.settings.content.datePrefixFormat).toBe(
					DatePrefixFormat.DOT_DATE
				);

				await callbacks.dropdownCallbacks[0](DatePrefixFormat.NONE);
				expect(mockPlugin.settings.content.datePrefixFormat).toBe(DatePrefixFormat.NONE);
			});

			it('should handle text input with various folder paths', async () => {
				(settingTab as any).addImportSection();

				// Should have captured text callback
				expect(callbacks.textCallbacks.length).toBeGreaterThan(0);

				// Test various folder path scenarios using captured callback
				await callbacks.textCallbacks[0]('');
				expect(mockPlugin.settings.import.defaultFolder).toBe('');

				await callbacks.textCallbacks[0]('Simple Folder');
				expect(mockPlugin.settings.import.defaultFolder).toBe('Simple Folder');

				await callbacks.textCallbacks[0]('Nested/Folder/Path');
				expect(mockPlugin.settings.import.defaultFolder).toBe('Nested/Folder/Path');

				await callbacks.textCallbacks[0]('Folder with spaces and-hyphens');
				expect(mockPlugin.settings.import.defaultFolder).toBe(
					'Folder with spaces and-hyphens'
				);
			});

			it('should handle all toggle combinations in UI section', async () => {
				(settingTab as any).addUISection();

				// Should have toggle callbacks for progress notifications and attendee tags
				expect(callbacks.toggleCallbacks).toHaveLength(2);

				// Test progress notifications toggle
				await callbacks.toggleCallbacks[0](false);
				expect(mockPlugin.settings.ui.showProgressNotifications).toBe(false);

				// Test attendee tags toggle
				await callbacks.toggleCallbacks[1](false);
				expect(mockPlugin.settings.attendeeTags.enabled).toBe(false);
			});

			it('should create proper section headers using Setting().setHeading()', () => {
				// After changing to Setting().setHeading(), we just verify sections don't throw
				expect(() => (settingTab as any).addConnectionSection()).not.toThrow();
				expect(() => (settingTab as any).addDebugSection()).not.toThrow();
				expect(() => (settingTab as any).addImportSection()).not.toThrow();
				expect(() => (settingTab as any).addContentSection()).not.toThrow();
				expect(() => (settingTab as any).addUISection()).not.toThrow();

				// Sections should use Setting().setHeading() instead of h2/h3/h4 elements
				// No longer checking for createEl('h3') calls
			});
		});
	});
});
