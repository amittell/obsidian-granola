import { GranolaAuth, GranolaAuthData, GranolaAuthStorage } from '../../src/auth';

function createStorage(initialData: GranolaAuthData = {}) {
	let data: GranolaAuthData & Record<string, unknown> = { ...initialData };
	const storage: GranolaAuthStorage = {
		getData: jest.fn(async () => data),
		saveData: jest.fn(async nextData => {
			data = { ...nextData };
		}),
		openUrl: jest.fn(),
	};

	return {
		storage,
		get data() {
			return data;
		},
	};
}

describe('GranolaAuth', () => {
	it('exposes MCP OAuth client metadata', () => {
		const auth = new GranolaAuth();

		expect(auth.redirectUrl).toBe('obsidian://granola-auth');
		expect(auth.clientMetadata).toEqual({
			client_name: 'Obsidian Granola Importer',
			redirect_uris: ['obsidian://granola-auth'],
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'none',
		});
	});

	it('persists OAuth tokens with an absolute expiry', async () => {
		const fixture = createStorage();
		const auth = new GranolaAuth(fixture.storage);

		await auth.saveTokens({
			access_token: 'access-token',
			refresh_token: 'refresh-token',
			token_type: 'Bearer',
			expires_in: 3600,
		});

		expect(fixture.storage.saveData).toHaveBeenCalled();
		expect(fixture.data.oauthTokens).toMatchObject({
			access_token: 'access-token',
			refresh_token: 'refresh-token',
			token_type: 'Bearer',
			expires_in: 3600,
			obtained_at: expect.any(Number),
			expires_at: expect.any(Number),
		});
	});

	it('loads credentials from persisted tokens', async () => {
		const { storage } = createStorage({
			oauthTokens: {
				access_token: 'access-token',
				refresh_token: 'refresh-token',
				token_type: 'Bearer',
				expires_at: Math.floor(Date.now() / 1000) + 3600,
			},
		});
		const auth = new GranolaAuth(storage);

		const credentials = await auth.loadCredentials();

		expect(credentials).toEqual({
			access_token: 'access-token',
			refresh_token: 'refresh-token',
			token_type: 'bearer',
			expires_at: expect.any(Number),
		});
		expect(auth.getBearerToken()).toBe('access-token');
		expect(auth.hasValidCredentials()).toBe(true);
	});

	it('rejects missing tokens', async () => {
		const { storage } = createStorage();
		const auth = new GranolaAuth(storage);

		await expect(auth.loadCredentials()).rejects.toThrow('Granola account is not connected');
		expect(() => auth.getBearerToken()).toThrow('Credentials not loaded');
	});

	it('rejects invalid token types', async () => {
		const { storage } = createStorage({
			oauthTokens: {
				access_token: 'access-token',
				token_type: 'Basic',
			},
		});
		const auth = new GranolaAuth(storage);

		await expect(auth.loadCredentials()).rejects.toThrow('Invalid token type: Basic');
	});

	it('persists dynamic client registration and PKCE verifier', async () => {
		const fixture = createStorage();
		const auth = new GranolaAuth(fixture.storage);

		await auth.saveClientInformation({ client_id: 'client-id' });
		await auth.saveCodeVerifier('verifier');

		expect(await auth.clientInformation()).toEqual({ client_id: 'client-id' });
		expect(await auth.codeVerifier()).toBe('verifier');
		expect(fixture.data.oauthClientInfo).toEqual({ client_id: 'client-id' });
		expect(fixture.data.oauthCodeVerifier).toBe('verifier');
	});

	it('opens browser authorization URLs through storage', async () => {
		const { storage } = createStorage();
		const auth = new GranolaAuth(storage);

		await auth.redirectToAuthorization(new URL('https://mcp.granola.ai/auth'));

		expect(storage.openUrl).toHaveBeenCalledWith('https://mcp.granola.ai/auth');
	});

	it('clears persisted OAuth state', async () => {
		const fixture = createStorage({
			oauthTokens: {
				access_token: 'access-token',
				token_type: 'Bearer',
			},
			oauthClientInfo: { client_id: 'client-id' },
			oauthCodeVerifier: 'verifier',
		});
		const auth = new GranolaAuth(fixture.storage);
		await auth.loadCredentials();

		await auth.clearCredentials();

		expect(auth.hasValidCredentials()).toBe(false);
		expect(fixture.data.oauthTokens).toBeUndefined();
		expect(fixture.data.oauthClientInfo).toBeUndefined();
		expect(fixture.data.oauthCodeVerifier).toBeUndefined();
	});

	it('marks cached tokens expired using the stored expiry', async () => {
		const { storage } = createStorage({
			oauthTokens: {
				access_token: 'access-token',
				token_type: 'Bearer',
				expires_at: Math.floor(Date.now() / 1000) - 1,
			},
		});
		const auth = new GranolaAuth(storage);
		await auth.loadCredentials();

		expect(auth.isTokenExpired()).toBe(true);
		expect(auth.hasValidCredentials()).toBe(false);
	});
});
