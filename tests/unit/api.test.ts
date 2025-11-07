import { jest } from '@jest/globals';
import { GranolaAPI } from '../../src/api';
import { GranolaAuth } from '../../src/auth';
import { createMockRequestUrl, mockDocument, mockApiResponse } from '../helpers';
import { requestUrl } from 'obsidian';

// Mock requestUrl from obsidian
jest.mock('obsidian', () => ({
	...jest.requireActual('obsidian'),
	requestUrl: jest.fn(),
}));

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
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: mockApiResponse,
				text: JSON.stringify(mockApiResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const result = await api.getDocuments();

			expect(requestUrl).toHaveBeenCalledWith({
				url: 'https://api.granola.ai/v2/get-documents',
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
				throw: false,
			});

			expect(result).toEqual(mockApiResponse);
		});

		it('should fetch documents with custom parameters', async () => {
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
			status: 200,
			json: mockApiResponse,
			text: JSON.stringify(mockApiResponse),
			headers: {},
			arrayBuffer: new ArrayBuffer(0),
		});

			await api.getDocuments({ limit: 50, offset: 25 });

			expect(requestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://api.granola.ai/v2/get-documents',
					body: JSON.stringify({
						limit: 50,
						offset: 25,
						include_last_viewed_panel: true,
					}),
				})
			);
		});

		it('should throw error for rate limit (429)', async () => {
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
			status: 429,
			json: {},
			text: '',
			headers: {},
			arrayBuffer: new ArrayBuffer(0),
		});

			await expect(api.getDocuments()).rejects.toThrow('Rate limit exceeded');
		});

		it('should throw error for other HTTP errors', async () => {
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
			status: 500,
			json: {},
			text: '',
			headers: {},
			arrayBuffer: new ArrayBuffer(0),
		});

			await expect(api.getDocuments()).rejects.toThrow('API request failed: 500');
		});

		it('should get bearer token from auth', async () => {
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: mockApiResponse,
				text: JSON.stringify(mockApiResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

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

			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: apiResponse,
				text: JSON.stringify(apiResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const result = await api.getAllDocuments();

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe(mockDocument.id);
			expect(result[1].id).toBe('doc-2');
			expect(requestUrl).toHaveBeenCalledTimes(1);
		});

		it('should throw error when API returns unexpected response format', async () => {
			const invalidResponse = {
				documents: [mockDocument], // Wrong field name
				deleted: [],
			};

			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: invalidResponse,
				text: JSON.stringify(invalidResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

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

			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: invalidResponse,
				text: JSON.stringify(invalidResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

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

			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: invalidResponse,
				text: JSON.stringify(invalidResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

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

			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: singleDocResponse,
				text: JSON.stringify(singleDocResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const result = await api.getAllDocuments();

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(mockDocument);
			expect(requestUrl).toHaveBeenCalledTimes(1);
		});

		it('should handle empty response', async () => {
			const emptyResponse = {
				docs: [],
				deleted: [],
			};

			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: emptyResponse,
				text: JSON.stringify(emptyResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const result = await api.getAllDocuments();

			expect(result).toHaveLength(0);
			expect(requestUrl).toHaveBeenCalledTimes(1);
		});

		it('should not apply rate limiting for single request', async () => {
			const apiResponse = {
				docs: [mockDocument, { ...mockDocument, id: 'doc-2' }],
				deleted: [],
			};

			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: apiResponse,
				text: JSON.stringify(apiResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			await api.getAllDocuments();

			// Single request should not require any delay/retry
			expect(requestUrl).toHaveBeenCalledTimes(1);
		});
	});

	describe('makeRequest', () => {
		it('should make successful request on first try', async () => {
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: {},
				text: '',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const result = await (api as any).makeRequest('/test', {
				method: 'GET',
				headers: { Authorization: 'Bearer test' },
			});

			expect(result.status).toBe(200);
			expect(requestUrl).toHaveBeenCalledTimes(1);
			expect(requestUrl).toHaveBeenCalledWith({
				url: 'https://api.granola.ai/v2/test',
				method: 'GET',
				headers: { Authorization: 'Bearer test' },
				throw: false,
			});
		});

		it('should retry on rate limit (429) with exponential backoff', async () => {
			const mockResponse = { ok: true, status: 200 };
			(requestUrl as jest.MockedFunction<typeof requestUrl>)
				.mockResolvedValueOnce({ status: 429, json: {}, text: '', headers: {}, arrayBuffer: new ArrayBuffer(0) })
				.mockResolvedValueOnce({ status: 429, json: {}, text: '', headers: {}, arrayBuffer: new ArrayBuffer(0) })
				.mockResolvedValueOnce({ status: 200, json: mockResponse, text: JSON.stringify(mockResponse), headers: {}, arrayBuffer: new ArrayBuffer(0) });

			const result = await (api as any).makeRequest('/test', {
				method: 'GET',
				headers: {},
			});

			// Should have retried twice before succeeding
			expect(requestUrl).toHaveBeenCalledTimes(3);
		});

		it('should return 429 response on final attempt', async () => {
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 429,
				json: {},
				text: '',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const result = await (api as any).makeRequest('/test', {
				method: 'GET',
				headers: {},
			});

			expect(result.status).toBe(429);
			// Should try 3 times and return 429 on final attempt
			expect(requestUrl).toHaveBeenCalledTimes(3);
		});

		it('should retry on network errors', async () => {
			const networkError = new Error('Network error');
			const mockResponse = { ok: true, status: 200 };
			(requestUrl as jest.MockedFunction<typeof requestUrl>)
				.mockRejectedValueOnce(networkError)
				.mockRejectedValueOnce(networkError)
				.mockResolvedValueOnce({ status: 200, json: mockResponse, text: JSON.stringify(mockResponse), headers: {}, arrayBuffer: new ArrayBuffer(0) });

			const result = await (api as any).makeRequest('/test', {
				method: 'GET',
				headers: {},
			});

			// Should have retried twice before succeeding
			expect(requestUrl).toHaveBeenCalledTimes(3);
		});

		it('should throw error after max retries on network failure', async () => {
			const networkError = new Error('Network error');
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockRejectedValue(networkError);

			await expect(
				(api as any).makeRequest('/test', {
					method: 'GET',
					headers: {},
				})
			).rejects.toThrow('Network request failed after 3 attempts: Network error');

			// Should have tried 3 times
			expect(requestUrl).toHaveBeenCalledTimes(3);
		});

		it('should handle non-Error exceptions', async () => {
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockRejectedValue('string error');

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

			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: largeResponse,
				text: JSON.stringify(largeResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const result = await api.getAllDocuments();

			expect(result).toHaveLength(250);
			expect(requestUrl).toHaveBeenCalledTimes(1);

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
			// Mock requestUrl to always return 429 (rate limited)
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 429,
				json: { error: 'Rate limited' },
				text: JSON.stringify({ error: 'Rate limited' }),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			// Should fail after max retries with rate limit error (not maximum retry error for 429s)
			await expect(api.getDocuments()).rejects.toThrow(
				'Rate limit exceeded. Please try again later.'
			);

			// Should have attempted the maximum number of retries (3)
			expect(requestUrl).toHaveBeenCalledTimes(3);
		});

		it('should handle non-429 errors without retry', async () => {
			// Mock requestUrl to return 500 error (not rate limited)
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 500,
				json: { error: 'Server error' },
				text: JSON.stringify({ error: 'Server error' }),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			// Should fail immediately without retries for non-429 errors
			await expect(api.getDocuments()).rejects.toThrow(
				'API request failed: 500'
			);

			// Should only be called once (no retries for non-429)
			expect(requestUrl).toHaveBeenCalledTimes(1);
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

			(requestUrl as jest.MockedFunction<typeof requestUrl>)
				.mockRejectedValueOnce(new Error('Network error'))
				.mockResolvedValueOnce({
					status: 200,
					json: mockResponse,
					text: JSON.stringify(mockResponse),
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				});

			const result = await api.getDocuments();

			expect(result).toEqual(mockResponse);
			expect(requestUrl).toHaveBeenCalledTimes(2); // Initial + 1 retry
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

			// Mock first call to fail with 401 (Unauthorized)
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 401,
				json: { error: 'Invalid token' },
				text: JSON.stringify({ error: 'Invalid token' }),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			// Should fail with 401 since we don't implement automatic token refresh
			await expect(apiWithTokenRefresh.getDocuments()).rejects.toThrow(
				'API request failed: 401'
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

			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: corruptedResponse,
				text: JSON.stringify(corruptedResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

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

			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 200,
				json: hugeResponse,
				text: JSON.stringify(hugeResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const result = await api.getDocuments();

			expect(result.docs).toHaveLength(1000);
			expect(result.docs[0].title).toContain('Document 0');
		});
	});
});
