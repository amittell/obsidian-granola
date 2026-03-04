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
			reloadCredentials: jest.fn(),
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
				.mockResolvedValueOnce({
					status: 429,
					json: {},
					text: '',
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				})
				.mockResolvedValueOnce({
					status: 429,
					json: {},
					text: '',
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				})
				.mockResolvedValueOnce({
					status: 200,
					json: mockResponse,
					text: JSON.stringify(mockResponse),
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				});

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
				.mockResolvedValueOnce({
					status: 200,
					json: mockResponse,
					text: JSON.stringify(mockResponse),
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				});

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
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockRejectedValue(
				'string error'
			);

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
			await expect(api.getDocuments()).rejects.toThrow('API request failed: 500');

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

		it('should retry and succeed after reloading credentials from disk on 401', async () => {
			const mockResponse = { docs: [mockDocument], deleted: [] };

			(requestUrl as jest.MockedFunction<typeof requestUrl>)
				.mockResolvedValueOnce({
					status: 401,
					json: { error: 'Unauthorized' },
					text: '{"error":"Unauthorized"}',
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				})
				.mockResolvedValueOnce({
					status: 200,
					json: mockResponse,
					text: JSON.stringify(mockResponse),
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				});

			mockAuth.reloadCredentials.mockResolvedValue(undefined);
			mockAuth.getBearerToken
				.mockReturnValueOnce('expired-token')
				.mockReturnValueOnce('reloaded-token');

			const result = await api.getDocuments();

			expect(result).toEqual(mockResponse);
			expect(mockAuth.reloadCredentials).toHaveBeenCalled();
			expect(mockAuth.refreshToken).not.toHaveBeenCalled();
		});

		it('should retry and succeed after Cognito token refresh on double 401', async () => {
			const mockResponse = { docs: [mockDocument], deleted: [] };

			(requestUrl as jest.MockedFunction<typeof requestUrl>)
				.mockResolvedValueOnce({
					status: 401,
					json: { error: 'Unauthorized' },
					text: '{"error":"Unauthorized"}',
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				})
				.mockResolvedValueOnce({
					status: 401,
					json: { error: 'Unauthorized' },
					text: '{"error":"Unauthorized"}',
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				})
				.mockResolvedValueOnce({
					status: 200,
					json: mockResponse,
					text: JSON.stringify(mockResponse),
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				});

			mockAuth.reloadCredentials.mockResolvedValue(undefined);
			mockAuth.refreshToken.mockResolvedValue(undefined);
			mockAuth.getBearerToken
				.mockReturnValueOnce('expired-token')
				.mockReturnValueOnce('still-expired-token')
				.mockReturnValueOnce('fresh-token');

			const result = await api.getDocuments();

			expect(result).toEqual(mockResponse);
			expect(mockAuth.reloadCredentials).toHaveBeenCalled();
			expect(mockAuth.refreshToken).toHaveBeenCalled();
		});

		it('should throw descriptive error when both reload and refresh fail', async () => {
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 401,
				json: { error: 'Unauthorized' },
				text: '{"error":"Unauthorized"}',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			mockAuth.reloadCredentials.mockResolvedValue(undefined);
			mockAuth.refreshToken.mockRejectedValue(new Error('Cognito refresh failed'));

			await expect(api.getDocuments()).rejects.toThrow(
				'Authentication failed. Please re-open the Granola app to re-authenticate'
			);
		});

		it('should fall through to refresh even if reload throws', async () => {
			const mockResponse = { docs: [mockDocument], deleted: [] };

			// Only 2 requests: first attempt (401), then after refresh (200)
			// No second attempt after reload because reload threw
			(requestUrl as jest.MockedFunction<typeof requestUrl>)
				.mockResolvedValueOnce({
					status: 401,
					json: { error: 'Unauthorized' },
					text: '{"error":"Unauthorized"}',
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				})
				.mockResolvedValueOnce({
					status: 200,
					json: mockResponse,
					text: JSON.stringify(mockResponse),
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				});

			mockAuth.reloadCredentials.mockRejectedValue(new Error('Disk read failed'));
			mockAuth.refreshToken.mockResolvedValue(undefined);
			mockAuth.getBearerToken
				.mockReturnValueOnce('expired-token')
				.mockReturnValueOnce('fresh-token');

			const result = await api.getDocuments();

			expect(result).toEqual(mockResponse);
			expect(mockAuth.refreshToken).toHaveBeenCalled();
		});

		it('should throw descriptive error when refresh succeeds but API still returns 401', async () => {
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 401,
				json: { error: 'Unauthorized' },
				text: '{"error":"Unauthorized"}',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			mockAuth.reloadCredentials.mockResolvedValue(undefined);
			mockAuth.refreshToken.mockResolvedValue(undefined);

			await expect(api.getDocuments()).rejects.toThrow(
				'Authentication failed. Please re-open the Granola app to re-authenticate'
			);
		});

		it('should not retry on non-401 errors', async () => {
			(requestUrl as jest.MockedFunction<typeof requestUrl>).mockResolvedValue({
				status: 500,
				json: { error: 'Server error' },
				text: '{"error":"Server error"}',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			await expect(api.getDocuments()).rejects.toThrow('API request failed: 500');

			expect(mockAuth.reloadCredentials).not.toHaveBeenCalled();
			expect(mockAuth.refreshToken).not.toHaveBeenCalled();
		});

		it('should use fresh token from getBearerToken on each retry', async () => {
			const mockResponse = { docs: [mockDocument], deleted: [] };

			(requestUrl as jest.MockedFunction<typeof requestUrl>)
				.mockResolvedValueOnce({
					status: 401,
					json: { error: 'Unauthorized' },
					text: '{"error":"Unauthorized"}',
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				})
				.mockResolvedValueOnce({
					status: 200,
					json: mockResponse,
					text: JSON.stringify(mockResponse),
					headers: {},
					arrayBuffer: new ArrayBuffer(0),
				});

			mockAuth.reloadCredentials.mockResolvedValue(undefined);
			mockAuth.getBearerToken
				.mockReturnValueOnce('old-token')
				.mockReturnValueOnce('new-token');

			await api.getDocuments();

			// Verify the second request used the new token
			const calls = (requestUrl as jest.MockedFunction<typeof requestUrl>).mock.calls;
			expect(calls[0][0]).toEqual(
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: 'Bearer old-token',
					}),
				})
			);
			expect(calls[1][0]).toEqual(
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: 'Bearer new-token',
					}),
				})
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
