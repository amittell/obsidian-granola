/**
 * No-op performance monitoring stubs for production builds.
 *
 * These stubs provide the same interface as the full performance monitoring
 * system but with minimal overhead for production builds.
 */

export interface PerformanceMetrics {
	startTime: number;
	endTime: number;
	duration: number;
	memoryUsage: {
		heapUsed: number;
		heapTotal: number;
		external: number;
		rss: number;
	};
	customMetrics: Record<string, number>;
}

export interface MemoryLeakDetection {
	componentName: string;
	createdAt: number;
	cleanedAt?: number;
	eventListeners: Set<string>;
	domReferences: WeakSet<Node>;
	timers: Set<number>;
	isLeaked: boolean;
	leakDetails?: string[];
}

export interface StartupMetrics {
	pluginLoadStart: number;
	authInitTime: number;
	apiInitTime: number;
	converterInitTime: number;
	servicesInitTime: number;
	totalStartupTime: number;
	lazyLoadSavings: number;
}

export interface RuntimeProfiler {
	operationType: string;
	startTime: number;
	phases: Array<{
		name: string;
		startTime: number;
		endTime: number;
		duration: number;
	}>;
	totalDuration: number;
	bottlenecks: Array<{
		phase: string;
		duration: number;
		percentage: number;
	}>;
}

/**
 * No-op performance monitor for production builds.
 */
export class PerformanceMonitor {
	private static instance: PerformanceMonitor = new PerformanceMonitor();

	static getInstance(): PerformanceMonitor {
		return PerformanceMonitor.instance;
	}

	setEnabled(): void {}
	startMeasurement(): string {
		return '';
	}
	endMeasurement(): null {
		return null;
	}
	getPerformanceStats(): null {
		return null;
	}
	startMemoryTracking(): string {
		return '';
	}
	trackEventListener(): void {}
	trackDOMReference(): void {}
	trackTimer(): void {}
	endMemoryTracking(): null {
		return null;
	}
	getMemoryLeakReports(): any[] {
		return [];
	}
	startStartupTracking(): void {}
	recordStartupPhase(): void {}
	completeStartupTracking(): null {
		return null;
	}
	startRuntimeProfiling(): string {
		return '';
	}
	recordRuntimePhase(): void {}
	completeRuntimeProfiling(): null {
		return null;
	}
	generatePerformanceReport(): any {
		return {};
	}
	clear(): void {}
}

/**
 * No-op decorator for performance measurement.
 */
export function measurePerformance() {
	return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
		return descriptor;
	};
}

/**
 * No-op decorator for memory leak tracking.
 */
export function trackMemoryLeaks() {
	return function (constructor: Function) {
		return constructor;
	};
}

// Simple utility functions - these are lightweight and useful
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

export function optimizeEventHandler<T extends Event>(
	handler: (event: T) => void,
	eventType: string,
	customDelay?: number
): (event: T) => void {
	// Simple optimization for common events
	const optimizationMap: Record<string, { type: 'debounce' | 'throttle'; delay: number }> = {
		input: { type: 'debounce', delay: 150 },
		keyup: { type: 'debounce', delay: 150 },
		search: { type: 'debounce', delay: 300 },
		scroll: { type: 'throttle', delay: 16 },
		resize: { type: 'throttle', delay: 16 },
		mousemove: { type: 'throttle', delay: 16 },
		touchmove: { type: 'throttle', delay: 16 },
		click: { type: 'debounce', delay: 50 },
	};

	const config = optimizationMap[eventType] || { type: 'debounce', delay: 100 };
	const delay = customDelay || config.delay;

	if (config.type === 'throttle') {
		return throttle(handler, delay);
	} else {
		return debounce(handler, delay);
	}
}

// Minimal implementations for heavy performance utilities
export function batchProcessor<T, R>(func: (items: T[]) => R): (item: T) => Promise<R> {
	return async (item: T): Promise<R> => func([item]);
}

export function memoize<T extends (...args: any[]) => any>(
	func: T
): T & { cache: Map<string, any>; clear: () => void } {
	const memoized = func as T & { cache: Map<string, any>; clear: () => void };
	memoized.cache = new Map();
	memoized.clear = () => {};
	return memoized;
}
