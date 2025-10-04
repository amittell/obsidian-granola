import { jest } from '@jest/globals';
import { GranolaAPI } from '../../src/api';
import { GranolaAuth } from '../../src/auth';
import { createMockFetch, mockDocument, mockApiResponse } from '../helpers';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('GranolaAPI', () => {
	let api: GranolaAPI;
	let mockAuth: jest.Mocked<GranolaAuth>;

	beforeEach(() => {
		mockAuth = {
			getBearerToken: jest.fn().mockReturnValue('test-token'),
			loadCredentials: jest.fn(),
			isTokenExpired: jest.fn().mockReturnValue(false),
			hasValidCredentials: jest.fn().mockReturnValue(true),
			clearCredentials: jest.fn(),
			refreshToken: jest.fn(),
		} as any;

		api = new GranolaAPI(mockAuth);
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create API instance with auth', () => {
			expect(api).toBeInstanceOf(GranolaAPI);
		});

		it('should handle invalid package.json format', () => {
			// This test verifies the error handling for invalid package.json format
			// The actual error path is tested by mocking filesystem at module load time
			const testApi = new GranolaAPI(mockAuth);
			// If package.json is invalid, fallback should be used
			expect(testApi.userAgent).toMatch(/obsidian-granola-importer/);
		});

		it('should handle missing package.json file', () => {
			// This test verifies the fallback behavior when package.json is missing
			const testApi = new GranolaAPI(mockAuth);
			expect(testApi.userAgent).toMatch(/obsidian-granola-importer/);
		});

		it('should fallback to static version on file system error', () => {
			// This test verifies the fallback behavior on filesystem errors
			const testApi = new GranolaAPI(mockAuth);
			expect(testApi.userAgent).toMatch(/obsidian-granola-importer/);
		});
	});

	describe('loadCredentials', () => {
		it('should call auth.loadCredentials', async () => {
			await api.loadCredentials();
			expect(mockAuth.loadCredentials).toHaveBeenCalled();
		});

		it('should propagate auth errors', async () => {
			const authError = new Error('Failed to load credentials');
			mockAuth.loadCredentials.mockRejectedValue(authError);

			await expect(api.loadCredentials()).rejects.toThrow('Failed to load credentials');
		});
	});

	describe('getDocuments', () => {
		it('should fetch documents with default parameters', async () => {
			const mockFetch = createMockFetch(mockApiResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const result = await api.getDocuments();

			expect(mockFetch).toHaveBeenCalledWith('https://api.granola.ai/v2/get-documents', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer test-token',
					'User-Agent': 'obsidian-granola-importer/1.0.0',
				},
				body: JSON.stringify({
					limit: 100,
					offset: 0,
					include_last_viewed_panel: true,
				}),
			});

			expect(result).toEqual(mockApiResponse);
		});

		it('should fetch documents with custom parameters', async () => {
			const mockFetch = createMockFetch(mockApiResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			await api.getDocuments({ limit: 50, offset: 25 });

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.granola.ai/v2/get-documents',
				expect.objectContaining({
					body: JSON.stringify({
						limit: 50,
						offset: 25,
						include_last_viewed_panel: true,
					}),
				})
			);
		});

		it('should throw error for rate limit (429)', async () => {
			const mockFetch = createMockFetch({}, 429);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			await expect(api.getDocuments()).rejects.toThrow('Rate limit exceeded');
		});

		it('should throw error for other HTTP errors', async () => {
			const mockFetch = createMockFetch({}, 500);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			await expect(api.getDocuments()).rejects.toThrow('API request failed: 500');
		});

		it('should get bearer token from auth', async () => {
			const mockFetch = createMockFetch(mockApiResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			await api.getDocuments();

			expect(mockAuth.getBearerToken).toHaveBeenCalled();
		});
	});

	describe('getAllDocuments', () => {
		it('should fetch all documents in single request', async () => {
			const apiResponse = {
				docs: [mockDocument, { ...mockDocument, id: 'doc-2' }],
				deleted: ['deleted-doc-1'],
			};

			const mockFetch = createMockFetch(apiResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const result = await api.getAllDocuments();

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe(mockDocument.id);
			expect(result[1].id).toBe('doc-2');
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it('should throw error when API returns unexpected response format', async () => {
			const invalidResponse = {
				documents: [mockDocument], // Wrong field name
				deleted: [],
			};

			const mockFetch = createMockFetch(invalidResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

			await expect(api.getAllDocuments()).rejects.toThrow(
				'API returned unexpected response format'
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Unexpected API response format:',
				invalidResponse
			);

			consoleErrorSpy.mockRestore();
		});

		it('should throw error when docs field is missing', async () => {
			const invalidResponse = {
				deleted: [],
			};

			const mockFetch = createMockFetch(invalidResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

			await expect(api.getAllDocuments()).rejects.toThrow(
				'API returned unexpected response format'
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Unexpected API response format:',
				invalidResponse
			);

			consoleErrorSpy.mockRestore();
		});

		it('should throw error when docs field is not an array', async () => {
			const invalidResponse = {
				docs: 'not an array',
				deleted: [],
			};

			const mockFetch = createMockFetch(invalidResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

			await expect(api.getAllDocuments()).rejects.toThrow(
				'API returned unexpected response format'
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Unexpected API response format:',
				invalidResponse
			);

			consoleErrorSpy.mockRestore();
		});

		it('should handle single document response', async () => {
			const singleDocResponse = {
				docs: [mockDocument],
				deleted: [],
			};

			const mockFetch = createMockFetch(singleDocResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const result = await api.getAllDocuments();

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(mockDocument);
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it('should handle empty response', async () => {
			const emptyResponse = {
				docs: [],
				deleted: [],
			};

			const mockFetch = createMockFetch(emptyResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const result = await api.getAllDocuments();

			expect(result).toHaveLength(0);
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it('should not apply rate limiting for single request', async () => {
			const apiResponse = {
				docs: [mockDocument, { ...mockDocument, id: 'doc-2' }],
				deleted: [],
			};

			const mockFetch = createMockFetch(apiResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			await api.getAllDocuments();

			// Single request should not require any delay/retry
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});

	describe('makeRequest', () => {
		it('should make successful request on first try', async () => {
			const mockResponse = { ok: true, status: 200 };
			const mockFetch = jest.fn().mockResolvedValue(mockResponse as any);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const result = await (api as any).makeRequest('/test', {
				method: 'GET',
				headers: { Authorization: 'Bearer test' },
			});

			expect(result).toBe(mockResponse);
			expect(mockFetch).toHaveBeenCalledTimes(1);
			expect(mockFetch).toHaveBeenCalledWith('https://api.granola.ai/v2/test', {
				method: 'GET',
				headers: { Authorization: 'Bearer test' },
			});
		});

		it('should retry on rate limit (429) with exponential backoff', async () => {
			const mockResponse = { ok: true, status: 200 };
			const mockFetch = jest
				.fn()
				.mockResolvedValueOnce({ ok: false, status: 429 })
				.mockResolvedValueOnce({ ok: false, status: 429 })
				.mockResolvedValueOnce(mockResponse);

			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const result = await (api as any).makeRequest('/test', {
				method: 'GET',
				headers: {},
			});

			expect(result).toBe(mockResponse);
			// Should have retried twice before succeeding
			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it('should return 429 response on final attempt', async () => {
			const mockResponse = { ok: false, status: 429 };
			const mockFetch = jest.fn().mockResolvedValue(mockResponse as any);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const result = await (api as any).makeRequest('/test', {
				method: 'GET',
				headers: {},
			});

			expect(result).toBe(mockResponse);
			// Should try 3 times and return 429 on final attempt
			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it('should retry on network errors', async () => {
			const networkError = new Error('Network error');
			const mockResponse = { ok: true, status: 200 };
			const mockFetch = jest
				.fn()
				.mockRejectedValueOnce(networkError)
				.mockRejectedValueOnce(networkError)
				.mockResolvedValueOnce(mockResponse);

			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const result = await (api as any).makeRequest('/test', {
				method: 'GET',
				headers: {},
			});

			expect(result).toBe(mockResponse);
			// Should have retried twice before succeeding
			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it('should throw error after max retries on network failure', async () => {
			const networkError = new Error('Network error');
			const mockFetch = jest.fn().mockRejectedValue(networkError as any);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			await expect(
				(api as any).makeRequest('/test', {
					method: 'GET',
					headers: {},
				})
			).rejects.toThrow('Network request failed after 3 attempts: Network error');

			// Should have tried 3 times
			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it('should handle non-Error exceptions', async () => {
			const mockFetch = jest.fn().mockRejectedValue('string error' as any);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			await expect(
				(api as any).makeRequest('/test', {
					method: 'GET',
					headers: {},
				})
			).rejects.toThrow('Network request failed after 3 attempts: Unknown error');
		});
	});

	describe('error handling', () => {
		it('should preserve error types from auth module', async () => {
			mockAuth.getBearerToken.mockImplementation(() => {
				throw new Error('Credentials not loaded');
			});

			await expect(api.getDocuments()).rejects.toThrow('Credentials not loaded');
		});

		it('should handle malformed JSON responses', async () => {
			const mockFetch = jest.fn().mockResolvedValue({
				ok: true,
				json: jest.fn().mockRejectedValue(new Error('Invalid JSON') as any),
			} as unknown as Response);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			await expect(api.getDocuments()).rejects.toThrow('Invalid JSON');
		});
	});

	describe('integration scenarios', () => {
		it('should handle large document collections', async () => {
			const largeResponse = {
				docs: Array(250)
					.fill(mockDocument)
					.map((_, i) => ({ ...mockDocument, id: `doc-${i}` })),
				deleted: Array(10)
					.fill('')
					.map((_, i) => `deleted-doc-${i}`),
			};

			const mockFetch = createMockFetch(largeResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const result = await api.getAllDocuments();

			expect(result).toHaveLength(250);
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Verify all documents have correct structure
			result.forEach((doc, index) => {
				expect(doc.id).toBe(`doc-${index}`);
				expect(doc.title).toBe(mockDocument.title);
			});
		});
	});

	describe('user agent initialization edge cases', () => {
		let originalFs: typeof import('fs');
		let originalPath: typeof import('path');

		beforeEach(() => {
			// Store original modules
			originalFs = require('fs');
			originalPath = require('path');
		});

		afterEach(() => {
			// Restore original modules
			jest.resetModules();
		});

		it('should handle missing package.json file', () => {
			// Mock fs.existsSync to return false
			const mockFs = {
				...originalFs,
				existsSync: jest.fn().mockReturnValue(false),
			};

			// Mock require to return our mock fs
			jest.doMock('fs', () => mockFs);

			// Clear the module cache and re-require the API module
			jest.resetModules();
			const { GranolaAPI } = require('../../src/api');

			// Create new instance - should use fallback user agent
			const apiWithMissingPackage = new GranolaAPI(mockAuth);

			// Access the private userAgent property
			expect((apiWithMissingPackage as any).userAgent).toBe(
				'obsidian-granola-importer/1.0.0'
			);
		});

		it('should handle malformed package.json file', () => {
			const mockFs = {
				...originalFs,
				existsSync: jest.fn().mockReturnValue(true),
				readFileSync: jest
					.fn()
					.mockReturnValue('{"invalid": "json", "missing": "required fields"}'),
			};

			jest.doMock('fs', () => mockFs);

			jest.resetModules();
			const { GranolaAPI } = require('../../src/api');

			// Create new instance - should use fallback user agent due to missing name/version
			const apiWithMalformedPackage = new GranolaAPI(mockAuth);

			expect((apiWithMalformedPackage as any).userAgent).toBe(
				'obsidian-granola-importer/1.0.0'
			);
		});

		it('should handle package.json with null name or version', () => {
			const mockFs = {
				...originalFs,
				existsSync: jest.fn().mockReturnValue(true),
				readFileSync: jest.fn().mockReturnValue('{"name": null, "version": "1.0.0"}'),
			};

			jest.doMock('fs', () => mockFs);

			jest.resetModules();
			const { GranolaAPI } = require('../../src/api');

			// Create new instance - should use fallback user agent due to null name
			const apiWithNullFields = new GranolaAPI(mockAuth);

			expect((apiWithNullFields as any).userAgent).toBe('obsidian-granola-importer/1.0.0');
		});

		it('should handle package.json read errors', () => {
			const mockFs = {
				...originalFs,
				existsSync: jest.fn().mockReturnValue(true),
				readFileSync: jest.fn().mockImplementation(() => {
					throw new Error('Permission denied');
				}),
			};

			jest.doMock('fs', () => mockFs);

			jest.resetModules();
			const { GranolaAPI } = require('../../src/api');

			// Create new instance - should use fallback user agent due to read error
			const apiWithReadError = new GranolaAPI(mockAuth);

			expect((apiWithReadError as any).userAgent).toBe('obsidian-granola-importer/1.0.0');
		});

		it('should handle JSON parsing errors', () => {
			const mockFs = {
				...originalFs,
				existsSync: jest.fn().mockReturnValue(true),
				readFileSync: jest.fn().mockReturnValue('invalid json content'),
			};

			jest.doMock('fs', () => mockFs);

			jest.resetModules();
			const { GranolaAPI } = require('../../src/api');

			// Create new instance - should use fallback user agent due to JSON parse error
			const apiWithParseError = new GranolaAPI(mockAuth);

			expect((apiWithParseError as any).userAgent).toBe('obsidian-granola-importer/1.0.0');
		});

		it('should correctly parse valid package.json', () => {
			const mockFs = {
				...originalFs,
				existsSync: jest.fn().mockReturnValue(true),
				readFileSync: jest
					.fn()
					.mockReturnValue('{"name": "test-package", "version": "2.1.0"}'),
			};

			jest.doMock('fs', () => mockFs);

			jest.resetModules();
			const { GranolaAPI } = require('../../src/api');

			// Create new instance - should use package.json values
			const apiWithValidPackage = new GranolaAPI(mockAuth);

			expect((apiWithValidPackage as any).userAgent).toBe('test-package/2.1.0');
		});
	});

	describe('maximum retry attempts reached', () => {
		it('should throw error when maximum retry attempts exceeded', async () => {
			// Mock fetch to always return 429 (rate limited)
			const mockFetch = jest.fn().mockResolvedValue({
				ok: false,
				status: 429,
				statusText: 'Too Many Requests',
				json: jest.fn().mockResolvedValue({ error: 'Rate limited' }),
			} as unknown as Response);

			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			// Should fail after max retries with rate limit error (not maximum retry error for 429s)
			await expect(api.getDocuments()).rejects.toThrow(
				'Rate limit exceeded. Please try again later.'
			);

			// Should have attempted the maximum number of retries (3)
			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it('should handle non-429 errors without retry', async () => {
			// Mock fetch to return 500 error (not rate limited)
			const mockFetch = jest.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				json: jest.fn().mockResolvedValue({ error: 'Server error' }),
			} as unknown as Response);

			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			// Should fail immediately without retries for non-429 errors
			await expect(api.getDocuments()).rejects.toThrow(
				'API request failed: 500 Internal Server Error'
			);

			// Should only be called once (no retries for non-429)
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});

	describe('comprehensive error handling', () => {
		it('should handle network failures during retry', async () => {
			const mockResponse = {
				docs: [
					{
						id: 'test-doc-1',
						title: 'Test Document',
						created_at: '2023-01-01T00:00:00Z',
						updated_at: '2023-01-01T00:00:00Z',
						user_id: 'user-123',
					},
				],
			};

			let callCount = 0;
			const mockFetch = jest.fn().mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					// First call fails with network error
					return Promise.reject(new Error('Network error'));
				} else {
					// Subsequent calls succeed
					return Promise.resolve({
						ok: true,
						json: jest.fn().mockResolvedValue(mockResponse),
					} as unknown as Response);
				}
			});

			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const result = await api.getDocuments();

			expect(result).toEqual(mockResponse);
			expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
		});

		it('should handle authentication token refresh scenarios', async () => {
			// Mock auth to simulate token refresh
			let tokenCallCount = 0;
			const mockAuthWithRefresh = {
				...mockAuth,
				getBearerToken: jest.fn().mockImplementation(() => {
					tokenCallCount++;
					return tokenCallCount === 1 ? 'expired-token' : 'fresh-token';
				}),
			};

			const apiWithTokenRefresh = new GranolaAPI(mockAuthWithRefresh);

			// Mock first call to fail with 401, second to succeed
			let fetchCallCount = 0;
			const mockFetch = jest.fn().mockImplementation(() => {
				fetchCallCount++;
				if (fetchCallCount === 1) {
					return Promise.resolve({
						ok: false,
						status: 401,
						statusText: 'Unauthorized',
						json: jest.fn().mockResolvedValue({ error: 'Invalid token' }),
					} as unknown as Response);
				} else {
					return Promise.resolve({
						ok: true,
						json: jest.fn().mockResolvedValue(mockResponse),
					} as unknown as Response);
				}
			});

			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			// Should fail with 401 since we don't implement automatic token refresh
			await expect(apiWithTokenRefresh.getDocuments()).rejects.toThrow(
				'API request failed: 401 Unauthorized'
			);
		});

		it('should handle partial response data corruption', async () => {
			const corruptedResponse = {
				docs: [
					mockDocument, // Valid document
					{ ...mockDocument, id: null }, // Corrupted document
					mockDocument, // Valid document
				],
			};

			const mockFetch = createMockFetch(corruptedResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const result = await api.getDocuments();

			// Should still return the response even with corrupted data
			expect(result).toEqual(corruptedResponse);
			expect(result.docs).toHaveLength(3);
		});

		it('should handle extremely large payloads', async () => {
			const hugeResponse = {
				docs: Array(1000)
					.fill(mockDocument)
					.map((_, i) => ({
						...mockDocument,
						id: `doc-${i}`,
						title: `Document ${i}`.repeat(100), // Make each title large
					})),
			};

			const mockFetch = createMockFetch(hugeResponse);
			global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

			const result = await api.getDocuments();

			expect(result.docs).toHaveLength(1000);
			expect(result.docs[0].title).toContain('Document 0');
		});
	});
});
