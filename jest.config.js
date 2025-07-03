module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'jsdom',
	testEnvironmentOptions: {
		// Enhanced jsdom configuration for complex UI testing
		url: 'http://localhost:3000',
		pretendToBeVisual: true,
		resources: 'usable',
		runScripts: 'dangerously',
		// Better CSS support for style-dependent tests
		customExportConditions: ['node', 'node-addons'],
	},
	roots: ['<rootDir>/src', '<rootDir>/tests'],
	testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/*.(test|spec).+(ts|tsx|js)'],
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
				tsconfig: {
					skipLibCheck: true,
					noImplicitAny: false,
					strict: false,
					isolatedModules: true,
				},
			},
		],
	},
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
	moduleNameMapper: {
		'^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts',
		'^../performance/performance-monitor$': '<rootDir>/tests/__mocks__/performance-monitor.ts',
		'^\\.\\.?/performance/performance-monitor$':
			'<rootDir>/tests/__mocks__/performance-monitor.ts',
		'^src/performance/performance-monitor$': '<rootDir>/tests/__mocks__/performance-monitor.ts',
		'^../performance/performance-utils$': '<rootDir>/tests/__mocks__/performance-utils.ts',
		'^\\.\\.?/performance/performance-utils$': '<rootDir>/tests/__mocks__/performance-utils.ts',
		'^src/performance/performance-utils$': '<rootDir>/tests/__mocks__/performance-utils.ts',
		// Add support for CSS and other asset imports in tests
		'\\.(css|less|scss|sass)$': 'identity-obj-proxy',
		'\\.(gif|ttf|eot|svg|png)$': '<rootDir>/tests/__mocks__/file-mock.js',
	},
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'main.ts',
		'!src/**/*.d.ts',
		'!src/**/*.test.ts',
		'!src/**/*.spec.ts',
	],
	coverageThreshold: {
		global: {
			branches: 70,
			functions: 70,
			lines: 70,
			statements: 70,
		},
	},
	// Enhanced timeout for complex UI testing
	testTimeout: 15000,
	// Better error reporting for debugging
	verbose: true,
	// Improved handling of unhandled promise rejections
	detectOpenHandles: false,
	detectLeaks: false,
	// Enhanced timer mocking for UI testing
	fakeTimers: {
		enableGlobally: false, // Allow selective timer mocking
		legacyFakeTimers: false,
	},
	// Better module resolution for complex dependencies
	resolver: undefined,
	// Enhanced reporting
	reporters: [
		'default',
		[
			'jest-junit',
			{
				outputDirectory: './coverage',
				outputName: 'junit.xml',
				classNameTemplate: '{classname}',
				titleTemplate: '{title}',
				ancestorSeparator: ' › ',
				usePathForSuiteName: true,
			},
		],
	],
	// Global setup for complex testing scenarios
	globalSetup: undefined,
	globalTeardown: undefined,
	// Enhanced watch mode for development
	// watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],
};
