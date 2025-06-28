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
      refreshToken: jest.fn()
    } as any;

    api = new GranolaAPI(mockAuth);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create API instance with auth', () => {
      expect(api).toBeInstanceOf(GranolaAPI);
    });
  });

  describe('getDocuments', () => {
    it('should fetch documents with default parameters', async () => {
      const mockFetch = createMockFetch(mockApiResponse);
      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

      const result = await api.getDocuments();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.granola.ai/v2/get-documents',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
            'User-Agent': 'Granola/5.354.0'
          },
          body: JSON.stringify({
            limit: 100,
            offset: 0
          })
        }
      );

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
            offset: 25
          })
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
    it('should fetch all documents with pagination', async () => {
      const page1Response = {
        documents: [mockDocument],
        total_count: 2,
        has_more: true
      };
      const page2Response = {
        documents: [{ ...mockDocument, id: 'doc-2' }],
        total_count: 2,
        has_more: false
      };

      const mockFetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(page1Response as any)
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(page2Response as any)
        } as unknown as Response);

      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

      const result = await api.getAllDocuments();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(mockDocument.id);
      expect(result[1].id).toBe('doc-2');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle single page response', async () => {
      const singlePageResponse = {
        documents: [mockDocument],
        total_count: 1,
        has_more: false
      };

      const mockFetch = createMockFetch(singlePageResponse);
      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

      const result = await api.getAllDocuments();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockDocument);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle empty response', async () => {
      const emptyResponse = {
        documents: [],
        total_count: 0,
        has_more: false
      };

      const mockFetch = createMockFetch(emptyResponse);
      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

      const result = await api.getAllDocuments();

      expect(result).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should apply rate limiting between requests', async () => {
      const page1Response = {
        documents: [mockDocument],
        total_count: 2,
        has_more: true
      };
      const page2Response = {
        documents: [{ ...mockDocument, id: 'doc-2' }],
        total_count: 2,
        has_more: false
      };

      const mockFetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(page1Response as any)
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(page2Response as any)
        } as unknown as Response);

      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

      const sleepSpy = jest.spyOn(api as any, 'sleep').mockResolvedValue(undefined);

      await api.getAllDocuments();

      expect(sleepSpy).toHaveBeenCalledWith(200);
      sleepSpy.mockRestore();
    });
  });

  describe('makeRequest', () => {
    it('should make successful request on first try', async () => {
      const mockResponse = { ok: true, status: 200 };
      const mockFetch = jest.fn().mockResolvedValue(mockResponse as any);
      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

      const result = await (api as any).makeRequest('/test', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer test' }
      });

      expect(result).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.granola.ai/v2/test',
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer test' }
        }
      );
    });

    it('should retry on rate limit (429) with exponential backoff', async () => {
      const mockResponse = { ok: true, status: 200 };
      const mockFetch = jest.fn()
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce(mockResponse);

      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;
      const sleepSpy = jest.spyOn(api as any, 'sleep').mockResolvedValue(undefined);

      const result = await (api as any).makeRequest('/test', {
        method: 'GET',
        headers: {}
      });

      expect(result).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(sleepSpy).toHaveBeenCalledWith(2000); // 2^1 * 1000
      expect(sleepSpy).toHaveBeenCalledWith(4000); // 2^2 * 1000

      sleepSpy.mockRestore();
    });

    it('should return 429 response on final attempt', async () => {
      const mockResponse = { ok: false, status: 429 };
      const mockFetch = jest.fn().mockResolvedValue(mockResponse as any);
      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

      const sleepSpy = jest.spyOn(api as any, 'sleep').mockResolvedValue(undefined);

      const result = await (api as any).makeRequest('/test', {
        method: 'GET',
        headers: {}
      });

      expect(result).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      sleepSpy.mockRestore();
    });

    it('should retry on network errors', async () => {
      const networkError = new Error('Network error');
      const mockResponse = { ok: true, status: 200 };
      const mockFetch = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockResponse);

      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;
      const sleepSpy = jest.spyOn(api as any, 'sleep').mockResolvedValue(undefined);

      const result = await (api as any).makeRequest('/test', {
        method: 'GET',
        headers: {}
      });

      expect(result).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(sleepSpy).toHaveBeenCalledTimes(2);

      sleepSpy.mockRestore();
    });

    it('should throw error after max retries on network failure', async () => {
      const networkError = new Error('Network error');
      const mockFetch = jest.fn().mockRejectedValue(networkError as any);
      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

      const sleepSpy = jest.spyOn(api as any, 'sleep').mockResolvedValue(undefined);

      await expect((api as any).makeRequest('/test', {
        method: 'GET',
        headers: {}
      })).rejects.toThrow('Network request failed after 3 attempts: Network error');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      sleepSpy.mockRestore();
    });

    it('should handle non-Error exceptions', async () => {
      const mockFetch = jest.fn().mockRejectedValue('string error' as any);
      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

      const sleepSpy = jest.spyOn(api as any, 'sleep').mockResolvedValue(undefined);

      await expect((api as any).makeRequest('/test', {
        method: 'GET',
        headers: {}
      })).rejects.toThrow('Network request failed after 3 attempts: Unknown error');

      sleepSpy.mockRestore();
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      
      // Mock setTimeout to resolve immediately for testing
      const originalSetTimeout = global.setTimeout;
      const mockSetTimeout = jest.fn().mockImplementation((callback: any) => {
        callback();
        return 1;
      });
      (mockSetTimeout as any).__promisify__ = jest.fn();
      global.setTimeout = mockSetTimeout as any;

      await (api as any).sleep(100);
      
      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
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
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON') as any)
      } as unknown as Response);
      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;

      await expect(api.getDocuments()).rejects.toThrow('Invalid JSON');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete pagination workflow', async () => {
      const responses = [
        {
          documents: Array(100).fill(mockDocument).map((_, i) => ({ ...mockDocument, id: `doc-${i}` })),
          total_count: 250,
          has_more: true
        },
        {
          documents: Array(100).fill(mockDocument).map((_, i) => ({ ...mockDocument, id: `doc-${i + 100}` })),
          total_count: 250,
          has_more: true
        },
        {
          documents: Array(50).fill(mockDocument).map((_, i) => ({ ...mockDocument, id: `doc-${i + 200}` })),
          total_count: 250,
          has_more: false
        }
      ];

      const mockFetch = jest.fn();
      responses.forEach((response, index) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(response as any)
        } as unknown as Response);
      });

      global.fetch = mockFetch as unknown as jest.MockedFunction<typeof fetch>;
      const sleepSpy = jest.spyOn(api as any, 'sleep').mockResolvedValue(undefined);

      const result = await api.getAllDocuments();

      expect(result).toHaveLength(250);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(sleepSpy).toHaveBeenCalledTimes(2); // Sleep between pages, not after last

      sleepSpy.mockRestore();
    });
  });
});