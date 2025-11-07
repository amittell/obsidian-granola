import { jest } from '@jest/globals';
import { DEFAULT_SETTINGS, Logger } from '../src/types';

export const mockCognitoTokens = {
	access_token:
		'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
	token_type: 'Bearer',
	expires_in: 3600, // 1 hour in seconds
	refresh_token: 'test-refresh-token',
	id_token: 'test-id-token',
};

// Legacy format for backward compatibility
export const mockCredentials = {
	access_token: mockCognitoTokens.access_token,
	token_type: 'bearer',
	expires_at: Math.floor(Date.now() / 1000) + 3600,
	refresh_token: mockCognitoTokens.refresh_token,
};

export const mockSupabaseConfig = JSON.stringify({
	cognito_tokens: JSON.stringify(mockCognitoTokens),
	user_info: JSON.stringify({
		id: 'test-user-id',
		email: 'test@example.com',
	}),
});

export const mockDocument = {
	id: 'test-doc-id',
	title: 'Test Document',
	notes: {
		type: 'doc' as const,
		content: [
			{
				type: 'paragraph',
				content: [
					{
						type: 'text',
						text: 'Test content',
					},
				],
			},
		],
	},
	notes_plain: 'Test content',
	notes_markdown: 'Test content',
	created_at: '2025-01-01T00:00:00.000Z',
	updated_at: '2025-01-01T00:00:00.000Z',
	user_id: 'test-user-id',
};

export const mockApiResponse = {
	docs: [mockDocument],
	deleted: [],
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
		stat: jest.fn().mockResolvedValue({ isFile: () => true }),
	};

	return fs;
}

export function createMockFetch(
	response: any = mockApiResponse,
	status: number = 200
): jest.MockedFunction<typeof fetch> {
	return jest.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		json: jest.fn().mockResolvedValue(response),
		text: jest.fn().mockResolvedValue(JSON.stringify(response)),
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
		formData: jest.fn(),
	} as unknown as Response) as jest.MockedFunction<typeof fetch>;
}

/**
 * Creates a mock requestUrl function for testing Obsidian API calls.
 * This matches the response structure expected by Obsidian's requestUrl function.
 */
export function createMockRequestUrl(response: any = mockApiResponse, status: number = 200) {
	return jest.fn().mockResolvedValue({
		status,
		json: response,
		text: JSON.stringify(response),
		headers: {},
		arrayBuffer: new ArrayBuffer(0),
	});
}

export function expectToThrow(fn: () => unknown, message?: string | RegExp) {
	if (message) {
		expect(fn).toThrow(message);
	} else {
		expect(fn).toThrow();
	}
}

// Helper to create expired cognito tokens
export const mockExpiredCognitoTokens = {
	...mockCognitoTokens,
	expires_in: -3600, // Expired 1 hour ago
};

// Helper to create invalid token format
export const mockInvalidTokenFormat = {
	...mockCognitoTokens,
	access_token: 'invalid.token', // Only 2 parts instead of 3
};

// Helper to create a mock logger for tests
export function createMockLogger(): Logger {
	return new Logger({
		...DEFAULT_SETTINGS,
		debug: {
			enabled: false,
			logLevel: 0, // Error only
		},
	});
}
