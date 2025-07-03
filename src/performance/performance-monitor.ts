/**
 * Enterprise-grade performance monitoring system for the Granola Importer plugin.
 *
 * Provides comprehensive performance tracking, memory leak detection, and
 * runtime profiling capabilities for production monitoring and optimization.
 *
 * @author Alex Mittell
 * @since 1.2.0
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
 * Central performance monitoring system providing enterprise-grade tracking
 * and optimization capabilities for the Granola Importer plugin.
 */
export class PerformanceMonitor {
	private static instance: PerformanceMonitor;
	private metricsHistory: Map<string, PerformanceMetrics[]> = new Map();
	private memoryTracking: Map<string, MemoryLeakDetection> = new Map();
	private startupMetrics: StartupMetrics | null = null;
	private runtimeProfiles: Map<string, RuntimeProfiler> = new Map();
	private isEnabled: boolean = true;

	private constructor() {}

	/**
	 * Singleton instance getter for centralized performance monitoring.
	 */
	static getInstance(): PerformanceMonitor {
		if (!PerformanceMonitor.instance) {
			PerformanceMonitor.instance = new PerformanceMonitor();
		}
		return PerformanceMonitor.instance;
	}

	/**
	 * Enable or disable performance monitoring.
	 */
	setEnabled(enabled: boolean): void {
		this.isEnabled = enabled;
	}

	/**
	 * Start performance measurement for a specific operation.
	 */
	startMeasurement(operationName: string): string {
		if (!this.isEnabled) return '';

		const measurementId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		const metrics: PerformanceMetrics = {
			startTime: performance.now(),
			endTime: 0,
			duration: 0,
			memoryUsage: this.getCurrentMemoryUsage(),
			customMetrics: {},
		};

		if (!this.metricsHistory.has(operationName)) {
			this.metricsHistory.set(operationName, []);
		}

		this.metricsHistory.get(operationName)!.push(metrics);

		return measurementId;
	}

	/**
	 * End performance measurement and calculate metrics.
	 */
	endMeasurement(
		operationName: string,
		measurementId: string,
		customMetrics?: Record<string, number>
	): PerformanceMetrics | null {
		if (!this.isEnabled) return null;

		const history = this.metricsHistory.get(operationName);
		if (!history || history.length === 0) return null;

		const metrics = history[history.length - 1];
		metrics.endTime = performance.now();
		metrics.duration = metrics.endTime - metrics.startTime;

		if (customMetrics) {
			metrics.customMetrics = { ...metrics.customMetrics, ...customMetrics };
		}

		// Keep only last 100 measurements per operation
		if (history.length > 100) {
			history.shift();
		}

		return metrics;
	}

	/**
	 * Get performance statistics for an operation.
	 */
	getPerformanceStats(operationName: string): {
		averageDuration: number;
		medianDuration: number;
		minDuration: number;
		maxDuration: number;
		totalMeasurements: number;
		memoryTrend: 'increasing' | 'decreasing' | 'stable';
	} | null {
		const history = this.metricsHistory.get(operationName);
		if (!history || history.length === 0) return null;

		const durations = history.map(m => m.duration).sort((a, b) => a - b);
		const memoryUsages = history.map(m => m.memoryUsage.heapUsed);

		// Calculate memory trend
		let memoryTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
		if (memoryUsages.length > 2) {
			const first =
				memoryUsages
					.slice(0, Math.floor(memoryUsages.length / 3))
					.reduce((a, b) => a + b, 0) / Math.floor(memoryUsages.length / 3);
			const last =
				memoryUsages
					.slice(-Math.floor(memoryUsages.length / 3))
					.reduce((a, b) => a + b, 0) / Math.floor(memoryUsages.length / 3);
			const threshold = first * 0.1; // 10% threshold

			if (last > first + threshold) {
				memoryTrend = 'increasing';
			} else if (last < first - threshold) {
				memoryTrend = 'decreasing';
			}
		}

		return {
			averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
			medianDuration: durations[Math.floor(durations.length / 2)],
			minDuration: durations[0],
			maxDuration: durations[durations.length - 1],
			totalMeasurements: durations.length,
			memoryTrend,
		};
	}

	/**
	 * Start memory leak detection for a component.
	 */
	startMemoryTracking(componentName: string): string {
		if (!this.isEnabled) return '';

		const trackingId = `${componentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		const detection: MemoryLeakDetection = {
			componentName,
			createdAt: Date.now(),
			eventListeners: new Set(),
			domReferences: new WeakSet(),
			timers: new Set(),
			isLeaked: false,
		};

		this.memoryTracking.set(trackingId, detection);
		return trackingId;
	}

	/**
	 * Track event listener for memory leak detection.
	 */
	trackEventListener(trackingId: string, eventType: string): void {
		if (!this.isEnabled) return;

		const detection = this.memoryTracking.get(trackingId);
		if (detection) {
			detection.eventListeners.add(eventType);
		}
	}

	/**
	 * Track DOM reference for memory leak detection.
	 */
	trackDOMReference(trackingId: string, element: Node): void {
		if (!this.isEnabled) return;

		const detection = this.memoryTracking.get(trackingId);
		if (detection) {
			detection.domReferences.add(element);
		}
	}

	/**
	 * Track timer for memory leak detection.
	 */
	trackTimer(trackingId: string, timerId: number): void {
		if (!this.isEnabled) return;

		const detection = this.memoryTracking.get(trackingId);
		if (detection) {
			detection.timers.add(timerId);
		}
	}

	/**
	 * End memory tracking and detect leaks.
	 */
	endMemoryTracking(trackingId: string): MemoryLeakDetection | null {
		if (!this.isEnabled) return null;

		const detection = this.memoryTracking.get(trackingId);
		if (!detection) return null;

		detection.cleanedAt = Date.now();
		detection.leakDetails = [];

		// Check for potential memory leaks
		if (detection.eventListeners.size > 0) {
			detection.isLeaked = true;
			detection.leakDetails.push(
				`Uncleaned event listeners: ${Array.from(detection.eventListeners).join(', ')}`
			);
		}

		if (detection.timers.size > 0) {
			detection.isLeaked = true;
			detection.leakDetails.push(
				`Uncleaned timers: ${Array.from(detection.timers).join(', ')}`
			);
		}

		// Clean up tracking
		this.memoryTracking.delete(trackingId);

		return detection;
	}

	/**
	 * Get all memory leak reports.
	 */
	getMemoryLeakReports(): MemoryLeakDetection[] {
		return Array.from(this.memoryTracking.values()).filter(detection => detection.isLeaked);
	}

	/**
	 * Start startup performance tracking.
	 */
	startStartupTracking(): void {
		if (!this.isEnabled) return;

		this.startupMetrics = {
			pluginLoadStart: performance.now(),
			authInitTime: 0,
			apiInitTime: 0,
			converterInitTime: 0,
			servicesInitTime: 0,
			totalStartupTime: 0,
			lazyLoadSavings: 0,
		};
	}

	/**
	 * Record startup phase timing.
	 */
	recordStartupPhase(phase: 'auth' | 'api' | 'converter' | 'services', duration: number): void {
		if (!this.isEnabled || !this.startupMetrics) return;

		switch (phase) {
			case 'auth':
				this.startupMetrics.authInitTime = duration;
				break;
			case 'api':
				this.startupMetrics.apiInitTime = duration;
				break;
			case 'converter':
				this.startupMetrics.converterInitTime = duration;
				break;
			case 'services':
				this.startupMetrics.servicesInitTime = duration;
				break;
		}
	}

	/**
	 * Complete startup tracking.
	 */
	completeStartupTracking(): StartupMetrics | null {
		if (!this.isEnabled || !this.startupMetrics) return null;

		this.startupMetrics.totalStartupTime =
			performance.now() - this.startupMetrics.pluginLoadStart;
		return this.startupMetrics;
	}

	/**
	 * Start runtime profiling for an operation.
	 */
	startRuntimeProfiling(operationType: string): string {
		if (!this.isEnabled) return '';

		const profileId = `${operationType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		const profiler: RuntimeProfiler = {
			operationType,
			startTime: performance.now(),
			phases: [],
			totalDuration: 0,
			bottlenecks: [],
		};

		this.runtimeProfiles.set(profileId, profiler);
		return profileId;
	}

	/**
	 * Record a phase in runtime profiling.
	 */
	recordRuntimePhase(
		profileId: string,
		phaseName: string,
		startTime: number,
		endTime: number
	): void {
		if (!this.isEnabled) return;

		const profiler = this.runtimeProfiles.get(profileId);
		if (profiler) {
			profiler.phases.push({
				name: phaseName,
				startTime,
				endTime,
				duration: endTime - startTime,
			});
		}
	}

	/**
	 * Complete runtime profiling and analyze bottlenecks.
	 */
	completeRuntimeProfiling(profileId: string): RuntimeProfiler | null {
		if (!this.isEnabled) return null;

		const profiler = this.runtimeProfiles.get(profileId);
		if (!profiler) return null;

		profiler.totalDuration = performance.now() - profiler.startTime;

		// Identify bottlenecks (phases taking more than 20% of total time)
		profiler.bottlenecks = profiler.phases
			.map(phase => ({
				phase: phase.name,
				duration: phase.duration,
				percentage: (phase.duration / profiler.totalDuration) * 100,
			}))
			.filter(bottleneck => bottleneck.percentage > 20)
			.sort((a, b) => b.percentage - a.percentage);

		// Clean up
		this.runtimeProfiles.delete(profileId);

		return profiler;
	}

	/**
	 * Get current memory usage information.
	 */
	private getCurrentMemoryUsage(): PerformanceMetrics['memoryUsage'] {
		if (typeof process !== 'undefined' && process.memoryUsage) {
			const usage = process.memoryUsage();
			return {
				heapUsed: usage.heapUsed,
				heapTotal: usage.heapTotal,
				external: usage.external,
				rss: usage.rss,
			};
		}

		// Fallback for browser environment
		return {
			heapUsed: (performance as any).memory?.usedJSHeapSize || 0,
			heapTotal: (performance as any).memory?.totalJSHeapSize || 0,
			external: 0,
			rss: 0,
		};
	}

	/**
	 * Generate comprehensive performance report.
	 */
	generatePerformanceReport(): {
		summary: {
			totalOperations: number;
			averagePerformance: number;
			memoryLeaks: number;
			startupTime: number;
		};
		operations: Array<{
			name: string;
			stats: ReturnType<PerformanceMonitor['getPerformanceStats']>;
		}>;
		memoryLeaks: MemoryLeakDetection[];
		startup: StartupMetrics | null;
		recommendations: string[];
	} {
		const operations = Array.from(this.metricsHistory.keys()).map(name => ({
			name,
			stats: this.getPerformanceStats(name),
		}));

		const memoryLeaks = this.getMemoryLeakReports();

		const totalOperations = operations.reduce(
			(sum, op) => sum + (op.stats?.totalMeasurements || 0),
			0
		);
		const averagePerformance =
			operations.reduce((sum, op) => sum + (op.stats?.averageDuration || 0), 0) /
			operations.length;

		// Generate recommendations
		const recommendations: string[] = [];

		if (memoryLeaks.length > 0) {
			recommendations.push(
				`Found ${memoryLeaks.length} potential memory leaks - implement proper cleanup`
			);
		}

		operations.forEach(op => {
			if (op.stats && op.stats.memoryTrend === 'increasing') {
				recommendations.push(
					`${op.name} shows increasing memory usage - investigate memory leaks`
				);
			}
			if (op.stats && op.stats.averageDuration > 100) {
				recommendations.push(
					`${op.name} has high average duration (${op.stats.averageDuration.toFixed(2)}ms) - optimize performance`
				);
			}
		});

		if (this.startupMetrics && this.startupMetrics.totalStartupTime > 1000) {
			recommendations.push(
				`Startup time is high (${this.startupMetrics.totalStartupTime.toFixed(2)}ms) - implement more lazy loading`
			);
		}

		return {
			summary: {
				totalOperations,
				averagePerformance,
				memoryLeaks: memoryLeaks.length,
				startupTime: this.startupMetrics?.totalStartupTime || 0,
			},
			operations,
			memoryLeaks,
			startup: this.startupMetrics,
			recommendations,
		};
	}

	/**
	 * Clear all performance data.
	 */
	clear(): void {
		this.metricsHistory.clear();
		this.memoryTracking.clear();
		this.runtimeProfiles.clear();
		this.startupMetrics = null;
	}
}

/**
 * Decorator for automatic performance measurement.
 */
export function measurePerformance(operationName: string) {
	return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
		const method = descriptor.value;

		descriptor.value = async function (...args: any[]) {
			const monitor = PerformanceMonitor.getInstance();
			const measurementId = monitor.startMeasurement(operationName);

			try {
				const result = await method.apply(this, args);
				monitor.endMeasurement(operationName, measurementId);
				return result;
			} catch (error) {
				monitor.endMeasurement(operationName, measurementId, { errorOccurred: 1 });
				throw error;
			}
		};
	};
}

/**
 * Decorator for automatic memory leak detection.
 */
export function trackMemoryLeaks(componentName: string) {
	return function (constructor: Function) {
		const originalOnload = constructor.prototype.onOpen || (() => {});
		const originalOnunload = constructor.prototype.onClose || (() => {});

		constructor.prototype.onOpen = function () {
			const monitor = PerformanceMonitor.getInstance();
			this.__memoryTrackingId = monitor.startMemoryTracking(componentName);
			return originalOnload.call(this);
		};

		constructor.prototype.onClose = function () {
			const result = originalOnunload.call(this);

			if (this.__memoryTrackingId) {
				const monitor = PerformanceMonitor.getInstance();
				const detection = monitor.endMemoryTracking(this.__memoryTrackingId);

				if (detection?.isLeaked) {
					console.warn(
						`Memory leak detected in ${componentName}:`,
						detection.leakDetails
					);
				}
			}

			return result;
		};
	};
}
