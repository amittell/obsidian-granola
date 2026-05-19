import { auth as runOAuthFlow } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
	OAuthClientProvider,
	OAuthDiscoveryState,
} from '@modelcontextprotocol/sdk/client/auth.js';
import type {
	OAuthClientInformationMixed,
	OAuthClientMetadata,
	OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { nodeFetch } from './fetch';

const MCP_SERVER_URL = 'https://mcp.granola.ai/mcp';
const REDIRECT_URL = 'obsidian://granola-auth';
const TOKEN_EXPIRY_SKEW_SECONDS = 60;
const TIMESTAMP_CONVERSION_FACTOR = 1000;

export type GranolaOAuthTokens = OAuthTokens & {
	obtained_at?: number;
	expires_at?: number;
};

export interface GranolaAuthData {
	oauthTokens?: GranolaOAuthTokens;
	oauthClientInfo?: OAuthClientInformationMixed;
	oauthCodeVerifier?: string;
	oauthDiscoveryState?: OAuthDiscoveryState;
}

export interface GranolaAuthStorage {
	getData(): Promise<(GranolaAuthData & Record<string, unknown>) | null | undefined>;
	saveData(data: GranolaAuthData & Record<string, unknown>): Promise<void>;
	openUrl?(url: string): void;
}

export interface GranolaCredentials {
	access_token: string;
	refresh_token?: string;
	token_type: string;
	expires_at?: number;
}

function createMemoryStorage(): GranolaAuthStorage {
	let data: GranolaAuthData & Record<string, unknown> = {};

	return {
		async getData() {
			return data;
		},
		async saveData(nextData) {
			data = { ...nextData };
		},
	};
}

/**
 * OAuth provider for Granola's MCP server.
 *
 * The MCP SDK owns the OAuth redirects, dynamic client registration, token exchange,
 * and refresh-token path. This class supplies Obsidian persistence and keeps the old
 * GranolaAuth methods available for the rest of the plugin.
 */
export class GranolaAuth implements OAuthClientProvider {
	private dataCache: (GranolaAuthData & Record<string, unknown>) | null = null;
	private credentials: GranolaOAuthTokens | null = null;

	constructor(private storage: GranolaAuthStorage = createMemoryStorage()) {}

	get redirectUrl(): string {
		return REDIRECT_URL;
	}

	get clientMetadata(): OAuthClientMetadata {
		return {
			client_name: 'Obsidian Granola Importer',
			redirect_uris: [REDIRECT_URL],
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'none',
		};
	}

	async loadCredentials(): Promise<GranolaCredentials> {
		const tokens = await this.tokens();

		if (!tokens?.access_token) {
			throw new Error(
				'Granola account is not connected. Start the Granola OAuth flow from the plugin settings or import command.'
			);
		}

		this.validateTokens(tokens);
		this.credentials = tokens;

		return {
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			token_type: tokens.token_type.toLowerCase(),
			expires_at: tokens.expires_at,
		};
	}

	async tokens(): Promise<GranolaOAuthTokens | undefined> {
		const data = await this.getData();
		this.credentials = data.oauthTokens ?? null;
		return data.oauthTokens;
	}

	async saveTokens(tokens: OAuthTokens): Promise<void> {
		const nowSeconds = Math.floor(Date.now() / TIMESTAMP_CONVERSION_FACTOR);
		const storedTokens: GranolaOAuthTokens = {
			...tokens,
			obtained_at: nowSeconds,
			expires_at: tokens.expires_in ? nowSeconds + tokens.expires_in : undefined,
		};

		await this.updateData(data => {
			data.oauthTokens = storedTokens;
		});
		this.credentials = storedTokens;
	}

	async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
		const data = await this.getData();
		return data.oauthClientInfo;
	}

	async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
		await this.updateData(data => {
			data.oauthClientInfo = info;
		});
	}

	async redirectToAuthorization(url: URL): Promise<void> {
		const target = url.toString();
		if (this.storage.openUrl) {
			this.storage.openUrl(target);
			return;
		}

		window.open(target);
	}

	async saveCodeVerifier(verifier: string): Promise<void> {
		await this.updateData(data => {
			data.oauthCodeVerifier = verifier;
		});
	}

	async codeVerifier(): Promise<string> {
		const data = await this.getData();
		if (!data.oauthCodeVerifier) {
			throw new Error('Missing OAuth code verifier. Please restart Granola authorization.');
		}
		return data.oauthCodeVerifier;
	}

	async saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
		await this.updateData(data => {
			data.oauthDiscoveryState = state;
		});
	}

	async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
		const data = await this.getData();
		return data.oauthDiscoveryState;
	}

	async invalidateCredentials(
		scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'
	): Promise<void> {
		await this.updateData(data => {
			if (scope === 'all' || scope === 'tokens') {
				delete data.oauthTokens;
				this.credentials = null;
			}
			if (scope === 'all' || scope === 'client') {
				delete data.oauthClientInfo;
			}
			if (scope === 'all' || scope === 'verifier') {
				delete data.oauthCodeVerifier;
			}
			if (scope === 'all' || scope === 'discovery') {
				delete data.oauthDiscoveryState;
			}
		});
	}

	getBearerToken(): string {
		if (!this.credentials?.access_token) {
			throw new Error('Credentials not loaded');
		}
		return this.credentials.access_token;
	}

	isTokenExpired(): boolean {
		if (!this.credentials?.expires_at) {
			return !this.credentials;
		}

		const expiresAt =
			(this.credentials.expires_at - TOKEN_EXPIRY_SKEW_SECONDS) * TIMESTAMP_CONVERSION_FACTOR;
		return Date.now() >= expiresAt;
	}

	async refreshToken(): Promise<void> {
		const tokens = await this.tokens();
		if (!tokens?.refresh_token) {
			throw new Error('No refresh token available');
		}

		const result = await runOAuthFlow(this, {
			serverUrl: MCP_SERVER_URL,
			fetchFn: nodeFetch,
		});

		if (result === 'REDIRECT') {
			throw new Error('Granola authorization required. Complete the browser OAuth flow.');
		}
	}

	async clearCredentials(): Promise<void> {
		this.credentials = null;
		await this.invalidateCredentials('all');
	}

	hasValidCredentials(): boolean {
		return !!this.credentials?.access_token && !this.isTokenExpired();
	}

	private validateTokens(tokens: GranolaOAuthTokens): void {
		if (!tokens.access_token) {
			throw new Error('Missing required field: access_token');
		}
		if (!tokens.token_type) {
			throw new Error('Missing required field: token_type');
		}
		if (tokens.token_type.toLowerCase() !== 'bearer') {
			throw new Error(`Invalid token type: ${tokens.token_type}`);
		}
	}

	private async getData(): Promise<GranolaAuthData & Record<string, unknown>> {
		this.dataCache = { ...((await this.storage.getData()) ?? {}) };
		return this.dataCache;
	}

	private async updateData(
		mutator: (data: GranolaAuthData & Record<string, unknown>) => void
	): Promise<void> {
		const data = { ...(await this.getData()) };
		mutator(data);
		this.dataCache = data;
		await this.storage.saveData(data);
	}
}
