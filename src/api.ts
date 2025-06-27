import { GranolaAuth } from './auth';

export interface GranolaDocument {
	id: string;
	title: string;
	content: ProseMirrorDoc;
	created_at: string;
	updated_at: string;
}

export interface ProseMirrorDoc {
	type: 'doc';
	content?: ProseMirrorNode[];
}

export interface ProseMirrorNode {
	type: string;
	attrs?: Record<string, unknown>;
	content?: ProseMirrorNode[];
	text?: string;
	marks?: Array<{
		type: string;
		attrs?: Record<string, unknown>;
	}>;
}

export interface GetDocumentsRequest {
	limit?: number;
	offset?: number;
}

export interface GetDocumentsResponse {
	documents: GranolaDocument[];
	total_count: number;
	has_more: boolean;
}

export class GranolaAPI {
	private readonly baseUrl = 'https://api.granola.ai/v2';
	private readonly userAgent = 'Granola/5.354.0';
	private auth: GranolaAuth;

	constructor(auth: GranolaAuth) {
		this.auth = auth;
	}

	async getDocuments(options: GetDocumentsRequest = {}): Promise<GetDocumentsResponse> {
		const { limit = 100, offset = 0 } = options;

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

	async getAllDocuments(): Promise<GranolaDocument[]> {
		const allDocuments: GranolaDocument[] = [];
		let offset = 0;
		const limit = 100;
		let hasMore = true;

		while (hasMore) {
			const response = await this.getDocuments({ limit, offset });

			allDocuments.push(...response.documents);

			hasMore = response.has_more;
			offset += limit;

			// Rate limiting: wait between requests
			if (hasMore) {
				await this.sleep(200); // 200ms delay
			}
		}

		return allDocuments;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private async makeRequest(endpoint: string, options: any): Promise<Response> {
		const url = `${this.baseUrl}${endpoint}`;

		// Retry logic with exponential backoff
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				const response = await fetch(url, options);

				if (response.status === 429 && attempt < 3) {
					const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
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

				const delay = Math.pow(2, attempt) * 1000;
				await this.sleep(delay);
			}
		}

		throw new Error('Maximum retry attempts exceeded');
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
