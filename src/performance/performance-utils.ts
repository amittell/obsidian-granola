/**
 * Performance utility functions for debouncing, throttling, and optimization.
 *
 * Provides essential performance utilities for creating responsive user interfaces
 * and optimizing function execution patterns.
 *
 * @author Alex Mittell
 * @since 1.2.0
 */

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @param immediate If true, trigger on the leading edge instead of trailing
 * @returns The debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
	immediate: boolean = false
): T & { cancel: () => void; flush: () => void } {
	let timeout: ReturnType<typeof setTimeout> | null = null;
	let args: Parameters<T> | null = null;
	let context: any = null;
	let result: ReturnType<T>;

	const later = function () {
		timeout = null;
		if (!immediate && args) {
			result = func.apply(context, args);
		}
		args = null;
		context = null;
	};

	const debounced = function (this: any, ...newArgs: Parameters<T>): ReturnType<T> {
		context = this;
		args = newArgs;

		const callNow = immediate && !timeout;

		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(later, wait);

		if (callNow) {
			result = func.apply(context, args);
			args = null;
			context = null;
		}

		return result;
	} as T & { cancel: () => void; flush: () => void };

	debounced.cancel = function () {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}
		args = null;
		context = null;
	};

	debounced.flush = function () {
		if (timeout && args) {
			result = func.apply(context, args);
			debounced.cancel();
		}
		return result;
	};

	return debounced;
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 *
 * @param func The function to throttle
 * @param wait The number of milliseconds to throttle invocations to
 * @returns The throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): T & { cancel: () => void; flush: () => void } {
	let timeout: ReturnType<typeof setTimeout> | null = null;
	let previous = 0;
	let args: Parameters<T> | null = null;
	let context: any = null;
	let result: ReturnType<T>;

	const later = function () {
		previous = Date.now();
		timeout = null;
		if (args) {
			result = func.apply(context, args);
		}
		args = null;
		context = null;
	};

	const throttled = function (this: any, ...newArgs: Parameters<T>): ReturnType<T> {
		const now = Date.now();
		const remaining = wait - (now - previous);

		context = this;
		args = newArgs;

		if (remaining <= 0 || remaining > wait) {
			if (timeout) {
				clearTimeout(timeout);
				timeout = null;
			}
			previous = now;
			result = func.apply(context, args);
			args = null;
			context = null;
		} else if (!timeout) {
			timeout = setTimeout(later, remaining);
		}

		return result;
	} as T & { cancel: () => void; flush: () => void };

	throttled.cancel = function () {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}
		previous = 0;
		args = null;
		context = null;
	};

	throttled.flush = function () {
		if (timeout && args) {
			result = func.apply(context, args);
			throttled.cancel();
		}
		return result;
	};

	return throttled;
}

/**
 * Advanced debouncing with leading and trailing edge support.
 *
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @param options Configuration options
 * @returns The debounced function
 */
export function advancedDebounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
	options: {
		leading?: boolean;
		trailing?: boolean;
		maxWait?: number;
	} = {}
): T & { cancel: () => void; flush: () => void; pending: () => boolean } {
	const { leading = false, trailing = true, maxWait } = options;

	let timeout: ReturnType<typeof setTimeout> | null = null;
	let maxTimeout: ReturnType<typeof setTimeout> | null = null;
	let args: Parameters<T> | null = null;
	let context: any = null;
	let result: ReturnType<T>;
	let lastCallTime = 0;
	let lastInvokeTime = 0;

	const invokeFunc = (time: number) => {
		const funcArgs = args!;
		const funcContext = context!;

		args = null;
		context = null;
		lastInvokeTime = time;

		return func.apply(funcContext, funcArgs);
	};

	const leadingEdge = (time: number) => {
		lastInvokeTime = time;
		timeout = setTimeout(timerExpired, wait);
		return leading ? invokeFunc(time) : result;
	};

	const remainingWait = (time: number) => {
		const timeSinceLastCall = time - lastCallTime;
		const timeSinceLastInvoke = time - lastInvokeTime;
		const timeWaiting = wait - timeSinceLastCall;

		return maxWait !== undefined
			? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
			: timeWaiting;
	};

	const shouldInvoke = (time: number) => {
		const timeSinceLastCall = time - lastCallTime;
		const timeSinceLastInvoke = time - lastInvokeTime;

		return (
			lastCallTime === 0 ||
			timeSinceLastCall >= wait ||
			timeSinceLastCall < 0 ||
			(maxWait !== undefined && timeSinceLastInvoke >= maxWait)
		);
	};

	const timerExpired = () => {
		const time = Date.now();
		if (shouldInvoke(time)) {
			return trailingEdge(time);
		}
		timeout = setTimeout(timerExpired, remainingWait(time));
	};

	const trailingEdge = (time: number) => {
		timeout = null;

		if (trailing && args) {
			return invokeFunc(time);
		}
		args = null;
		context = null;
		return result;
	};

	const cancel = () => {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}
		if (maxTimeout) {
			clearTimeout(maxTimeout);
			maxTimeout = null;
		}
		lastInvokeTime = 0;
		lastCallTime = 0;
		args = null;
		context = null;
	};

	const flush = () => {
		return timeout ? trailingEdge(Date.now()) : result;
	};

	const pending = () => {
		return timeout !== null;
	};

	const debounced = function (this: any, ...newArgs: Parameters<T>): ReturnType<T> {
		const time = Date.now();
		const isInvoking = shouldInvoke(time);

		lastCallTime = time;
		context = this;
		args = newArgs;

		if (isInvoking) {
			if (!timeout) {
				return leadingEdge(lastCallTime);
			}
			if (maxWait) {
				timeout = setTimeout(timerExpired, wait);
				return invokeFunc(lastCallTime);
			}
		}
		if (!timeout) {
			timeout = setTimeout(timerExpired, wait);
		}
		return result;
	} as T & { cancel: () => void; flush: () => void; pending: () => boolean };

	debounced.cancel = cancel;
	debounced.flush = flush;
	debounced.pending = pending;

	return debounced;
}

/**
 * Creates a function that's restricted to running at most once every specified time period.
 * Provides more control over throttling behavior than basic throttle.
 *
 * @param func The function to throttle
 * @param wait The number of milliseconds to throttle invocations to
 * @param options Configuration options
 * @returns The throttled function
 */
export function advancedThrottle<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
	options: {
		leading?: boolean;
		trailing?: boolean;
	} = {}
): T & { cancel: () => void; flush: () => void } {
	const { leading = true, trailing = true } = options;

	return advancedDebounce(func, wait, {
		leading,
		trailing,
		maxWait: wait,
	});
}

/**
 * Creates a batch processing function that collects calls and processes them in batches.
 *
 * @param func The function to batch
 * @param batchSize Maximum number of items per batch
 * @param maxWait Maximum time to wait before processing partial batch
 * @returns The batched function
 */
export function batchProcessor<T, R>(
	func: (items: T[]) => R,
	batchSize: number = 10,
	maxWait: number = 100
): (item: T) => Promise<R> {
	let batch: T[] = [];
	let resolvers: Array<(value: R) => void> = [];
	let rejecters: Array<(reason?: any) => void> = [];
	let timeout: ReturnType<typeof setTimeout> | null = null;

	const processBatch = async () => {
		if (batch.length === 0) return;

		const currentBatch = batch;
		const currentResolvers = resolvers;
		const currentRejecters = rejecters;

		batch = [];
		resolvers = [];
		rejecters = [];

		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}

		try {
			const result = await func(currentBatch);
			currentResolvers.forEach(resolve => resolve(result));
		} catch (error) {
			currentRejecters.forEach(reject => reject(error));
		}
	};

	return (item: T): Promise<R> => {
		return new Promise((resolve, reject) => {
			batch.push(item);
			resolvers.push(resolve);
			rejecters.push(reject);

			if (batch.length >= batchSize) {
				processBatch();
			} else if (!timeout) {
				timeout = setTimeout(processBatch, maxWait);
			}
		});
	};
}

/**
 * Creates a memoized version of a function with configurable cache.
 *
 * @param func The function to memoize
 * @param keyGenerator Function to generate cache keys
 * @param maxSize Maximum cache size
 * @param ttl Time to live for cache entries in milliseconds
 * @returns The memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
	func: T,
	keyGenerator?: (...args: Parameters<T>) => string,
	maxSize: number = 100,
	ttl?: number
): T & { cache: Map<string, any>; clear: () => void } {
	const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();
	const defaultKeyGenerator = (...args: Parameters<T>) => JSON.stringify(args);
	const generateKey = keyGenerator || defaultKeyGenerator;

	const memoized = function (this: any, ...args: Parameters<T>): ReturnType<T> {
		const key = generateKey(...args);
		const now = Date.now();

		// Check if cached value exists and is still valid
		if (cache.has(key)) {
			const cached = cache.get(key)!;
			if (!ttl || now - cached.timestamp < ttl) {
				return cached.value;
			}
			cache.delete(key);
		}

		// Compute new value
		const result = func.apply(this, args);

		// Manage cache size
		if (cache.size >= maxSize) {
			const firstKey = cache.keys().next().value;
			cache.delete(firstKey);
		}

		// Store in cache
		cache.set(key, { value: result, timestamp: now });

		return result;
	} as T & { cache: Map<string, any>; clear: () => void };

	memoized.cache = cache as Map<string, any>;
	memoized.clear = () => cache.clear();

	return memoized;
}

/**
 * Creates a rate-limited function that ensures a minimum time between calls.
 *
 * @param func The function to rate limit
 * @param minInterval Minimum time between calls in milliseconds
 * @returns The rate-limited function
 */
export function rateLimit<T extends (...args: any[]) => any>(func: T, minInterval: number): T {
	let lastCallTime = 0;

	return function (this: any, ...args: Parameters<T>): ReturnType<T> {
		const now = Date.now();
		const timeSinceLastCall = now - lastCallTime;

		if (timeSinceLastCall >= minInterval) {
			lastCallTime = now;
			return func.apply(this, args);
		}

		// If called too soon, return undefined or throw
		throw new Error(`Rate limit exceeded. Please wait ${minInterval - timeSinceLastCall}ms`);
	} as T;
}

/**
 * Performance optimization utilities for DOM operations.
 */
export const DOMUtils = {
	/**
	 * Batches DOM reads and writes to avoid layout thrashing.
	 */
	batchDOMOperations: (operations: Array<() => void>): void => {
		requestAnimationFrame(() => {
			operations.forEach(op => op());
		});
	},

	/**
	 * Creates a virtual scrolling handler for large lists.
	 */
	createVirtualScrollHandler: (
		containerHeight: number,
		itemHeight: number,
		totalItems: number,
		renderItem: (index: number, offset: number) => HTMLElement
	) => {
		let scrollTop = 0;
		const visibleCount = Math.ceil(containerHeight / itemHeight) + 2;

		return {
			handleScroll: (newScrollTop: number) => {
				scrollTop = newScrollTop;
				const startIndex = Math.floor(scrollTop / itemHeight);
				const endIndex = Math.min(startIndex + visibleCount, totalItems);

				return {
					startIndex,
					endIndex,
					items: Array.from({ length: endIndex - startIndex }, (_, i) => {
						const index = startIndex + i;
						return renderItem(index, index * itemHeight);
					}),
				};
			},
			getVisibleRange: () => ({
				start: Math.floor(scrollTop / itemHeight),
				end: Math.min(Math.floor(scrollTop / itemHeight) + visibleCount, totalItems),
			}),
		};
	},
};

/**
 * Creates a performance-optimized event handler that automatically debounces or throttles based on event type.
 */
export function optimizeEventHandler<T extends Event>(
	handler: (event: T) => void,
	eventType: string,
	customDelay?: number
): (event: T) => void {
	// Default optimization strategies for common events
	const optimizationMap: Record<string, { type: 'debounce' | 'throttle'; delay: number }> = {
		input: { type: 'debounce', delay: 150 },
		keyup: { type: 'debounce', delay: 150 },
		search: { type: 'debounce', delay: 300 },
		scroll: { type: 'throttle', delay: 16 }, // ~60fps
		resize: { type: 'throttle', delay: 16 },
		mousemove: { type: 'throttle', delay: 16 },
		touchmove: { type: 'throttle', delay: 16 },
		click: { type: 'debounce', delay: 50 }, // Prevent double-clicks
	};

	const config = optimizationMap[eventType] || { type: 'debounce', delay: 100 };
	const delay = customDelay || config.delay;

	if (config.type === 'throttle') {
		return throttle(handler, delay);
	} else {
		return debounce(handler, delay);
	}
}
