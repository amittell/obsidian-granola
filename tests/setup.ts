import { jest } from '@jest/globals';

// Define development constants for test environment
(global as any).__DEV__ = true;
(global as any).DEBUG = true;

// Enhanced DOM environment setup for complex UI testing
import './helpers/dom-test-utils';

// Mock filesystem operations
jest.mock('fs', () => ({
	readFileSync: jest.fn(),
	existsSync: jest.fn(),
	promises: {
		readFile: jest.fn(),
		access: jest.fn(),
		stat: jest.fn(),
	},
}));

// Mock OS module
jest.mock('os', () => ({
	homedir: jest.fn(() => '/mock/home'),
	platform: jest.fn(() => 'darwin'),
	type: jest.fn(() => 'Darwin'),
}));

// Mock path module
jest.mock('path', () => ({
	join: jest.fn((...args) => args.join('/')),
	resolve: jest.fn((...args) => args.join('/')),
	dirname: jest.fn(() => '/mock/dir'),
	basename: jest.fn(() => 'file.txt'),
}));

// Enhanced test environment setup
beforeEach(() => {
	// Clear all mocks before each test
	jest.clearAllMocks();

	// Reset DOM state
	document.body.innerHTML = '';
	document.head.innerHTML = '';

	// Enhanced DOM element creation mock
	const originalCreateElement = document.createElement.bind(document);
	document.createElement = jest.fn().mockImplementation(tagName => {
		const element = originalCreateElement(tagName);
		if (tagName === 'style') {
			// Mock style element methods
			element.appendChild = jest.fn();
			element.textContent = '';
		}
		return element;
	});

	// Mock document.head.appendChild for style injection
	if (document.head) {
		document.head.appendChild = jest.fn().mockImplementation(node => {
			// Just return the node without actually appending
			return node;
		});
	}

	// Clear any global event listeners
	if (window.removeEventListener) {
		// Remove common event listeners that might persist between tests
		const events = ['resize', 'scroll', 'click', 'keydown', 'keyup'];
		events.forEach(event => {
			// Create a new function to remove all listeners of this type
			const originalRemoveEventListener = window.removeEventListener;
			window.removeEventListener = originalRemoveEventListener;
		});
	}

	// Only mock console methods when specifically requested via environment variable
	// This allows real errors to surface during development while still allowing
	// tests to opt into silent console when needed
	if (process.env.JEST_MOCK_CONSOLE === 'true') {
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(console, 'log').mockImplementation(() => {});
	}
});

afterEach(() => {
	// Cleanup after each test
	jest.restoreAllMocks();
	jest.clearAllTimers();
	jest.useRealTimers();
});

// Global test timeout
jest.setTimeout(15000);

// Enhanced error handling for async operations
process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
	// Fail the test if there's an unhandled rejection
	throw new Error(`Unhandled Promise Rejection: ${reason}`);
});

// Better performance monitoring for tests
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalRequestAnimationFrame = global.requestAnimationFrame;

// Track timing operations for debugging slow tests
let activeTimeouts = new Set();
let activeIntervals = new Set();
let activeAnimationFrames = new Set();

global.setTimeout = (
	callback: (...args: unknown[]) => void,
	delay?: number,
	...args: unknown[]
) => {
	const id = originalSetTimeout(callback, delay, ...args);
	activeTimeouts.add(id);
	return id;
};

global.setInterval = (
	callback: (...args: unknown[]) => void,
	delay?: number,
	...args: unknown[]
) => {
	const id = originalSetInterval(callback, delay, ...args);
	activeIntervals.add(id);
	return id;
};

global.requestAnimationFrame = (callback: FrameRequestCallback) => {
	const id = originalRequestAnimationFrame
		? originalRequestAnimationFrame(callback)
		: originalSetTimeout(callback, 16); // Fallback to setTimeout for jsdom
	activeAnimationFrames.add(id);
	return id;
};

// Enhanced clearTimeout/clearInterval tracking
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;
const originalCancelAnimationFrame = global.cancelAnimationFrame;

global.clearTimeout = (id: NodeJS.Timeout) => {
	activeTimeouts.delete(id);
	return originalClearTimeout(id);
};

global.clearInterval = (id: NodeJS.Timeout) => {
	activeIntervals.delete(id);
	return originalClearInterval(id);
};

global.cancelAnimationFrame = (id: number) => {
	activeAnimationFrames.delete(id);
	if (originalCancelAnimationFrame) {
		return originalCancelAnimationFrame(id);
	} else {
		return originalClearTimeout(id);
	}
};

// Test cleanup utilities
global.cleanupTimers = () => {
	activeTimeouts.forEach(id => global.clearTimeout(id));
	activeIntervals.forEach(id => global.clearInterval(id));
	activeAnimationFrames.forEach(id => global.cancelAnimationFrame(id));

	activeTimeouts.clear();
	activeIntervals.clear();
	activeAnimationFrames.clear();
};

// Cleanup timers after each test
afterEach(() => {
	global.cleanupTimers();
});

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = jest.fn().mockImplementation(callback => ({
	observe: jest.fn(),
	unobserve: jest.fn(),
	disconnect: jest.fn(),
	root: null,
	rootMargin: '0px',
	thresholds: [0],
}));

// Mock ResizeObserver for components that use it
global.ResizeObserver = jest.fn().mockImplementation(callback => ({
	observe: jest.fn(),
	unobserve: jest.fn(),
	disconnect: jest.fn(),
}));

// Mock MutationObserver for components that use it
global.MutationObserver = jest.fn().mockImplementation(callback => ({
	observe: jest.fn(),
	disconnect: jest.fn(),
	takeRecords: jest.fn(() => []),
}));

// Enhanced scroll behavior mocking
Element.prototype.scrollIntoView = jest.fn();
Element.prototype.scrollTo = jest.fn();
window.scrollTo = jest.fn();

// Mock getComputedStyle for style-dependent tests
window.getComputedStyle = jest.fn().mockImplementation(element => ({
	getPropertyValue: jest.fn().mockReturnValue(''),
	setProperty: jest.fn(),
	removeProperty: jest.fn(),
	display: 'block',
	visibility: 'visible',
	opacity: '1',
	width: '100px',
	height: '100px',
}));

// Mock CSS variables and theme detection
Object.defineProperty(document.documentElement.style, 'setProperty', {
	value: jest.fn(),
	writable: true,
});

Object.defineProperty(document.documentElement.style, 'getPropertyValue', {
	value: jest.fn().mockReturnValue(''),
	writable: true,
});

// Mock localStorage and sessionStorage
const localStorageMock = {
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
	clear: jest.fn(),
	length: 0,
	key: jest.fn(),
};

const sessionStorageMock = {
	getItem: jest.fn(),
	setItem: jest.fn(),
	removeItem: jest.fn(),
	clear: jest.fn(),
	length: 0,
	key: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
	value: localStorageMock,
	writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
	value: sessionStorageMock,
	writable: true,
});

// Mock URL and URLSearchParams for modern web APIs
global.URL = jest.fn().mockImplementation((url, base) => ({
	href: url,
	origin: 'http://localhost:3000',
	protocol: 'http:',
	host: 'localhost:3000',
	hostname: 'localhost',
	port: '3000',
	pathname: new URL(url, base || 'http://localhost:3000').pathname,
	search: new URL(url, base || 'http://localhost:3000').search,
	hash: new URL(url, base || 'http://localhost:3000').hash,
	searchParams: new URLSearchParams(new URL(url, base || 'http://localhost:3000').search),
}));

global.URLSearchParams = URLSearchParams;

// Mock Clipboard API for testing copy/paste functionality
Object.assign(navigator, {
	clipboard: {
		writeText: jest.fn().mockResolvedValue(undefined),
		readText: jest.fn().mockResolvedValue(''),
		write: jest.fn().mockResolvedValue(undefined),
		read: jest.fn().mockResolvedValue([]),
	},
});

// Mock File API for file upload testing
global.File = jest.fn().mockImplementation((bits, name, options) => ({
	name,
	size: bits.reduce(
		(acc: number, bit: string | ArrayBuffer | ArrayBufferView) =>
			acc + (typeof bit === 'string' ? bit.length : bit.byteLength || 0),
		0
	),
	type: options?.type || '',
	lastModified: Date.now(),
	arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
	text: jest.fn().mockResolvedValue(''),
	stream: jest.fn(),
	slice: jest.fn(),
}));

global.FileList = jest.fn();
global.FileReader = jest.fn().mockImplementation(() => ({
	readAsText: jest.fn(),
	readAsDataURL: jest.fn(),
	readAsArrayBuffer: jest.fn(),
	abort: jest.fn(),
	result: null,
	error: null,
	onload: null,
	onerror: null,
	onabort: null,
	onprogress: null,
	readyState: 0,
	EMPTY: 0,
	LOADING: 1,
	DONE: 2,
}));

// Enhanced fetch mock for API testing
global.fetch = jest.fn().mockResolvedValue({
	ok: true,
	status: 200,
	statusText: 'OK',
	headers: new Map(),
	json: jest.fn().mockResolvedValue({}),
	text: jest.fn().mockResolvedValue(''),
	blob: jest.fn().mockResolvedValue(new Blob()),
	arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
	clone: jest.fn(),
});

// Mock media queries for responsive component testing
window.matchMedia = jest.fn().mockImplementation(query => ({
	matches: false,
	media: query,
	onchange: null,
	addListener: jest.fn(),
	removeListener: jest.fn(),
	addEventListener: jest.fn(),
	removeEventListener: jest.fn(),
	dispatchEvent: jest.fn(),
}));
