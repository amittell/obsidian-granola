/**
 * Mock implementation of performance monitoring for test environment.
 * Provides stub implementations that don't interfere with test execution.
 */

export class PerformanceMonitor {
	private static instance: PerformanceMonitor;

	static getInstance(): PerformanceMonitor {
		if (!PerformanceMonitor.instance) {
			PerformanceMonitor.instance = new PerformanceMonitor();
		}
		return PerformanceMonitor.instance;
	}

	setEnabled(enabled: boolean): void {
		// Stub - no-op in tests
	}

	startMeasurement(name: string): string {
		return `mock-measurement-${Date.now()}`;
	}

	endMeasurement(name: string, id: string, customMetrics?: any): any {
		return { duration: 0, endTime: Date.now(), startTime: Date.now() };
	}

	getPerformanceStats(name: string): any {
		return {
			averageDuration: 0,
			medianDuration: 0,
			minDuration: 0,
			maxDuration: 0,
			totalMeasurements: 0,
			memoryTrend: 'stable' as const,
		};
	}

	startMemoryTracking(componentName: string): string {
		return `mock-memory-${Date.now()}`;
	}

	endMemoryTracking(id: string): any {
		return { isLeaked: false };
	}

	trackEventListener(id: string, listener: any): void {
		// Stub - no-op in tests
	}

	trackDOMReference(id: string, element: any): void {
		// Stub - no-op in tests
	}

	trackTimer(id: string, timerId: any): void {
		// Stub - no-op in tests
	}

	startRuntimeProfiling(name: string): string {
		return `mock-runtime-${Date.now()}`;
	}

	recordRuntimePhase(
		profileId: string,
		phaseName: string,
		startTime: number,
		endTime: number
	): void {
		// Stub - no-op in tests
	}

	completeRuntimeProfiling(profileId: string): any {
		return {
			bottlenecks: [],
			phases: [],
			totalDuration: 0,
		};
	}

	getCurrentMemoryUsage(): any {
		return {
			heapUsed: 1000000,
			heapTotal: 2000000,
			external: 100000,
		};
	}
}

// Mock decorators
export function measurePerformance(operationName: string) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		// Return the original method unchanged in tests
		return descriptor;
	};
}

export function trackMemoryLeaks(componentName: string) {
	return function (constructor: any) {
		// Return the original constructor unchanged in tests
		return constructor;
	};
}

// Export singleton instance for direct use
export const performanceMonitor = PerformanceMonitor.getInstance();
