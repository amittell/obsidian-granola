import { Platform } from 'obsidian';

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
 * OAuth token structure within the Granola configuration file.
 *
 * This interface represents the parsed cognito_tokens JSON string
 * from the supabase.json file. Contains AWS Cognito OAuth tokens.
 *
 * @interface CognitoTokens
 * @since 1.0.0
 */
export interface CognitoTokens {
	/** JWT access token from AWS Cognito OAuth flow */
	access_token: string;

	/** Refresh token for token renewal (not yet implemented) */
	refresh_token: string;

	/** OAuth token type, typically "Bearer" (capitalized) */
	token_type: string;

	/** Token expiration time in seconds from now */
	expires_in: number;

	/** JWT ID token containing user information */
	id_token: string;
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
	/** Stringified JSON containing AWS Cognito OAuth tokens */
	cognito_tokens: string;

	/** Stringified JSON containing user profile information */
	user_info: string;
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
	 * Base path for Granola configuration files.
	 * Set dynamically based on the current platform.
	 * @private
	 */
	private configBasePath: string = '';

	/**
	 * Loads and validates Granola credentials from the platform-specific config file.
	 *
	 * This method locates the supabase.json file created by the Granola desktop app,
	 * reads the credential data, validates the token format and expiration,
	 * and caches the credentials for subsequent API requests.
	 *
	 * Note: On mobile platforms, this will fail as Granola is a desktop-only application.
	 * The plugin currently only supports desktop platforms.
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

		// Check if running on a supported platform
		if (Platform.isMobile) {
			throw new Error(
				'Granola Importer is not supported on mobile devices. ' +
				'Granola is a desktop application and credentials are only available on desktop platforms.'
			);
		}

		const configPath = this.getSupabaseConfigPath();

		try {
			// Read credentials file from the user's home directory
			// Note: This accesses files outside the vault, which requires Obsidian's
			// file system APIs. On desktop, we use a workaround with fetch for local files.
			const configData = await this.readConfigFile(configPath);
			const config: SupabaseConfig = JSON.parse(configData);

			// Parse the nested cognito_tokens JSON string
			const cognitoTokens: CognitoTokens = JSON.parse(config.cognito_tokens);

			this.validateCredentials(cognitoTokens);

			// Convert expires_in (seconds from now) to expires_at (unix timestamp)
			const expiresAt =
				Math.floor(Date.now() / TIMESTAMP_CONVERSION_FACTOR) + cognitoTokens.expires_in;

			this.credentials = {
				access_token: cognitoTokens.access_token,
				refresh_token: cognitoTokens.refresh_token,
				token_type: cognitoTokens.token_type.toLowerCase(), // Normalize to lowercase
				expires_at: expiresAt,
			};

			return this.credentials;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to load Granola credentials: ${errorMessage}`);
		}
	}

	/**
	 * Reads the configuration file from the file system.
	 *
	 * Uses a workaround to read files from outside the vault on desktop platforms.
	 * This is necessary because Granola stores credentials in the user's home directory,
	 * not within the Obsidian vault.
	 *
	 * @private
	 * @param {string} path - Absolute path to the configuration file
	 * @returns {Promise<string>} The file contents as a string
	 * @throws {Error} If the file cannot be read
	 */
	private async readConfigFile(path: string): Promise<string> {
		try {
			// Use Node.js require to access fs module directly on desktop
			// This is a workaround since Obsidian's DataAdapter is vault-scoped
			const fs = require('fs');
			return fs.readFileSync(path, 'utf-8');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(
				`Cannot read Granola configuration file at ${path}. ` +
				'Please ensure Granola is installed and you are logged in. ' +
				`Error: ${errorMessage}`
			);
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
		// Use Node.js modules to determine paths
		// This works on Obsidian desktop but not mobile
		const os = require('os');
		const path = require('path');
		const platform = os.platform();
		const homedir = os.homedir();

		switch (platform) {
			case 'darwin': // macOS
				return path.join(homedir, 'Library', 'Application Support', 'Granola', 'supabase.json');
			case 'win32': // Windows
				return path.join(homedir, 'AppData', 'Roaming', 'Granola', 'supabase.json');
			case 'linux': // Linux
				return path.join(homedir, '.config', 'Granola', 'supabase.json');
			default:
				throw new Error(`Unsupported platform: ${platform}`);
		}
	}

	/**
	 * Validates the structure and content of loaded credentials.
	 *
	 * Performs comprehensive validation including:
	 * - Required field presence check
	 * - Token type verification (must be "bearer" case-insensitive)
	 * - JWT token format validation using regex
	 * - Token expiration check using expires_in field
	 *
	 * @private
	 * @param {CognitoTokens} tokens - The cognito tokens object to validate
	 * @throws {Error} If any validation check fails
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   this.validateCredentials(tokens);
	 *   console.log('Credentials are valid');
	 * } catch (error) {
	 *   console.error('Invalid credentials:', error.message);
	 * }
	 * ```
	 */
	private validateCredentials(tokens: CognitoTokens): void {
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

		// Enhanced JWT format validation - should have exactly 3 non-empty parts
		const tokenParts = tokens.access_token.split('.');
		if (tokenParts.length !== JWT_PARTS_COUNT || tokenParts.some(part => part.length === 0)) {
			throw new Error('Invalid token format');
		}

		// Check if token will expire soon (expires_in is in seconds)
		if (tokens.expires_in <= 0) {
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
