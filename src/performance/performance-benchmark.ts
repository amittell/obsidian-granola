/**
 * Comprehensive performance benchmarking system for the Granola Importer plugin.
 *
 * Provides automated performance testing, regression detection, and optimization
 * measurement capabilities for continuous performance improvement.
 *
 * @author Alex Mittell
 * @since 1.2.0
 */

import { PerformanceMonitor } from './performance-monitor';

export interface BenchmarkResult {
	testName: string;
	metrics: {
		avgDuration: number;
		minDuration: number;
		maxDuration: number;
		medianDuration: number;
		p95Duration: number;
		p99Duration: number;
		throughput: number;
		memoryUsage: {
			initial: number;
			peak: number;
			final: number;
			leaked: number;
		};
		errorRate: number;
	};
	iterations: number;
	timestamp: number;
	baseline?: BenchmarkResult;
	improvement?: {
		durationImprovement: number;
		memoryImprovement: number;
		throughputImprovement: number;
	};
}

export interface BenchmarkSuite {
	name: string;
	tests: BenchmarkTest[];
	beforeEach?: () => Promise<void>;
	afterEach?: () => Promise<void>;
	beforeAll?: () => Promise<void>;
	afterAll?: () => Promise<void>;
}

export interface BenchmarkTest {
	name: string;
	test: () => Promise<void>;
	iterations?: number;
	timeout?: number;
	baseline?: BenchmarkResult;
}

export interface BenchmarkReport {
	suites: Array<{
		name: string;
		results: BenchmarkResult[];
		summary: {
			totalTests: number;
			passedTests: number;
			failedTests: number;
			totalDuration: number;
			averagePerformance: number;
			regressions: string[];
			improvements: string[];
		};
	}>;
	timestamp: number;
	environment: {
		userAgent: string;
		platform: string;
		memory: number;
		timestamp: number;
	};
	performanceScore: number;
}

/**
 * Advanced performance benchmarking system with statistical analysis
 * and regression detection capabilities.
 */
export class PerformanceBenchmark {
	private performanceMonitor: PerformanceMonitor;
	private baselines: Map<string, BenchmarkResult> = new Map();
	private isRunning: boolean = false;

	constructor() {
		this.performanceMonitor = PerformanceMonitor.getInstance();
	}

	/**
	 * Loads baseline performance metrics from storage.
	 */
	async loadBaselines(baselines: Record<string, BenchmarkResult>): Promise<void> {
		Object.entries(baselines).forEach(([key, baseline]) => {
			this.baselines.set(key, baseline);
		});
	}

	/**
	 * Runs a single performance test with statistical analysis.
	 */
	async runBenchmark(test: BenchmarkTest): Promise<BenchmarkResult> {
		const iterations = test.iterations || 10;
		const timeout = test.timeout || 30000;
		const durations: number[] = [];
		const memoryUsages: number[] = [];
		let errors = 0;
		let initialMemory = 0;
		let peakMemory = 0;
		let finalMemory = 0;

		console.log(`Running benchmark: ${test.name} (${iterations} iterations)`);

		// Warm-up run (not counted)
		try {
			await this.runSingleIteration(test.test, timeout);
		} catch (error) {
			console.warn(`Warm-up failed for ${test.name}:`, error);
		}

		// Initial memory reading
		initialMemory = this.getCurrentMemoryUsage();
		peakMemory = initialMemory;

		// Run actual iterations
		for (let i = 0; i < iterations; i++) {
			try {
				const duration = await this.runSingleIteration(test.test, timeout);
				durations.push(duration);

				const currentMemory = this.getCurrentMemoryUsage();
				memoryUsages.push(currentMemory);
				peakMemory = Math.max(peakMemory, currentMemory);

				// Small delay between iterations to avoid resource contention
				await this.sleep(10);
			} catch (error) {
				errors++;
				console.warn(`Iteration ${i + 1} failed for ${test.name}:`, error);
			}
		}

		finalMemory = this.getCurrentMemoryUsage();

		if (durations.length === 0) {
			throw new Error(`All iterations failed for test: ${test.name}`);
		}

		// Calculate statistics
		const sortedDurations = durations.sort((a, b) => a - b);
		const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
		const medianDuration = this.calculatePercentile(sortedDurations, 50);
		const p95Duration = this.calculatePercentile(sortedDurations, 95);
		const p99Duration = this.calculatePercentile(sortedDurations, 99);
		const throughput = 1000 / avgDuration; // operations per second

		const result: BenchmarkResult = {
			testName: test.name,
			metrics: {
				avgDuration,
				minDuration: sortedDurations[0],
				maxDuration: sortedDurations[sortedDurations.length - 1],
				medianDuration,
				p95Duration,
				p99Duration,
				throughput,
				memoryUsage: {
					initial: initialMemory,
					peak: peakMemory,
					final: finalMemory,
					leaked: Math.max(0, finalMemory - initialMemory),
				},
				errorRate: errors / iterations,
			},
			iterations: durations.length,
			timestamp: Date.now(),
		};

		// Compare with baseline if available
		const baseline = test.baseline || this.baselines.get(test.name);
		if (baseline) {
			result.baseline = baseline;
			result.improvement = this.calculateImprovement(result, baseline);
		}

		return result;
	}

	/**
	 * Runs a complete benchmark suite with detailed reporting.
	 */
	async runSuite(suite: BenchmarkSuite): Promise<BenchmarkReport['suites'][0]> {
		if (this.isRunning) {
			throw new Error('Benchmark already running');
		}

		this.isRunning = true;
		const results: BenchmarkResult[] = [];
		let totalDuration = 0;
		let passedTests = 0;
		let failedTests = 0;
		const regressions: string[] = [];
		const improvements: string[] = [];

		try {
			console.log(`Starting benchmark suite: ${suite.name}`);

			// Run beforeAll hook
			if (suite.beforeAll) {
				await suite.beforeAll();
			}

			// Run each test
			for (const test of suite.tests) {
				try {
					// Run beforeEach hook
					if (suite.beforeEach) {
						await suite.beforeEach();
					}

					const result = await this.runBenchmark(test);
					results.push(result);
					totalDuration += result.metrics.avgDuration;
					passedTests++;

					// Check for regressions and improvements
					if (result.improvement) {
						if (result.improvement.durationImprovement < -10) {
							// 10% regression threshold
							regressions.push(
								`${test.name}: ${result.improvement.durationImprovement.toFixed(1)}% slower`
							);
						} else if (result.improvement.durationImprovement > 10) {
							// 10% improvement threshold
							improvements.push(
								`${test.name}: ${result.improvement.durationImprovement.toFixed(1)}% faster`
							);
						}
					}

					// Run afterEach hook
					if (suite.afterEach) {
						await suite.afterEach();
					}
				} catch (error) {
					failedTests++;
					console.error(`Test failed: ${test.name}`, error);
				}
			}

			// Run afterAll hook
			if (suite.afterAll) {
				await suite.afterAll();
			}
		} finally {
			this.isRunning = false;
		}

		const averagePerformance = totalDuration / Math.max(passedTests, 1);

		return {
			name: suite.name,
			results,
			summary: {
				totalTests: suite.tests.length,
				passedTests,
				failedTests,
				totalDuration,
				averagePerformance,
				regressions,
				improvements,
			},
		};
	}

	/**
	 * Runs multiple benchmark suites and generates a comprehensive report.
	 */
	async runAllSuites(suites: BenchmarkSuite[]): Promise<BenchmarkReport> {
		const suiteResults = [];
		let totalScore = 0;

		for (const suite of suites) {
			const result = await this.runSuite(suite);
			suiteResults.push(result);

			// Calculate performance score (lower is better)
			const suiteScore =
				result.summary.averagePerformance * (1 + result.summary.failedTests * 0.1);
			totalScore += suiteScore;
		}

		// Overall performance score (inverse of average duration)
		const performanceScore = Math.round(1000 / (totalScore / suites.length));

		return {
			suites: suiteResults,
			timestamp: Date.now(),
			environment: {
				userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
				platform: typeof process !== 'undefined' ? process.platform : 'unknown',
				memory: this.getCurrentMemoryUsage(),
				timestamp: Date.now(),
			},
			performanceScore,
		};
	}

	/**
	 * Creates default benchmark suites for the Granola Importer plugin.
	 */
	createDefaultSuites(): BenchmarkSuite[] {
		return [
			{
				name: 'Plugin Startup Performance',
				tests: [
					{
						name: 'Plugin Load Time',
						test: async () => {
							// Simulate plugin loading
							const start = performance.now();
							await this.simulatePluginLoad();
							const duration = performance.now() - start;
							if (duration > 1000) {
								throw new Error(`Startup too slow: ${duration}ms`);
							}
						},
						iterations: 5,
					},
					{
						name: 'Settings Load Time',
						test: async () => {
							await this.simulateSettingsLoad();
						},
						iterations: 10,
					},
				],
			},
			{
				name: 'Import Performance',
				tests: [
					{
						name: 'Single Document Import',
						test: async () => {
							await this.simulateSingleDocumentImport();
						},
						iterations: 20,
					},
					{
						name: 'Batch Document Import (10 docs)',
						test: async () => {
							await this.simulateBatchImport(10);
						},
						iterations: 5,
					},
					{
						name: 'Large Document Conversion',
						test: async () => {
							await this.simulateLargeDocumentConversion();
						},
						iterations: 10,
					},
				],
			},
			{
				name: 'UI Performance',
				tests: [
					{
						name: 'Modal Open Time',
						test: async () => {
							await this.simulateModalOpen();
						},
						iterations: 15,
					},
					{
						name: 'Document List Rendering',
						test: async () => {
							await this.simulateDocumentListRender(100);
						},
						iterations: 10,
					},
					{
						name: 'Search Performance',
						test: async () => {
							await this.simulateSearch();
						},
						iterations: 20,
					},
				],
			},
			{
				name: 'Memory Performance',
				tests: [
					{
						name: 'Memory Leak Detection',
						test: async () => {
							await this.simulateMemoryLeakTest();
						},
						iterations: 5,
					},
					{
						name: 'Large Dataset Handling',
						test: async () => {
							await this.simulateLargeDatasetHandling();
						},
						iterations: 3,
					},
				],
			},
		];
	}

	/**
	 * Generates a human-readable performance report.
	 */
	generateReport(report: BenchmarkReport): string {
		let output = `\n📊 Performance Benchmark Report\n`;
		output += `${'='.repeat(50)}\n`;
		output += `Generated: ${new Date(report.timestamp).toISOString()}\n`;
		output += `Performance Score: ${report.performanceScore}\n`;
		output += `Platform: ${report.environment.platform}\n`;
		output += `Memory: ${(report.environment.memory / 1024 / 1024).toFixed(2)} MB\n\n`;

		report.suites.forEach(suite => {
			output += `🧪 ${suite.name}\n`;
			output += `${'-'.repeat(30)}\n`;
			output += `Tests: ${suite.summary.passedTests}/${suite.summary.totalTests} passed\n`;
			output += `Average Duration: ${suite.summary.averagePerformance.toFixed(2)}ms\n`;

			if (suite.summary.improvements.length > 0) {
				output += `🚀 Improvements:\n`;
				suite.summary.improvements.forEach(improvement => {
					output += `  ✅ ${improvement}\n`;
				});
			}

			if (suite.summary.regressions.length > 0) {
				output += `⚠️ Regressions:\n`;
				suite.summary.regressions.forEach(regression => {
					output += `  ❌ ${regression}\n`;
				});
			}

			// Top 3 slowest tests
			const slowestTests = suite.results
				.sort((a, b) => b.metrics.avgDuration - a.metrics.avgDuration)
				.slice(0, 3);

			if (slowestTests.length > 0) {
				output += `🐌 Slowest Tests:\n`;
				slowestTests.forEach((test, index) => {
					output += `  ${index + 1}. ${test.testName}: ${test.metrics.avgDuration.toFixed(2)}ms\n`;
				});
			}

			output += '\n';
		});

		return output;
	}

	// Simulation methods for testing
	private async simulatePluginLoad(): Promise<void> {
		await this.sleep(Math.random() * 50 + 10);
	}

	private async simulateSettingsLoad(): Promise<void> {
		await this.sleep(Math.random() * 20 + 5);
	}

	private async simulateSingleDocumentImport(): Promise<void> {
		await this.sleep(Math.random() * 30 + 10);
	}

	private async simulateBatchImport(count: number): Promise<void> {
		await this.sleep(Math.random() * count * 5 + count * 2);
	}

	private async simulateLargeDocumentConversion(): Promise<void> {
		await this.sleep(Math.random() * 100 + 50);
	}

	private async simulateModalOpen(): Promise<void> {
		await this.sleep(Math.random() * 80 + 20);
	}

	private async simulateDocumentListRender(count: number): Promise<void> {
		await this.sleep(Math.random() * count * 0.5 + count * 0.1);
	}

	private async simulateSearch(): Promise<void> {
		await this.sleep(Math.random() * 15 + 2);
	}

	private async simulateMemoryLeakTest(): Promise<void> {
		// Simulate memory allocation and cleanup
		const arrays: number[][] = [];
		for (let i = 0; i < 1000; i++) {
			arrays.push(new Array(1000).fill(Math.random()));
		}
		await this.sleep(50);
		arrays.length = 0; // Cleanup
	}

	private async simulateLargeDatasetHandling(): Promise<void> {
		const data = new Array(10000).fill(0).map(() => ({
			id: Math.random().toString(36),
			title: 'Test Document',
			content: 'A'.repeat(1000),
		}));
		await this.sleep(100);
		data.length = 0; // Cleanup
	}

	private async runSingleIteration(test: () => Promise<void>, timeout: number): Promise<number> {
		const start = performance.now();

		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error('Test timeout')), timeout);
		});

		await Promise.race([test(), timeoutPromise]);

		return performance.now() - start;
	}

	private calculatePercentile(sortedValues: number[], percentile: number): number {
		const index = (percentile / 100) * (sortedValues.length - 1);
		if (Math.floor(index) === index) {
			return sortedValues[index];
		}
		const lower = sortedValues[Math.floor(index)];
		const upper = sortedValues[Math.ceil(index)];
		return lower + (upper - lower) * (index - Math.floor(index));
	}

	private calculateImprovement(
		current: BenchmarkResult,
		baseline: BenchmarkResult
	): BenchmarkResult['improvement'] {
		const durationImprovement =
			((baseline.metrics.avgDuration - current.metrics.avgDuration) /
				baseline.metrics.avgDuration) *
			100;
		const memoryImprovement =
			((baseline.metrics.memoryUsage.peak - current.metrics.memoryUsage.peak) /
				baseline.metrics.memoryUsage.peak) *
			100;
		const throughputImprovement =
			((current.metrics.throughput - baseline.metrics.throughput) /
				baseline.metrics.throughput) *
			100;

		return {
			durationImprovement,
			memoryImprovement,
			throughputImprovement,
		};
	}

	private getCurrentMemoryUsage(): number {
		if (typeof process !== 'undefined' && process.memoryUsage) {
			return process.memoryUsage().heapUsed;
		}

		if (typeof performance !== 'undefined' && (performance as any).memory) {
			return (performance as any).memory.usedJSHeapSize;
		}

		return 0;
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
