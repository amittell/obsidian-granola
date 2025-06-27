import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir, platform } from 'os';

export interface GranolaCredentials {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_at: number;
}

export interface SupabaseConfig {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_at: number;
}

export class GranolaAuth {
	private credentials: GranolaCredentials | null = null;

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

		if (Date.now() > config.expires_at * 1000) {
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

		return Date.now() > this.credentials.expires_at * 1000;
	}
}
