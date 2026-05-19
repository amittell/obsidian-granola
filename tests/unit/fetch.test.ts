import { createServer, Server } from 'node:http';
import { nodeFetch } from '../../src/fetch';

function listen(server: Server): Promise<number> {
	return new Promise(resolve => {
		server.listen(0, () => {
			const address = server.address();
			if (typeof address === 'object' && address?.port) {
				resolve(address.port);
			}
		});
	});
}

function close(server: Server): Promise<void> {
	return new Promise(resolve => {
		const timeout = setTimeout(resolve, 100);
		server.close(() => {
			clearTimeout(timeout);
			resolve();
		});
		server.closeAllConnections?.();
		server.closeIdleConnections?.();
	});
}

describe('nodeFetch', () => {
	let server: Server;
	let baseUrl: string;

	afterEach(async () => {
		if (server.listening) {
			await close(server);
		}
	});

	it('performs basic GET requests and exposes response headers', async () => {
		let requestedPath = '';
		server = createServer((req, res) => {
			expect(req.method).toBe('GET');
			requestedPath = req.url ?? '';
			res.setHeader('x-test-header', 'ok');
			res.end('hello');
		});
		baseUrl = `http://127.0.0.1:${await listen(server)}`;

		const response = await nodeFetch(`${baseUrl}/hello`);

		expect(response.status).toBe(200);
		expect(response.headers.get('x-test-header')).toBe('ok');
		expect(requestedPath).toBe('/hello');
	});

	it('follows redirects', async () => {
		let hitTarget = false;
		server = createServer((req, res) => {
			if (req.url === '/redirect') {
				res.statusCode = 302;
				res.setHeader('location', '/target');
				res.end();
				return;
			}

			hitTarget = true;
			res.end('target');
		});
		baseUrl = `http://127.0.0.1:${await listen(server)}`;

		const response = await nodeFetch(`${baseUrl}/redirect`);

		expect(response.status).toBe(200);
		expect(hitTarget).toBe(true);
	});

	it('sends string request bodies with content length', async () => {
		let resolveReceived: (value: string) => void;
		const received = new Promise<string>(resolve => {
			resolveReceived = resolve;
		});
		server = createServer((req, res) => {
			let body = '';
			req.on('data', chunk => {
				body += chunk.toString();
			});
			req.on('end', () => {
				resolveReceived(`${req.headers['content-length']}:${body}`);
				res.end(`${req.headers['content-length']}:${body}`);
			});
		});
		baseUrl = `http://127.0.0.1:${await listen(server)}`;

		const response = await nodeFetch(`${baseUrl}/echo`, {
			method: 'POST',
			body: 'payload',
		});

		expect(response.status).toBe(200);
		await expect(received).resolves.toBe('7:payload');
	});

	it('supports URLSearchParams and ArrayBuffer bodies', async () => {
		const bodies: string[] = [];
		let resolveReceived: () => void;
		const received = new Promise<void>(resolve => {
			resolveReceived = resolve;
		});
		server = createServer((req, res) => {
			let body = '';
			req.on('data', chunk => {
				body += chunk.toString();
			});
			req.on('end', () => {
				bodies.push(body);
				if (bodies.length === 2) {
					resolveReceived();
				}
				res.end('ok');
			});
		});
		baseUrl = `http://127.0.0.1:${await listen(server)}`;

		await nodeFetch(`${baseUrl}/form`, {
			method: 'POST',
			body: new URLSearchParams({ q: 'granola' }),
		});
		const bytes = new Uint8Array([98, 121, 116, 101, 115]);
		await nodeFetch(`${baseUrl}/buffer`, {
			method: 'POST',
			body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
		});

		await received;
		expect(bodies).toEqual(['q=granola', 'bytes']);
	});

	it('rejects immediately when called with an aborted signal', async () => {
		server = createServer((_req, res) => {
			res.end('unreachable');
		});
		baseUrl = `http://127.0.0.1:${await listen(server)}`;
		const controller = new AbortController();
		controller.abort();

		await expect(
			nodeFetch(`${baseUrl}/aborted`, {
				signal: controller.signal,
			})
		).rejects.toThrow('The operation was aborted');
	});
});
