import { jest } from '@jest/globals';

// Mock filesystem operations
jest.mock('fs', () => ({
	readFileSync: jest.fn(),
	existsSync: jest.fn(),
	promises: {
		readFile: jest.fn(),
		access: jest.fn(),
		stat: jest.fn(),
	},
}));

// Mock OS module
jest.mock('os', () => ({
	homedir: jest.fn(() => '/mock/home'),
	platform: jest.fn(() => 'darwin'),
	type: jest.fn(() => 'Darwin'),
}));

// Mock path module
jest.mock('path', () => ({
	join: jest.fn((...args) => args.join('/')),
	resolve: jest.fn((...args) => args.join('/')),
	dirname: jest.fn(() => '/mock/dir'),
	basename: jest.fn(() => 'file.txt'),
}));

// Global test timeout
jest.setTimeout(10000);
