import { GranolaAuth } from './auth';

/**
 * Represents a document from the Granola API.
 *
 * Documents contain ProseMirror JSON content under the 'notes' field that needs to be converted
 * to Markdown format for use in Obsidian. Each document includes metadata
 * such as creation/update timestamps and a unique identifier.
 *
 * @interface GranolaDocument
 * @since 1.0.0
 */
export interface GranolaDocument {
	/** Unique identifier for the document */
	id: string;

	/** Human-readable title of the document */
	title: string;

	/** Document content in ProseMirror JSON format */
	notes: ProseMirrorDoc;

	/** Plain text version of the notes */
	notes_plain: string;

	/** Markdown version of the notes */
	notes_markdown: string;

	/** Last viewed panel containing the actual content */
	last_viewed_panel?: {
		/** Panel content in ProseMirror JSON format or HTML string */
		content?: ProseMirrorDoc | string;
		/** Additional panel metadata */
		[key: string]: unknown;
	};

	/** ISO timestamp when the document was created */
	created_at: string;

	/** ISO timestamp when the document was last updated */
	updated_at: string;

	/** User ID of the document owner */
	user_id: string;

	/** Array of meeting attendees (if available) - can be string[] or complex object */
	people?:
		| string[]
		| {
				attendees?: Array<{
					email?: string;
					details?: {
						person?: {
							name?: {
								fullName?: string;
							};
						};
					};
				}>;
				creator?: {
					name?: string;
					email?: string;
				};
				title?: string;
		  };

	/** Additional metadata fields */
	[key: string]: unknown;
}

/**
 * Root document structure for ProseMirror content.
 *
 * ProseMirror documents follow a hierarchical node structure where
 * the root document contains an array of top-level nodes (paragraphs,
 * headings, lists, etc.).
 *
 * @interface ProseMirrorDoc
 * @since 1.0.0
 * @see {@link https://prosemirror.net/docs/ref/#model.Node} ProseMirror Node Documentation
 */
export interface ProseMirrorDoc {
	/** Always 'doc' for root document nodes */
	type: 'doc';

	/** Array of top-level content nodes (paragraphs, headings, etc.) */
	content?: ProseMirrorNode[];
}

/**
 * Individual node within a ProseMirror document structure.
 *
 * Each node represents a semantic element (paragraph, heading, text, etc.)
 * and may contain attributes, child content, text content, or formatting marks.
 * The converter processes these nodes recursively to generate Markdown.
 *
 * @interface ProseMirrorNode
 * @since 1.0.0
 * @see {@link https://prosemirror.net/docs/ref/#model.Node} ProseMirror Node Documentation
 */
export interface ProseMirrorNode {
	/** Node type (paragraph, heading, text, bulletList, etc.) */
	type: string;

	/** Node-specific attributes (e.g., heading level, link href) */
	attrs?: Record<string, unknown>;

	/** Child nodes for container elements */
	content?: ProseMirrorNode[];

	/** Text content for text nodes */
	text?: string;

	/** Formatting marks applied to text (bold, italic, code, links) */
	marks?: Array<{
		/** Mark type (strong, em, code, link) */
		type: string;
		/** Mark-specific attributes (e.g., link href) */
		attrs?: Record<string, unknown>;
	}>;
}

/**
 * Request parameters for paginated document fetching.
 *
 * The Granola API supports pagination to handle large document collections.
 * These parameters control how many documents are returned and from what offset.
 *
 * @interface GetDocumentsRequest
 * @since 1.0.0
 */
export interface GetDocumentsRequest {
	/** Maximum number of documents to return (default: 100, max: 100) */
	limit?: number;

	/** Number of documents to skip for pagination (default: 0) */
	offset?: number;
}

/**
 * Response structure from the Granola API document endpoint.
 *
 * Contains the requested documents along with deleted document information.
 * Note: The API no longer uses pagination - all documents are returned in a single request.
 *
 * @interface GetDocumentsResponse
 * @since 1.0.0
 */
export interface GetDocumentsResponse {
	/** Array of active documents */
	docs: GranolaDocument[];

	/** Array of deleted document IDs */
	deleted: string[];
}

// API Configuration Constants
const DEFAULT_PAGE_SIZE = 100;
const MAX_RETRY_ATTEMPTS = 3;
const EXPONENTIAL_BACKOFF_BASE_MS = 1000;

/**
 * HTTP client for interacting with the Granola REST API.
 *
 * This class handles all communication with Granola's backend services,
 * including authentication, rate limiting, retry logic, and pagination.
 * It provides a high-level interface for fetching documents while managing
 * the complexities of API interaction.
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Rate limiting compliance (200ms between requests)
 * - Pagination handling for large document collections
 * - Comprehensive error handling and categorization
 *
 * @class GranolaAPI
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * const auth = new GranolaAuth();
 * await auth.loadCredentials();
 * const api = new GranolaAPI(auth);
 * const documents = await api.getAllDocuments();
 * ```
 */
export class GranolaAPI {
	/** Base URL for all Granola API endpoints */
	private readonly baseUrl = 'https://api.granola.ai/v2';

	/**
	 * User-Agent string for API requests identifying this plugin.
	 * Version is automatically pulled from package.json to keep it in sync.
	 */
	private readonly userAgent: string;

	/** Authentication manager for API credentials */
	private auth: GranolaAuth;

	/**
	 * Creates a new Granola API client.
	 *
	 * @param {GranolaAuth} auth - Authentication manager with loaded credentials
	 *
	 * @example
	 * ```typescript
	 * const auth = new GranolaAuth();
	 * await auth.loadCredentials();
	 * const api = new GranolaAPI(auth);
	 * ```
	 */
	constructor(auth: GranolaAuth) {
		this.auth = auth;

		// Get version from package.json, fall back to static version
		try {
			const fs = require('fs');
			const path = require('path');

			// Try the most likely path first (relative to built main.js)
			const packagePath = path.resolve(__dirname, '../package.json');

			if (fs.existsSync(packagePath)) {
				const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
				if (manifest?.name && manifest?.version) {
					this.userAgent = `${manifest.name}/${manifest.version}`;
				} else {
					throw new Error('Invalid package.json format');
				}
			} else {
				throw new Error('Package.json not found');
			}
		} catch {
			// Fallback to static version if package.json is unavailable
			this.userAgent = 'obsidian-granola-importer/1.0.0';
		}
	}

	/**
	 * Loads and validates Granola credentials.
	 * This method should be called before making any API requests.
	 *
	 * @async
	 * @returns {Promise<void>} Resolves when credentials are loaded and validated
	 * @throws {Error} If credential loading fails
	 */
	async loadCredentials(): Promise<void> {
		await this.auth.loadCredentials();
	}

	/**
	 * Fetches documents from the Granola API.
	 *
	 * Note: The Granola API now returns all documents in a single request.
	 * The limit and offset parameters are kept for backward compatibility
	 * but may not have any effect on the actual API response.
	 *
	 * @async
	 * @param {GetDocumentsRequest} options - Request options (may be ignored by API)
	 * @returns {Promise<GetDocumentsResponse>} All documents with metadata
	 * @throws {Error} If API request fails or rate limit is exceeded
	 *
	 * @example
	 * ```typescript
	 * // Fetch all documents
	 * const response = await api.getDocuments();
	 * console.log(`Found ${response.docs.length} documents`);
	 * console.log(`Deleted documents: ${response.deleted.length}`);
	 * ```
	 */
	async getDocuments(options: GetDocumentsRequest = {}): Promise<GetDocumentsResponse> {
		const { limit = DEFAULT_PAGE_SIZE, offset = 0 } = options;

		const response = await this.makeRequest('/get-documents', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.auth.getBearerToken()}`,
				'User-Agent': this.userAgent,
			},
			body: JSON.stringify({
				limit,
				offset,
				include_last_viewed_panel: true,
			}),
		});

		if (!response.ok) {
			if (response.status === 429) {
				throw new Error('Rate limit exceeded. Please try again later.');
			}
			throw new Error(`API request failed: ${response.status} ${response.statusText}`);
		}

		return await response.json();
	}

	/**
	 * Fetches all documents from the user's Granola account.
	 *
	 * The Granola API now returns all documents in a single request,
	 * so no pagination handling is required.
	 *
	 * @async
	 * @returns {Promise<GranolaDocument[]>} Array of all documents in the account
	 * @throws {Error} If the API request fails
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   const allDocuments = await api.getAllDocuments();
	 *   console.log(`Retrieved ${allDocuments.length} total documents`);
	 *
	 *   for (const doc of allDocuments) {
	 *     console.log(`Document: ${doc.title} (${doc.id})`);
	 *   }
	 * } catch (error) {
	 *   console.error('Failed to fetch documents:', error.message);
	 * }
	 * ```
	 */
	async getAllDocuments(): Promise<GranolaDocument[]> {
		const response = await this.getDocuments();

		// Handle the new API response format
		if (response.docs && Array.isArray(response.docs)) {
			return response.docs;
		} else {
			console.error('Unexpected API response format:', response);
			throw new Error('API returned unexpected response format');
		}
	}

	/**
	 * Makes an HTTP request with retry logic and exponential backoff.
	 *
	 * This method implements robust error handling including:
	 * - Up to 3 retry attempts for failed requests
	 * - Exponential backoff delays (2^attempt * 1000ms)
	 * - Special handling for rate limit (429) responses
	 * - Network error recovery
	 *
	 * @private
	 * @param {string} endpoint - API endpoint path (e.g., '/get-documents')
	 * @param {object} options - Fetch options (method, headers, body, etc.)
	 * @returns {Promise<Response>} The HTTP response object
	 * @throws {Error} If all retry attempts fail
	 *
	 * @example
	 * ```typescript
	 * const response = await this.makeRequest('/get-documents', {
	 *   method: 'POST',
	 *   headers: { 'Authorization': `Bearer ${token}` },
	 *   body: JSON.stringify({ limit: 100 })
	 * });
	 * ```
	 */
	private async makeRequest(
		endpoint: string,
		options: {
			method?: string;
			headers: Record<string, string>;
			body?: string;
		}
	): Promise<Response> {
		const url = `${this.baseUrl}${endpoint}`;

		// Retry logic with exponential backoff
		for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
			try {
				const response = await fetch(url, options);

				if (response.status === 429 && attempt < MAX_RETRY_ATTEMPTS) {
					const delay = Math.pow(2, attempt) * EXPONENTIAL_BACKOFF_BASE_MS; // Exponential backoff
					await this.sleep(delay);
					continue;
				}

				return response;
			} catch (error) {
				if (attempt === 3) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					throw new Error(
						`Network request failed after ${attempt} attempts: ${errorMessage}`
					);
				}

				const delay = Math.pow(2, attempt) * EXPONENTIAL_BACKOFF_BASE_MS;
				await this.sleep(delay);
			}
		}

		throw new Error('Maximum retry attempts exceeded');
	}

	/**
	 * Utility method to pause execution for a specified duration.
	 *
	 * Used for implementing delays between API requests to respect
	 * rate limits and for exponential backoff in retry logic.
	 *
	 * @private
	 * @param {number} ms - Number of milliseconds to sleep
	 * @returns {Promise<void>} Resolves after the specified delay
	 *
	 * @example
	 * ```typescript
	 * // Wait 200ms between paginated requests
	 * await this.sleep(200);
	 *
	 * // Exponential backoff: wait 2 seconds on second retry
	 * await this.sleep(2000);
	 * ```
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
