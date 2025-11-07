import { jest } from '@jest/globals';
import { GranolaAuth } from '../../src/auth';
import {
	mockCredentials,
	mockCognitoTokens,
	mockSupabaseConfig,
	mockExpiredCognitoTokens,
	mockInvalidTokenFormat,
} from '../helpers';

// Mock the fs module (synchronous version used by auth.ts)
jest.mock('fs', () => ({
	readFileSync: jest.fn(),
	existsSync: jest.fn(),
}));

// Mock os module
jest.mock('os', () => ({
	platform: jest.fn(),
	homedir: jest.fn(),
}));

// Mock path module
jest.mock('path', () => ({
	join: jest.fn(),
}));

// Import the mocked modules to get the mocked functions
import { readFileSync, existsSync } from 'fs';
import { platform as osPlatform, homedir } from 'os';
import { join } from 'path';

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockPlatform = osPlatform as jest.MockedFunction<typeof osPlatform>;
const mockHomedir = homedir as jest.MockedFunction<typeof homedir>;
const mockJoin = join as jest.MockedFunction<typeof join>;

describe('GranolaAuth', () => {
	let auth: GranolaAuth;

	beforeEach(() => {
		// Clear all mocks
		jest.clearAllMocks();

		// Setup mocks with proper values
		mockReadFileSync.mockReturnValue(mockSupabaseConfig);
		mockPlatform.mockReturnValue('darwin');
		mockHomedir.mockReturnValue('/Users/test');
		mockJoin.mockImplementation((...args: string[]) => args.join('/'));

		// Create auth instance
		auth = new GranolaAuth();
	});

	describe('loadCredentials', () => {
		it('should load valid credentials successfully', async () => {
			const credentials = await auth.loadCredentials();

			expect(credentials).toEqual({
				access_token: mockCognitoTokens.access_token,
				refresh_token: mockCognitoTokens.refresh_token,
				token_type: 'bearer', // normalized to lowercase
				expires_at: expect.any(Number),
			});
		});

		it('should cache credentials on subsequent calls', async () => {
			await auth.loadCredentials();
			await auth.loadCredentials();

			expect(mockReadFileSync).toHaveBeenCalledTimes(1);
		});

		it('should throw error if config file is missing', async () => {
			mockReadFileSync.mockImplementation(() => {
				throw new Error('File not found');
			});

			await expect(auth.loadCredentials()).rejects.toThrow(
				'Cannot read Granola configuration file'
			);
		});

		it('should throw error if config file contains invalid JSON', async () => {
			mockReadFileSync.mockReturnValue('invalid json');

			await expect(auth.loadCredentials()).rejects.toThrow(
				'Failed to load Granola credentials'
			);
		});

		it('should throw error if required fields are missing', async () => {
			const invalidConfig = {
				cognito_tokens: JSON.stringify({ access_token: 'test' }), // missing other fields
				user_info: '{}',
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

			await expect(auth.loadCredentials()).rejects.toThrow('Missing required field');
		});

		it('should throw error if token type is not bearer', async () => {
			const invalidConfig = {
				cognito_tokens: JSON.stringify({
					...mockCognitoTokens,
					token_type: 'basic',
				}),
				user_info: '{}',
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

			await expect(auth.loadCredentials()).rejects.toThrow('Invalid token type');
		});

		it('should throw error if token format is invalid', async () => {
			const invalidConfig = {
				cognito_tokens: JSON.stringify(mockInvalidTokenFormat),
				user_info: '{}',
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

			await expect(auth.loadCredentials()).rejects.toThrow('Invalid token format');
		});

		it('should throw error if token is expired', async () => {
			const expiredConfig = {
				cognito_tokens: JSON.stringify(mockExpiredCognitoTokens),
				user_info: '{}',
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(expiredConfig));

			await expect(auth.loadCredentials()).rejects.toThrow('Access token has expired');
		});
	});

	describe('getSupabaseConfigPath', () => {
		it('should return correct path for macOS', () => {
			mockPlatform.mockReturnValue('darwin');
			mockHomedir.mockReturnValue('/Users/test');

			// Access the private method through any casting
			const configPath = (auth as any).getSupabaseConfigPath();

			expect(mockJoin).toHaveBeenCalledWith(
				'/Users/test',
				'Library',
				'Application Support',
				'Granola',
				'supabase.json'
			);
		});

		it('should return correct path for Windows', () => {
			mockPlatform.mockReturnValue('win32');
			mockHomedir.mockReturnValue('C:\\Users\\test');

			const configPath = (auth as any).getSupabaseConfigPath();

			expect(mockJoin).toHaveBeenCalledWith(
				'C:\\Users\\test',
				'AppData',
				'Roaming',
				'Granola',
				'supabase.json'
			);
		});

		it('should return correct path for Linux', () => {
			mockPlatform.mockReturnValue('linux');
			mockHomedir.mockReturnValue('/home/test');

			const configPath = (auth as any).getSupabaseConfigPath();

			expect(mockJoin).toHaveBeenCalledWith(
				'/home/test',
				'.config',
				'Granola',
				'supabase.json'
			);
		});

		it('should throw error for unsupported platform', () => {
			mockPlatform.mockReturnValue('freebsd');

			expect(() => (auth as any).getSupabaseConfigPath()).toThrow('Unsupported platform');
		});
	});

	describe('getBearerToken', () => {
		it('should return access token when credentials are loaded', async () => {
			await auth.loadCredentials();
			const token = auth.getBearerToken();

			expect(token).toBe(mockCredentials.access_token);
		});

		it('should throw error when credentials are not loaded', () => {
			expect(() => auth.getBearerToken()).toThrow('Credentials not loaded');
		});
	});

	describe('isTokenExpired', () => {
		it('should return false for valid token', async () => {
			await auth.loadCredentials();

			expect(auth.isTokenExpired()).toBe(false);
		});

		it('should return true when credentials are not loaded', () => {
			expect(auth.isTokenExpired()).toBe(true);
		});
	});

	describe('hasValidCredentials', () => {
		it('should return true when credentials are loaded and valid', async () => {
			await auth.loadCredentials();

			expect(auth.hasValidCredentials()).toBe(true);
		});

		it('should return false when credentials are not loaded', () => {
			expect(auth.hasValidCredentials()).toBe(false);
		});
	});

	describe('clearCredentials', () => {
		it('should clear cached credentials', async () => {
			await auth.loadCredentials();
			expect(auth.hasValidCredentials()).toBe(true);

			auth.clearCredentials();
			expect(auth.hasValidCredentials()).toBe(false);
		});
	});

	describe('refreshToken', () => {
		it('should throw error as refresh is not implemented', async () => {
			await auth.loadCredentials();

			await expect(auth.refreshToken()).rejects.toThrow('Token refresh not yet implemented');
		});

		it('should throw error when no refresh token available', async () => {
			await expect(auth.refreshToken()).rejects.toThrow('No refresh token available');
		});

		it('should clear credentials on refresh failure', async () => {
			await auth.loadCredentials();
			expect(auth.hasValidCredentials()).toBe(true);

			try {
				await auth.refreshToken();
			} catch {
				// Expected to fail
			}

			expect(auth.hasValidCredentials()).toBe(false);
		});
	});
});
