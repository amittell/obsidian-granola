import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir, platform } from 'os';

// Authentication Constants
const JWT_PARTS_COUNT = 3;
const TIMESTAMP_CONVERSION_FACTOR = 1000;

/**
 * Represents the authentication credentials required for Granola API access.
 *
 * These credentials are typically obtained through the Granola desktop application's
 * OAuth flow and stored in a platform-specific configuration file.
 *
 * @interface GranolaCredentials
 * @since 1.0.0
 */
export interface GranolaCredentials {
	/**
	 * JWT access token for API authentication.
	 * Used as Bearer token in Authorization headers.
	 */
	access_token: string;

	/**
	 * Token used to refresh expired access tokens.
	 * Currently stored but refresh functionality is not implemented.
	 */
	refresh_token: string;

	/**
	 * Type of token, typically "bearer" for OAuth 2.0.
	 * Must match expected token type for validation.
	 */
	token_type: string;

	/**
	 * Unix timestamp indicating when the access token expires.
	 * Used to determine if token refresh is needed.
	 */
	expires_at: number;
}

/**
 * Configuration structure for Supabase authentication data.
 *
 * This interface mirrors the structure of the supabase.json file
 * created by the Granola desktop application. The file contains
 * OAuth tokens and metadata required for API access.
 *
 * @interface SupabaseConfig
 * @since 1.0.0
 */
export interface SupabaseConfig {
	/** JWT access token from Granola OAuth flow */
	access_token: string;

	/** Refresh token for token renewal (not yet implemented) */
	refresh_token: string;

	/** OAuth token type, expected to be "bearer" */
	token_type: string;

	/** Unix timestamp of token expiration */
	expires_at: number;
}

/**
 * Handles authentication and credential management for Granola API access.
 *
 * This class is responsible for:
 * - Loading credentials from platform-specific configuration files
 * - Validating token format and expiration
 * - Providing bearer tokens for API requests
 * - Managing token lifecycle (future: refresh capability)
 *
 * The authentication flow relies on the Granola desktop application
 * to handle OAuth and store credentials in the appropriate location.
 *
 * @class GranolaAuth
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * const auth = new GranolaAuth();
 * await auth.loadCredentials();
 * const token = auth.getBearerToken();
 * ```
 */
export class GranolaAuth {
	/**
	 * Cached credentials loaded from the configuration file.
	 * Null until credentials are successfully loaded and validated.
	 * @private
	 */
	private credentials: GranolaCredentials | null = null;

	/**
	 * Loads and validates Granola credentials from the platform-specific config file.
	 *
	 * This method locates the supabase.json file created by the Granola desktop app,
	 * reads the credential data, validates the token format and expiration,
	 * and caches the credentials for subsequent API requests.
	 *
	 * @async
	 * @returns {Promise<GranolaCredentials>} The validated credentials
	 * @throws {Error} If credentials file is missing, malformed, or contains invalid data
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   const credentials = await auth.loadCredentials();
	 *   console.log('Credentials loaded successfully');
	 * } catch (error) {
	 *   console.error('Failed to load credentials:', error.message);
	 * }
	 * ```
	 */
	async loadCredentials(): Promise<GranolaCredentials> {
		if (this.credentials) {
			return this.credentials;
		}

		const configPath = this.getSupabaseConfigPath();

		try {
			const configData = await readFile(configPath, 'utf-8');
			const config: SupabaseConfig = JSON.parse(configData);

			this.validateCredentials(config);

			this.credentials = {
				access_token: config.access_token,
				refresh_token: config.refresh_token,
				token_type: config.token_type,
				expires_at: config.expires_at,
			};

			return this.credentials;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to load Granola credentials: ${errorMessage}`);
		}
	}

	/**
	 * Determines the platform-specific path to the Granola configuration file.
	 *
	 * The Granola desktop application stores OAuth credentials in different
	 * locations depending on the operating system:
	 * - macOS: ~/Library/Application Support/Granola/supabase.json
	 * - Windows: %APPDATA%/Granola/supabase.json
	 * - Linux: ~/.config/Granola/supabase.json
	 *
	 * @private
	 * @returns {string} The absolute path to the configuration file
	 * @throws {Error} If the current platform is not supported
	 *
	 * @example
	 * ```typescript
	 * const configPath = this.getSupabaseConfigPath();
	 * // Returns: "/home/user/.config/Granola/supabase.json" on Linux
	 * ```
	 */
	private getSupabaseConfigPath(): string {
		const os = platform();
		const home = homedir();

		switch (os) {
			case 'darwin': // macOS
				return join(home, 'Library', 'Application Support', 'Granola', 'supabase.json');
			case 'win32': // Windows
				return join(home, 'AppData', 'Roaming', 'Granola', 'supabase.json');
			case 'linux': // Linux
				return join(home, '.config', 'Granola', 'supabase.json');
			default:
				throw new Error(`Unsupported platform: ${os}`);
		}
	}

	/**
	 * Validates the structure and content of loaded credentials.
	 *
	 * Performs comprehensive validation including:
	 * - Required field presence check
	 * - Token type verification (must be "bearer")
	 * - JWT token format validation using regex
	 * - Token expiration check against current time
	 *
	 * @private
	 * @param {SupabaseConfig} config - The configuration object to validate
	 * @throws {Error} If any validation check fails
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   this.validateCredentials(config);
	 *   console.log('Credentials are valid');
	 * } catch (error) {
	 *   console.error('Invalid credentials:', error.message);
	 * }
	 * ```
	 */
	private validateCredentials(config: SupabaseConfig): void {
		const required: (keyof SupabaseConfig)[] = [
			'access_token',
			'refresh_token',
			'token_type',
			'expires_at',
		];

		for (const field of required) {
			if (!config[field]) {
				throw new Error(`Missing required field: ${field}`);
			}
		}

		if (config.token_type !== 'bearer') {
			throw new Error(`Invalid token type: ${config.token_type}`);
		}

		// Enhanced JWT format validation - should have exactly 3 non-empty parts
		const tokenParts = config.access_token.split('.');
		if (tokenParts.length !== JWT_PARTS_COUNT || tokenParts.some(part => part.length === 0)) {
			throw new Error('Invalid token format');
		}

		if (Date.now() > config.expires_at * TIMESTAMP_CONVERSION_FACTOR) {
			throw new Error('Access token has expired');
		}
	}

	/**
	 * Retrieves the access token for use in API Authorization headers.
	 *
	 * This method returns the raw JWT access token that should be used
	 * with the "Bearer" authentication scheme in HTTP requests.
	 *
	 * @returns {string} The JWT access token
	 * @throws {Error} If credentials have not been loaded
	 *
	 * @example
	 * ```typescript
	 * const token = auth.getBearerToken();
	 * const headers = {
	 *   'Authorization': `Bearer ${token}`,
	 *   'Content-Type': 'application/json'
	 * };
	 * ```
	 */
	getBearerToken(): string {
		if (!this.credentials) {
			throw new Error('Credentials not loaded');
		}

		return this.credentials.access_token;
	}

	/**
	 * Checks if the current access token has expired.
	 *
	 * Compares the token's expiration timestamp against the current time
	 * to determine if the token needs to be refreshed before making API calls.
	 *
	 * @returns {boolean} True if token is expired or not loaded, false if valid
	 *
	 * @example
	 * ```typescript
	 * if (auth.isTokenExpired()) {
	 *   console.log('Token needs refresh');
	 *   // In future: await auth.refreshToken();
	 * }
	 * ```
	 */
	isTokenExpired(): boolean {
		if (!this.credentials) {
			return true;
		}

		return Date.now() > this.credentials.expires_at * TIMESTAMP_CONVERSION_FACTOR;
	}

	/**
	 * Refreshes an expired access token using the stored refresh token.
	 *
	 * @deprecated This method is not yet implemented. Users must re-authenticate
	 * through the Granola desktop application when tokens expire.
	 *
	 * Future implementation will use the refresh_token to obtain new credentials
	 * from the Granola API without requiring user intervention.
	 *
	 * @async
	 * @returns {Promise<void>} Resolves when token refresh completes
	 * @throws {Error} Currently always throws as refresh is not implemented
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   await auth.refreshToken();
	 * } catch (error) {
	 *   console.log('Refresh not available, please re-authenticate');
	 * }
	 * ```
	 */
	async refreshToken(): Promise<void> {
		if (!this.credentials?.refresh_token) {
			throw new Error('No refresh token available');
		}

		try {
			// Note: This would require implementing the actual refresh endpoint
			// For now, we'll throw an informative error directing users to re-authenticate
			throw new Error(
				'Token refresh not yet implemented. Please re-authenticate in the Granola app.'
			);

			// Future implementation would look like:
			// const response = await fetch('https://api.granola.ai/auth/refresh', {
			//     method: 'POST',
			//     headers: { 'Content-Type': 'application/json' },
			//     body: JSON.stringify({ refresh_token: this.credentials.refresh_token })
			// });
			// const newTokens = await response.json();
			// this.credentials = { ...this.credentials, ...newTokens };
		} catch (error) {
			this.credentials = null; // Clear invalid credentials
			const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
			throw new Error(`Token refresh failed: ${errorMessage}`);
		}
	}

	/**
	 * Clears cached credentials from memory.
	 *
	 * This method removes stored credentials, typically called when
	 * authentication fails or tokens become invalid. Does not affect
	 * the credential file on disk.
	 *
	 * @returns {void}
	 *
	 * @example
	 * ```typescript
	 * auth.clearCredentials();
	 * console.log('Credentials cleared from memory');
	 * ```
	 */
	clearCredentials(): void {
		this.credentials = null;
	}

	/**
	 * Checks if valid, non-expired credentials are currently loaded.
	 *
	 * This is a convenience method that combines credential existence
	 * and expiration checks to determine if the auth manager is ready
	 * for API requests.
	 *
	 * @returns {boolean} True if credentials are loaded and not expired
	 *
	 * @example
	 * ```typescript
	 * if (auth.hasValidCredentials()) {
	 *   // Safe to make API calls
	 *   const documents = await api.getDocuments();
	 * } else {
	 *   // Need to load/refresh credentials first
	 *   await auth.loadCredentials();
	 * }
	 * ```
	 */
	hasValidCredentials(): boolean {
		return this.credentials !== null && !this.isTokenExpired();
	}
}
