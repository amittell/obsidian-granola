import { jest } from '@jest/globals';

export const mockCredentials = {
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  token_type: 'bearer',
  expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  refresh_token: 'test-refresh-token'
};

export const mockSupabaseConfig = JSON.stringify(mockCredentials);

export const mockDocument = {
  id: 'test-doc-id',
  title: 'Test Document',
  content: {
    type: 'doc' as const,
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Test content'
          }
        ]
      }
    ]
  },
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z'
};

export const mockApiResponse = {
  documents: [mockDocument],
  nextCursor: null
};

export function createMockFs() {
  const fs = require('fs');
  
  // Mock the readFile function directly
  if (!fs.readFile) {
    fs.readFile = jest.fn();
  }
  
  // Mock sync methods
  fs.readFileSync = jest.fn().mockReturnValue(mockSupabaseConfig);
  fs.existsSync = jest.fn().mockReturnValue(true);
  
  // Mock async methods
  fs.promises = {
    readFile: jest.fn().mockResolvedValue(mockSupabaseConfig),
    access: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ isFile: () => true })
  };
  
  return fs;
}

export function createMockFetch(response: any = mockApiResponse, status: number = 200): jest.MockedFunction<typeof fetch> {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(response as any),
    text: jest.fn().mockResolvedValue(JSON.stringify(response) as any),
    headers: new Headers(),
    redirected: false,
    statusText: 'OK',
    type: 'basic' as ResponseType,
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn()
  } as unknown as Response) as jest.MockedFunction<typeof fetch>;
}

export function expectToThrow(fn: () => any, message?: string | RegExp) {
  if (message) {
    expect(fn).toThrow(message);
  } else {
    expect(fn).toThrow();
  }
}