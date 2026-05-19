import { request as httpRequest, IncomingMessage } from 'http';
import { request as httpsRequest } from 'https';

const MAX_REDIRECTS = 5;

/**
 * Fetch implementation backed by Node's HTTP modules.
 *
 * Obsidian's browser fetch can enforce CORS for remote MCP/OAuth requests; the
 * MCP SDK accepts a fetch-compatible function, so use Node networking instead.
 */
export function nodeFetch(input: string | URL, init?: RequestInit): Promise<Response> {
	return doFetch(input, init, 0);
}

function doFetch(
	input: string | URL,
	init: RequestInit | undefined,
	redirectCount: number
): Promise<Response> {
	return new Promise((resolve, reject) => {
		const url = typeof input === 'string' ? new URL(input) : input;
		const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
		const headers = new Headers(init?.headers);
		const body = toBodyBuffer(init?.body);

		if (body && !headers.has('content-length')) {
			headers.set('content-length', String(body.length));
		}

		const req = request(
			{
				hostname: url.hostname,
				port: url.port || undefined,
				path: `${url.pathname}${url.search}`,
				method: init?.method || 'GET',
				headers: toRequestHeaders(headers),
			},
			(res: IncomingMessage) => {
				if (
					res.statusCode &&
					res.statusCode >= 300 &&
					res.statusCode < 400 &&
					res.headers.location &&
					redirectCount < MAX_REDIRECTS
				) {
					const redirectUrl = new URL(res.headers.location, url);
					res.resume();
					doFetch(redirectUrl, init, redirectCount + 1).then(resolve, reject);
					return;
				}

				resolve(
					new Response(toWebReadableStream(res), {
						status: res.statusCode || 200,
						statusText: res.statusMessage || '',
						headers: toResponseHeaders(res),
					})
				);
			}
		);

		req.on('error', reject);

		if (init?.signal) {
			if (init.signal.aborted) {
				req.destroy();
				reject(new DOMException('The operation was aborted', 'AbortError'));
				return;
			}

			init.signal.addEventListener('abort', () => {
				req.destroy();
				reject(new DOMException('The operation was aborted', 'AbortError'));
			});
		}

		if (body) {
			req.write(body);
		}

		req.end();
	});
}

function toRequestHeaders(headers: Headers): Record<string, string> {
	const result: Record<string, string> = {};
	headers.forEach((value, key) => {
		result[key] = value;
	});
	return result;
}

function toBodyBuffer(body: BodyInit | null | undefined): Buffer | undefined {
	if (body == null) {
		return undefined;
	}

	if (typeof body === 'string') {
		return Buffer.from(body, 'utf-8');
	}

	if (body instanceof URLSearchParams) {
		return Buffer.from(body.toString(), 'utf-8');
	}

	if (body instanceof ArrayBuffer) {
		return Buffer.from(body);
	}

	if (ArrayBuffer.isView(body)) {
		return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	}

	return undefined;
}

function toResponseHeaders(res: IncomingMessage): Headers {
	const headers = new Headers();

	for (const [key, value] of Object.entries(res.headers)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				headers.append(key, item);
			}
		} else if (value !== undefined) {
			headers.set(key, value);
		}
	}

	return headers;
}

function toWebReadableStream(res: IncomingMessage): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			res.on('data', (chunk: Buffer) => {
				controller.enqueue(new Uint8Array(chunk));
			});
			res.on('end', () => {
				controller.close();
			});
			res.on('error', error => {
				controller.error(error);
			});
		},
		cancel() {
			res.destroy();
		},
	});
}
