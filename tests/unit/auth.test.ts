import { jest } from '@jest/globals';
import { GranolaAuth } from '../../src/auth';
import {
	mockCredentials,
	mockCognitoTokens,
	mockSupabaseConfig,
	mockSupabaseConfigWorkOS,
	mockWorkOSTokens,
	mockWorkOSRefreshResponse,
	mockExpiredCognitoTokens,
	mockInvalidTokenFormat,
	createMockCognitoJwt,
	createMockWorkOSJwt,
	mockCognitoRefreshResponse,
} from '../helpers';

// Mock the fs module (synchronous version used by auth.ts)
jest.mock('fs', () => ({
	readFileSync: jest.fn(),
	writeFileSync: jest.fn(),
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
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { platform as osPlatform, homedir } from 'os';
import { join } from 'path';
import { requestUrl } from 'obsidian';

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockPlatform = osPlatform as jest.MockedFunction<typeof osPlatform>;
const mockHomedir = homedir as jest.MockedFunction<typeof homedir>;
const mockJoin = join as jest.MockedFunction<typeof join>;
const mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;

describe('GranolaAuth', () => {
	let auth: GranolaAuth;

	beforeEach(() => {
		jest.clearAllMocks();

		// Default to WorkOS config
		mockReadFileSync.mockReturnValue(mockSupabaseConfigWorkOS);
		mockPlatform.mockReturnValue('darwin');
		mockHomedir.mockReturnValue('/Users/test');
		mockJoin.mockImplementation((...args: string[]) => args.join('/'));

		auth = new GranolaAuth();
	});

	describe('loadCredentials', () => {
		it('should prefer WorkOS tokens when available', async () => {
			const credentials = await auth.loadCredentials();

			expect(credentials.access_token).toBe(mockWorkOSTokens.access_token);
			expect(credentials.refresh_token).toBe(mockWorkOSTokens.refresh_token);
			expect(credentials.token_type).toBe('bearer');
		});

		it('should fall back to Cognito tokens when WorkOS not present', async () => {
			mockReadFileSync.mockReturnValue(mockSupabaseConfig);

			const credentials = await auth.loadCredentials();

			expect(credentials.access_token).toBe(mockCognitoTokens.access_token);
			expect(credentials.refresh_token).toBe(mockCognitoTokens.refresh_token);
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
			mockReadFileSync.mockReturnValue(mockSupabaseConfig);
			const invalidConfig = {
				cognito_tokens: JSON.stringify({ access_token: 'test' }),
				user_info: '{}',
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

			await expect(auth.loadCredentials()).rejects.toThrow('Missing required field');
		});

		it('should throw error if token type is not bearer', async () => {
			mockReadFileSync.mockReturnValue(mockSupabaseConfig);
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
			mockReadFileSync.mockReturnValue(mockSupabaseConfig);
			const invalidConfig = {
				cognito_tokens: JSON.stringify(mockInvalidTokenFormat),
				user_info: '{}',
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

			await expect(auth.loadCredentials()).rejects.toThrow('Invalid token format');
		});

		it('should throw error if token is expired', async () => {
			mockReadFileSync.mockReturnValue(mockSupabaseConfig);
			const expiredConfig = {
				cognito_tokens: JSON.stringify(mockExpiredCognitoTokens),
				user_info: '{}',
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(expiredConfig));

			await expect(auth.loadCredentials()).rejects.toThrow('Access token has expired');
		});

		it('should throw error if WorkOS token format is invalid', async () => {
			const invalidWorkOS = {
				...mockWorkOSTokens,
				access_token: 'invalid.token',
			};
			const config = {
				cognito_tokens: JSON.stringify(mockCognitoTokens),
				workos_tokens: JSON.stringify(invalidWorkOS),
				user_info: '{}',
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(config));

			await expect(auth.loadCredentials()).rejects.toThrow('Invalid token format');
		});

		it('should throw error if WorkOS required fields are missing', async () => {
			const invalidWorkOS = {
				...mockWorkOSTokens,
				access_token: '',
			};
			const config = {
				cognito_tokens: JSON.stringify(mockCognitoTokens),
				workos_tokens: JSON.stringify(invalidWorkOS),
				user_info: '{}',
			};
			mockReadFileSync.mockReturnValue(JSON.stringify(config));

			await expect(auth.loadCredentials()).rejects.toThrow(
				'Missing required WorkOS token fields'
			);
		});
	});

	describe('getSupabaseConfigPath', () => {
		it('should return correct path for macOS', () => {
			mockPlatform.mockReturnValue('darwin');
			mockHomedir.mockReturnValue('/Users/test');

			(auth as any).getSupabaseConfigPath();

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

			(auth as any).getSupabaseConfigPath();

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

			(auth as any).getSupabaseConfigPath();

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

			expect(token).toBe(mockWorkOSTokens.access_token);
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
		it('should throw error when no refresh token available', async () => {
			await expect(auth.refreshToken()).rejects.toThrow('No refresh token available');
		});

		describe('WorkOS refresh', () => {
			it('should refresh via Granola refresh-access-token endpoint', async () => {
				await auth.loadCredentials();

				mockRequestUrl.mockResolvedValue({
					status: 200,
					json: mockWorkOSRefreshResponse,
					text: JSON.stringify(mockWorkOSRefreshResponse),
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				});

				await auth.refreshToken();

				expect(mockRequestUrl).toHaveBeenCalledWith(
					expect.objectContaining({
						url: 'https://api.granola.ai/v1/refresh-access-token',
						method: 'POST',
					})
				);
				expect(auth.getBearerToken()).toBe(mockWorkOSRefreshResponse.access_token);
			});

			it('should throw on non-200 response', async () => {
				await auth.loadCredentials();

				mockRequestUrl.mockResolvedValue({
					status: 401,
					json: { error: 'Invalid token' },
					text: '{"error":"Invalid token"}',
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				});

				await expect(auth.refreshToken()).rejects.toThrow(
					'Token refresh failed (401)'
				);
			});

			it('should persist refreshed tokens to disk', async () => {
				await auth.loadCredentials();

				mockRequestUrl.mockResolvedValue({
					status: 200,
					json: mockWorkOSRefreshResponse,
					text: JSON.stringify(mockWorkOSRefreshResponse),
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				});

				await auth.refreshToken();

				expect(mockWriteFileSync).toHaveBeenCalled();
				const writtenData = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
				const writtenTokens = JSON.parse(writtenData.workos_tokens);
				expect(writtenTokens.access_token).toBe(
					mockWorkOSRefreshResponse.access_token
				);
			});
		});

		describe('Cognito refresh (legacy)', () => {
			beforeEach(() => {
				mockReadFileSync.mockReturnValue(mockSupabaseConfig);
				auth = new GranolaAuth();
			});

			it('should refresh token via Cognito', async () => {
				await auth.loadCredentials();

				mockRequestUrl.mockResolvedValue({
					status: 200,
					json: mockCognitoRefreshResponse,
					text: JSON.stringify(mockCognitoRefreshResponse),
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				});

				await auth.refreshToken();

				expect(auth.getBearerToken()).toBe(
					mockCognitoRefreshResponse.AuthenticationResult.AccessToken
				);
			});

			it('should throw error when Cognito returns non-200', async () => {
				await auth.loadCredentials();

				mockRequestUrl.mockResolvedValue({
					status: 400,
					json: { error: 'Invalid grant' },
					text: '{"error":"Invalid grant"}',
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				});

				await expect(auth.refreshToken()).rejects.toThrow(
					'Cognito token refresh failed (400)'
				);
			});

			it('should throw when JWT missing Cognito claims', async () => {
				const noClaimsJwt = createMockCognitoJwt({
					iss: undefined,
					client_id: undefined,
				});
				const configWithBadJwt = JSON.stringify({
					cognito_tokens: JSON.stringify({
						...mockCognitoTokens,
						access_token: noClaimsJwt,
					}),
					user_info: '{}',
				});
				mockReadFileSync.mockReturnValue(configWithBadJwt);

				const freshAuth = new GranolaAuth();
				await freshAuth.loadCredentials();

				await expect(freshAuth.refreshToken()).rejects.toThrow(
					'JWT missing required Cognito claims'
				);
			});
		});
	});

	describe('reloadCredentials', () => {
		it('should clear cache and re-read from disk', async () => {
			await auth.loadCredentials();
			expect(mockReadFileSync).toHaveBeenCalledTimes(1);

			await auth.reloadCredentials();
			expect(mockReadFileSync).toHaveBeenCalledTimes(2);
		});

		it('should pick up new tokens from disk', async () => {
			await auth.loadCredentials();
			const oldToken = auth.getBearerToken();

			const newJwt = createMockWorkOSJwt({ sub: 'new-user' });
			const newConfig = JSON.stringify({
				cognito_tokens: JSON.stringify(mockCognitoTokens),
				workos_tokens: JSON.stringify({
					...mockWorkOSTokens,
					access_token: newJwt,
				}),
				user_info: '{}',
			});
			mockReadFileSync.mockReturnValue(newConfig);

			await auth.reloadCredentials();
			expect(auth.getBearerToken()).toBe(newJwt);
			expect(auth.getBearerToken()).not.toBe(oldToken);
		});

		it('should throw when disk read fails', async () => {
			await auth.loadCredentials();

			mockReadFileSync.mockImplementation(() => {
				throw new Error('File not found');
			});

			await expect(auth.reloadCredentials()).rejects.toThrow(
				'Cannot read Granola configuration file'
			);
		});
	});
});
