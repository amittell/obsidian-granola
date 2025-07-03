/**
 * Mock implementation of performance utilities for test environment.
 */

// Mock debounce function
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): T & { cancel: () => void; flush: () => void } {
	const mockFn = func as T & { cancel: () => void; flush: () => void };
	mockFn.cancel = () => {};
	mockFn.flush = () => {};
	return mockFn;
}

// Mock throttle function
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): T & { cancel: () => void; flush: () => void } {
	const mockFn = func as T & { cancel: () => void; flush: () => void };
	mockFn.cancel = () => {};
	mockFn.flush = () => {};
	return mockFn;
}

// Mock batch processor
export function batchProcessor<T>(
	processor: (items: T[]) => Promise<any>,
	batchSize: number,
	delay: number
): (item: T) => Promise<any> {
	return async (item: T) => {
		// In tests, process immediately without batching
		return processor([item]);
	};
}

// Mock memoize function
export function memoize<T extends (...args: any[]) => any>(
	fn: T,
	keyGenerator: (...args: Parameters<T>) => string,
	maxSize: number = 100,
	ttl: number = 300000
): T {
	// In tests, just return the original function without memoization
	return fn;
}

// Mock optimize event handler
export function optimizeEventHandler<T extends (...args: any[]) => any>(
	handler: T,
	options?: { passive?: boolean; capture?: boolean }
): T {
	// In tests, return the original handler unchanged
	return handler;
}

// Mock performance timing utilities
export const performanceUtils = {
	now: () => Date.now(),
	mark: (name: string) => {},
	measure: (name: string, startMark?: string, endMark?: string) => ({ duration: 0 }),
	clearMarks: (name?: string) => {},
	clearMeasures: (name?: string) => {},
};
