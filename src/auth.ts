import { Platform, requestUrl } from 'obsidian';
import { readFileSync, writeFileSync } from 'fs';
import { platform as osPlatform, homedir } from 'os';
import { join } from 'path';

// Authentication Constants
const JWT_PARTS_COUNT = 3;
const TIMESTAMP_CONVERSION_FACTOR = 1000;

/**
 * Represents the authentication credentials required for Granola API access.
 */
export interface GranolaCredentials {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_at: number;
}

/**
 * WorkOS token structure within the Granola configuration file.
 * Granola migrated from Cognito to WorkOS for authentication.
 */
export interface WorkOSTokens {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
	obtained_at: number;
	session_id: string;
	external_id: string;
}

/**
 * Legacy Cognito token structure (kept for backward compatibility).
 */
export interface CognitoTokens {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
	id_token: string;
}

/**
 * Configuration structure for the supabase.json file
 * created by the Granola desktop application.
 */
export interface SupabaseConfig {
	cognito_tokens: string;
	user_info: string;
	workos_tokens?: string;
	session_id?: string;
}

/**
 * Handles authentication and credential management for Granola API access.
 *
 * Supports both WorkOS (current) and Cognito (legacy) token formats.
 * WorkOS tokens are preferred when available.
 */
export class GranolaAuth {
	private credentials: GranolaCredentials | null = null;
	private configBasePath: string = '';
	/** Tracks which token source is in use for refresh routing */
	private tokenSource: 'workos' | 'cognito' = 'workos';

	/**
	 * Loads and validates Granola credentials from the platform-specific config file.
	 * Prefers WorkOS tokens over legacy Cognito tokens.
	 */
	async loadCredentials(): Promise<GranolaCredentials> {
		if (this.credentials) {
			return this.credentials;
		}

		if (Platform.isMobile) {
			throw new Error(
				'Granola Importer is not supported on mobile devices. ' +
					'Granola is a desktop application and credentials are only available on desktop platforms.'
			);
		}

		const configPath = this.getSupabaseConfigPath();

		try {
			const configData = await this.readConfigFile(configPath);
			const config: SupabaseConfig = JSON.parse(configData);

			// Prefer WorkOS tokens (current auth system)
			if (config.workos_tokens) {
				return this.loadWorkOSTokens(config);
			}

			// Fall back to Cognito tokens (legacy)
			return this.loadCognitoTokens(config);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to load Granola credentials: ${errorMessage}`);
		}
	}

	/**
	 * Loads credentials from WorkOS tokens.
	 */
	private loadWorkOSTokens(config: SupabaseConfig): GranolaCredentials {
		const tokens: WorkOSTokens = JSON.parse(config.workos_tokens as string);

		if (!tokens.access_token || !tokens.refresh_token) {
			throw new Error('Missing required WorkOS token fields');
		}

		// Validate JWT format
		const tokenParts = tokens.access_token.split('.');
		if (tokenParts.length !== JWT_PARTS_COUNT || tokenParts.some(part => part.length === 0)) {
			throw new Error('Invalid token format');
		}

		// Calculate expiry: obtained_at (ms) + expires_in (seconds)
		const obtainedAtMs = tokens.obtained_at || Date.now();
		const expiresAt =
			Math.floor(obtainedAtMs / TIMESTAMP_CONVERSION_FACTOR) + tokens.expires_in;

		this.tokenSource = 'workos';
		this.credentials = {
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			token_type: (tokens.token_type || 'bearer').toLowerCase(),
			expires_at: expiresAt,
		};

		return this.credentials;
	}

	/**
	 * Loads credentials from legacy Cognito tokens.
	 */
	private loadCognitoTokens(config: SupabaseConfig): GranolaCredentials {
		const cognitoTokens: CognitoTokens = JSON.parse(config.cognito_tokens);

		this.validateCognitoCredentials(cognitoTokens);

		const expiresAt =
			Math.floor(Date.now() / TIMESTAMP_CONVERSION_FACTOR) + cognitoTokens.expires_in;

		this.tokenSource = 'cognito';
		this.credentials = {
			access_token: cognitoTokens.access_token,
			refresh_token: cognitoTokens.refresh_token,
			token_type: cognitoTokens.token_type.toLowerCase(),
			expires_at: expiresAt,
		};

		return this.credentials;
	}

	private async readConfigFile(path: string): Promise<string> {
		try {
			return readFileSync(path, 'utf-8');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(
				`Cannot read Granola configuration file at ${path}. ` +
					'Please ensure Granola is installed and you are logged in. ' +
					`Error: ${errorMessage}`
			);
		}
	}

	private getSupabaseConfigPath(): string {
		const platformType = osPlatform();
		const homeDir = homedir();

		switch (platformType) {
			case 'darwin':
				return join(homeDir, 'Library', 'Application Support', 'Granola', 'supabase.json');
			case 'win32':
				return join(homeDir, 'AppData', 'Roaming', 'Granola', 'supabase.json');
			case 'linux':
				return join(homeDir, '.config', 'Granola', 'supabase.json');
			default:
				throw new Error(`Unsupported platform: ${platformType}`);
		}
	}

	/**
	 * Validates legacy Cognito token structure.
	 */
	private validateCognitoCredentials(tokens: CognitoTokens): void {
		const required: (keyof CognitoTokens)[] = [
			'access_token',
			'refresh_token',
			'token_type',
			'expires_in',
		];

		for (const field of required) {
			if (!tokens[field]) {
				throw new Error(`Missing required field: ${field}`);
			}
		}

		if (tokens.token_type.toLowerCase() !== 'bearer') {
			throw new Error(`Invalid token type: ${tokens.token_type}`);
		}

		const tokenParts = tokens.access_token.split('.');
		if (tokenParts.length !== JWT_PARTS_COUNT || tokenParts.some(part => part.length === 0)) {
			throw new Error('Invalid token format');
		}

		if (tokens.expires_in <= 0) {
			throw new Error('Access token has expired');
		}
	}

	getBearerToken(): string {
		if (!this.credentials) {
			throw new Error('Credentials not loaded');
		}

		return this.credentials.access_token;
	}

	isTokenExpired(): boolean {
		if (!this.credentials) {
			return true;
		}

		return Date.now() > this.credentials.expires_at * TIMESTAMP_CONVERSION_FACTOR;
	}

	/**
	 * Clears cached credentials and re-reads them from disk.
	 */
	async reloadCredentials(): Promise<GranolaCredentials> {
		this.credentials = null;
		return this.loadCredentials();
	}

	/**
	 * Refreshes an expired access token.
	 * Routes to the appropriate refresh mechanism based on token source.
	 */
	async refreshToken(): Promise<void> {
		if (!this.credentials?.refresh_token) {
			throw new Error('No refresh token available');
		}

		if (this.tokenSource === 'workos') {
			await this.refreshWorkOSToken();
		} else {
			await this.refreshCognitoToken();
		}
	}

	/**
	 * Refreshes a WorkOS token via Granola's refresh-access-token endpoint.
	 */
	private async refreshWorkOSToken(): Promise<void> {
		const creds = this.credentials as GranolaCredentials;

		const response = await requestUrl({
			url: 'https://api.granola.ai/v1/refresh-access-token',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${creds.access_token}`,
			},
			body: JSON.stringify({
				refresh_token: creds.refresh_token,
			}),
			throw: false,
		});

		if (response.status !== 200) {
			throw new Error(
				`Token refresh failed (${response.status}). Please re-open the Granola app to re-authenticate.`
			);
		}

		const result = response.json;

		if (!result?.access_token) {
			throw new Error('Refresh response missing access_token');
		}

		this.credentials = {
			access_token: result.access_token,
			refresh_token: result.refresh_token || creds.refresh_token,
			token_type: (result.token_type || 'bearer').toLowerCase(),
			expires_at:
				Math.floor(Date.now() / TIMESTAMP_CONVERSION_FACTOR) +
				(result.expires_in || 3600),
		};

		this.persistWorkOSTokensToDisk(result);
	}

	/**
	 * Refreshes a legacy Cognito token via AWS Cognito InitiateAuth.
	 */
	private async refreshCognitoToken(): Promise<void> {
		const creds = this.credentials as GranolaCredentials;
		const { iss, client_id } = this.parseAccessTokenClaims(creds.access_token);

		const regionMatch = iss.match(/cognito-idp\.([^.]+)\.amazonaws\.com/);
		if (!regionMatch) {
			throw new Error('Cannot extract region from Cognito issuer URL');
		}
		const region = regionMatch[1];

		const response = await requestUrl({
			url: `https://cognito-idp.${region}.amazonaws.com/`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-amz-json-1.1',
				'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
			},
			body: JSON.stringify({
				AuthFlow: 'REFRESH_TOKEN_AUTH',
				ClientId: client_id,
				AuthParameters: {
					REFRESH_TOKEN: creds.refresh_token,
				},
			}),
			throw: false,
		});

		if (response.status !== 200) {
			throw new Error(
				`Cognito token refresh failed (${response.status}). Please re-open the Granola app to re-authenticate.`
			);
		}

		const result = response.json;
		const authResult = result.AuthenticationResult;

		if (!authResult?.AccessToken) {
			throw new Error('Cognito refresh response missing AccessToken');
		}

		this.credentials = {
			...creds,
			access_token: authResult.AccessToken,
			expires_at:
				Math.floor(Date.now() / TIMESTAMP_CONVERSION_FACTOR) +
				(authResult.ExpiresIn || 3600),
		};

		this.persistCognitoTokensToDisk(authResult);
	}

	private parseAccessTokenClaims(token: string): { iss: string; client_id: string } {
		const parts = token.split('.');
		if (parts.length !== JWT_PARTS_COUNT) {
			throw new Error('Invalid JWT format');
		}

		const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));

		if (!payload.iss || !payload.client_id) {
			throw new Error('JWT missing required Cognito claims (iss, client_id)');
		}

		return { iss: payload.iss as string, client_id: payload.client_id as string };
	}

	private persistWorkOSTokensToDisk(result: Record<string, unknown>): void {
		try {
			const configPath = this.getSupabaseConfigPath();
			const configData = readFileSync(configPath, 'utf-8');
			const config: SupabaseConfig = JSON.parse(configData);

			const workosTokens: WorkOSTokens = config.workos_tokens
				? JSON.parse(config.workos_tokens)
				: ({} as WorkOSTokens);

			workosTokens.access_token = result.access_token as string;
			workosTokens.expires_in = (result.expires_in as number) || 3600;
			workosTokens.obtained_at = Date.now();
			if (result.refresh_token) {
				workosTokens.refresh_token = result.refresh_token as string;
			}

			config.workos_tokens = JSON.stringify(workosTokens);
			writeFileSync(configPath, JSON.stringify(config), 'utf-8');
		} catch {
			console.warn('Failed to persist refreshed tokens to disk');
		}
	}

	private persistCognitoTokensToDisk(authResult: Record<string, unknown>): void {
		try {
			const configPath = this.getSupabaseConfigPath();
			const configData = readFileSync(configPath, 'utf-8');
			const config: SupabaseConfig = JSON.parse(configData);
			const cognitoTokens: CognitoTokens = JSON.parse(config.cognito_tokens);

			cognitoTokens.access_token = authResult.AccessToken as string;
			cognitoTokens.expires_in = (authResult.ExpiresIn as number) || 3600;
			if (authResult.IdToken) {
				cognitoTokens.id_token = authResult.IdToken as string;
			}

			config.cognito_tokens = JSON.stringify(cognitoTokens);
			writeFileSync(configPath, JSON.stringify(config), 'utf-8');
		} catch {
			console.warn('Failed to persist refreshed tokens to disk');
		}
	}

	clearCredentials(): void {
		this.credentials = null;
	}

	hasValidCredentials(): boolean {
		return this.credentials !== null && !this.isTokenExpired();
	}
}
