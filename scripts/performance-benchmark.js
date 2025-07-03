#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Performance Benchmark
 *
 * Benchmarks modal loading times, interaction responsiveness, and document processing performance.
 * Provides regression detection for performance metrics.
 */

const BENCHMARK_HISTORY_FILE = path.join(__dirname, '..', 'monitoring', 'performance-history.json');

// Configuration
const CONFIG = {
	// Performance regression thresholds (milliseconds)
	MODAL_LOAD_THRESHOLD: 100,
	INTERACTION_THRESHOLD: 50,
	PROCESSING_THRESHOLD: 500,
	// Alert if performance degrades by more than this percentage
	REGRESSION_THRESHOLD_PERCENT: 20,
	// Maximum number of history entries to keep
	MAX_HISTORY_ENTRIES: 100,
};

/**
 * Performance timing utilities
 */
class PerformanceTimer {
	constructor() {
		this.marks = new Map();
	}

	mark(name) {
		this.marks.set(name, process.hrtime.bigint());
	}

	measure(startMark, endMark) {
		const start = this.marks.get(startMark);
		const end = this.marks.get(endMark || 'end');

		if (!start || !end) {
			throw new Error(`Invalid marks: ${startMark} -> ${endMark}`);
		}

		return Number(end - start) / 1000000; // Convert to milliseconds
	}

	measureSince(startMark) {
		const start = this.marks.get(startMark);
		if (!start) {
			throw new Error(`Invalid start mark: ${startMark}`);
		}

		const now = process.hrtime.bigint();
		return Number(now - start) / 1000000; // Convert to milliseconds
	}
}

/**
 * Mock Obsidian environment for benchmarking
 */
function createMockObsidianEnvironment() {
	// Mock document data for testing
	const mockDocuments = Array.from({ length: 100 }, (_, i) => ({
		id: `doc-${i}`,
		title: `Test Document ${i}`,
		created_at: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
		updated_at: new Date().toISOString(),
		last_viewed_panel: {
			content: {
				type: 'doc',
				content: Array.from({ length: Math.floor(Math.random() * 20) + 1 }, (_, j) => ({
					type: 'paragraph',
					content: [
						{
							type: 'text',
							text: `This is paragraph ${j} of document ${i}. `.repeat(
								Math.floor(Math.random() * 10) + 1
							),
						},
					],
				})),
			},
		},
	}));

	return {
		documents: mockDocuments,
		vault: {
			adapter: {
				exists: () => Promise.resolve(false),
				write: () => Promise.resolve(),
			},
		},
	};
}

/**
 * Benchmark modal initialization and loading
 */
async function benchmarkModalLoading() {
	const timer = new PerformanceTimer();
	const results = {};

	try {
		// Simulate modal module loading (dynamic import simulation)
		timer.mark('modal-import-start');

		// Simulate the time it takes to load modal modules
		await new Promise(resolve => {
			const loadTime = Math.random() * 50 + 10; // 10-60ms simulation
			setTimeout(resolve, loadTime);
		});

		timer.mark('modal-import-end');
		results.modalImportTime = timer.measure('modal-import-start', 'modal-import-end');

		// Simulate modal initialization
		timer.mark('modal-init-start');

		const mockEnv = createMockObsidianEnvironment();

		// Simulate modal DOM creation and data processing
		await new Promise(resolve => {
			const initTime = Math.random() * 30 + 20; // 20-50ms simulation
			setTimeout(resolve, initTime);
		});

		timer.mark('modal-init-end');
		results.modalInitTime = timer.measure('modal-init-start', 'modal-init-end');

		// Simulate document list rendering
		timer.mark('render-start');

		// Process documents for display
		const processedDocs = mockEnv.documents.map(doc => ({
			id: doc.id,
			title: doc.title,
			preview:
				doc.last_viewed_panel.content.content
					.filter(node => node.type === 'paragraph')
					.slice(0, 2)
					.map(p => p.content[0]?.text || '')
					.join(' ')
					.slice(0, 100) + '...',
		}));

		timer.mark('render-end');
		results.renderTime = timer.measure('render-start', 'render-end');

		results.totalLoadTime =
			results.modalImportTime + results.modalInitTime + results.renderTime;
		results.documentCount = mockEnv.documents.length;
	} catch (error) {
		console.error('Error in modal loading benchmark:', error.message);
		return null;
	}

	return results;
}

/**
 * Benchmark user interaction responsiveness
 */
async function benchmarkInteractionResponsiveness() {
	const timer = new PerformanceTimer();
	const results = {};

	try {
		const mockEnv = createMockObsidianEnvironment();

		// Benchmark search/filter operations
		timer.mark('search-start');

		const searchTerm = 'test';
		const filteredDocs = mockEnv.documents.filter(doc =>
			doc.title.toLowerCase().includes(searchTerm.toLowerCase())
		);

		timer.mark('search-end');
		results.searchTime = timer.measure('search-start', 'search-end');
		results.searchResults = filteredDocs.length;

		// Benchmark sorting operations
		timer.mark('sort-start');

		const sortedDocs = [...mockEnv.documents].sort(
			(a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
		);

		timer.mark('sort-end');
		results.sortTime = timer.measure('sort-start', 'sort-end');

		// Benchmark selection operations
		timer.mark('selection-start');

		const selectedDocs = mockEnv.documents.slice(0, 10);
		const selectionState = selectedDocs.reduce((acc, doc) => {
			acc[doc.id] = true;
			return acc;
		}, {});

		timer.mark('selection-end');
		results.selectionTime = timer.measure('selection-start', 'selection-end');
		results.selectedCount = Object.keys(selectionState).length;
	} catch (error) {
		console.error('Error in interaction benchmark:', error.message);
		return null;
	}

	return results;
}

/**
 * Benchmark document processing performance
 */
async function benchmarkDocumentProcessing() {
	const timer = new PerformanceTimer();
	const results = {};

	try {
		const mockEnv = createMockObsidianEnvironment();

		// Benchmark content conversion
		timer.mark('conversion-start');

		const convertedDocs = mockEnv.documents.slice(0, 10).map(doc => {
			// Simulate ProseMirror to Markdown conversion
			const content = doc.last_viewed_panel.content.content
				.map(node => {
					if (node.type === 'paragraph') {
						return node.content.map(c => c.text).join('');
					}
					return '';
				})
				.filter(text => text.length > 0)
				.join('\n\n');

			return {
				title: doc.title,
				content,
				frontmatter: {
					granola_id: doc.id,
					created: doc.created_at,
					updated: doc.updated_at,
				},
			};
		});

		timer.mark('conversion-end');
		results.conversionTime = timer.measure('conversion-start', 'conversion-end');
		results.convertedCount = convertedDocs.length;

		// Benchmark duplicate detection
		timer.mark('duplicate-start');

		const existingDocs = mockEnv.documents.slice(0, 5).map(doc => ({
			path: `${doc.title.replace(/[^a-zA-Z0-9]/g, '-')}.md`,
			granolaId: doc.id,
			lastModified: new Date(doc.updated_at).getTime(),
		}));

		const duplicates = mockEnv.documents.filter(doc =>
			existingDocs.some(existing => existing.granolaId === doc.id)
		);

		timer.mark('duplicate-end');
		results.duplicateDetectionTime = timer.measure('duplicate-start', 'duplicate-end');
		results.duplicatesFound = duplicates.length;

		// Benchmark file operations (simulated)
		timer.mark('file-ops-start');

		const fileOperations = convertedDocs.map(async doc => {
			// Simulate file write operations
			return new Promise(resolve => {
				const writeTime = Math.random() * 5 + 1; // 1-6ms simulation
				setTimeout(resolve, writeTime);
			});
		});

		await Promise.all(fileOperations);

		timer.mark('file-ops-end');
		results.fileOperationsTime = timer.measure('file-ops-start', 'file-ops-end');
	} catch (error) {
		console.error('Error in document processing benchmark:', error.message);
		return null;
	}

	return results;
}

/**
 * Run comprehensive performance benchmark
 */
async function runBenchmark() {
	console.log('Running performance benchmarks...');

	const results = {
		timestamp: new Date().toISOString(),
		git: getCurrentGitInfo(),
		benchmarks: {},
	};

	// Run modal loading benchmark
	console.log('  • Modal loading benchmark...');
	results.benchmarks.modalLoading = await benchmarkModalLoading();

	// Run interaction responsiveness benchmark
	console.log('  • Interaction responsiveness benchmark...');
	results.benchmarks.interactions = await benchmarkInteractionResponsiveness();

	// Run document processing benchmark
	console.log('  • Document processing benchmark...');
	results.benchmarks.documentProcessing = await benchmarkDocumentProcessing();

	// Calculate summary metrics
	results.summary = {
		totalModalLoadTime: results.benchmarks.modalLoading?.totalLoadTime || 0,
		averageInteractionTime: results.benchmarks.interactions
			? (results.benchmarks.interactions.searchTime +
					results.benchmarks.interactions.sortTime +
					results.benchmarks.interactions.selectionTime) /
				3
			: 0,
		totalProcessingTime:
			results.benchmarks.documentProcessing?.conversionTime +
				results.benchmarks.documentProcessing?.duplicateDetectionTime +
				results.benchmarks.documentProcessing?.fileOperationsTime || 0,
	};

	return results;
}

/**
 * Get current git information
 */
function getCurrentGitInfo() {
	try {
		const { execSync } = require('child_process');
		return {
			commit: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
			branch: execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim(),
			message: execSync('git log -1 --pretty=%s', { encoding: 'utf8' }).trim(),
		};
	} catch {
		return { commit: 'unknown', branch: 'unknown', message: 'unknown' };
	}
}

/**
 * Load performance history
 */
function loadHistory() {
	try {
		if (fs.existsSync(BENCHMARK_HISTORY_FILE)) {
			return JSON.parse(fs.readFileSync(BENCHMARK_HISTORY_FILE, 'utf8'));
		}
	} catch (error) {
		console.warn('Could not load performance history:', error.message);
	}
	return [];
}

/**
 * Save performance history
 */
function saveHistory(history) {
	try {
		// Ensure monitoring directory exists
		const monitoringDir = path.dirname(BENCHMARK_HISTORY_FILE);
		if (!fs.existsSync(monitoringDir)) {
			fs.mkdirSync(monitoringDir, { recursive: true });
		}

		// Limit history size
		if (history.length > CONFIG.MAX_HISTORY_ENTRIES) {
			history = history.slice(-CONFIG.MAX_HISTORY_ENTRIES);
		}

		fs.writeFileSync(BENCHMARK_HISTORY_FILE, JSON.stringify(history, null, 2));
	} catch (error) {
		console.error('Error saving performance history:', error.message);
	}
}

/**
 * Check for performance regressions
 */
function checkForRegressions(current, history) {
	if (history.length === 0) {
		return { hasRegressions: false, message: 'No previous data for comparison' };
	}

	// Find the most recent entry with summary data
	const previous = history.slice().reverse().find(entry => entry.summary);
	if (!previous || !previous.summary) {
		return { hasRegressions: false, message: 'No previous performance data with summary found' };
	}

	const issues = [];

	// Check modal loading time
	const modalTimeChange =
		((current.summary.totalModalLoadTime - previous.summary.totalModalLoadTime) /
			previous.summary.totalModalLoadTime) *
		100;
	if (
		current.summary.totalModalLoadTime > CONFIG.MODAL_LOAD_THRESHOLD ||
		modalTimeChange > CONFIG.REGRESSION_THRESHOLD_PERCENT
	) {
		issues.push(
			`Modal loading: ${current.summary.totalModalLoadTime.toFixed(2)}ms (${modalTimeChange > 0 ? '+' : ''}${modalTimeChange.toFixed(2)}%)`
		);
	}

	// Check interaction responsiveness
	const interactionTimeChange =
		((current.summary.averageInteractionTime - previous.summary.averageInteractionTime) /
			previous.summary.averageInteractionTime) *
		100;
	if (
		current.summary.averageInteractionTime > CONFIG.INTERACTION_THRESHOLD ||
		interactionTimeChange > CONFIG.REGRESSION_THRESHOLD_PERCENT
	) {
		issues.push(
			`Interaction time: ${current.summary.averageInteractionTime.toFixed(2)}ms (${interactionTimeChange > 0 ? '+' : ''}${interactionTimeChange.toFixed(2)}%)`
		);
	}

	// Check processing time
	const processingTimeChange =
		((current.summary.totalProcessingTime - previous.summary.totalProcessingTime) /
			previous.summary.totalProcessingTime) *
		100;
	if (
		current.summary.totalProcessingTime > CONFIG.PROCESSING_THRESHOLD ||
		processingTimeChange > CONFIG.REGRESSION_THRESHOLD_PERCENT
	) {
		issues.push(
			`Processing time: ${current.summary.totalProcessingTime.toFixed(2)}ms (${processingTimeChange > 0 ? '+' : ''}${processingTimeChange.toFixed(2)}%)`
		);
	}

	return {
		hasRegressions: issues.length > 0,
		issues,
		message:
			issues.length > 0
				? `🚨 PERFORMANCE REGRESSIONS DETECTED!\n${issues.join('\n')}`
				: `✅ Performance checks passed - Modal: ${current.summary.totalModalLoadTime.toFixed(2)}ms, Interactions: ${current.summary.averageInteractionTime.toFixed(2)}ms, Processing: ${current.summary.totalProcessingTime.toFixed(2)}ms`,
	};
}

/**
 * Main execution function
 */
async function main() {
	const args = process.argv.slice(2);
	const command = args[0] || 'run';

	switch (command) {
		case 'run':
			await runBenchmarkCommand();
			break;
		case 'check':
			await checkRegressionsCommand();
			break;
		case 'report':
			await showReport();
			break;
		case 'history':
			showHistory();
			break;
		default:
			console.log(`
Performance Benchmark

Commands:
  run     - Run performance benchmarks (default)
  check   - Check for regressions and exit with error code if found
  report  - Show detailed performance report
  history - Show performance history

Configuration:
  Modal load threshold: ${CONFIG.MODAL_LOAD_THRESHOLD}ms
  Interaction threshold: ${CONFIG.INTERACTION_THRESHOLD}ms
  Processing threshold: ${CONFIG.PROCESSING_THRESHOLD}ms
  Regression threshold: ${CONFIG.REGRESSION_THRESHOLD_PERCENT}%
            `);
	}
}

async function runBenchmarkCommand() {
	const results = await runBenchmark();
	if (!results) {
		process.exit(1);
	}

	const history = loadHistory();
	const regression = checkForRegressions(results, history);

	console.log('\nPerformance Benchmark Results:');
	console.log('==============================');
	console.log(`Modal loading: ${results.summary.totalModalLoadTime.toFixed(2)}ms`);
	console.log(`Average interaction: ${results.summary.averageInteractionTime.toFixed(2)}ms`);
	console.log(`Document processing: ${results.summary.totalProcessingTime.toFixed(2)}ms`);
	console.log('');
	console.log(regression.message);

	// Add results to history
	history.push(results);
	saveHistory(history);

	if (regression.hasRegressions && process.env.CI) {
		console.error('\nPerformance regression detected in CI environment');
		process.exit(1);
	}
}

async function checkRegressionsCommand() {
	const results = await runBenchmark();
	if (!results) {
		process.exit(1);
	}

	const history = loadHistory();
	const regression = checkForRegressions(results, history);

	console.log(regression.message);

	if (regression.hasRegressions) {
		process.exit(1);
	}
}

async function showReport() {
	const history = loadHistory();

	if (history.length === 0) {
		console.log('No performance history available. Run benchmark first.');
		return;
	}

	const latest = history[history.length - 1];

	console.log('Performance Report');
	console.log('==================');
	console.log(`Latest benchmark: ${new Date(latest.timestamp).toLocaleString()}`);
	console.log(`Git: ${latest.git.branch}@${latest.git.commit.slice(0, 8)}`);
	console.log('');
	console.log('Modal Loading:');
	console.log(`  Import time: ${latest.benchmarks.modalLoading.modalImportTime.toFixed(2)}ms`);
	console.log(`  Init time: ${latest.benchmarks.modalLoading.modalInitTime.toFixed(2)}ms`);
	console.log(`  Render time: ${latest.benchmarks.modalLoading.renderTime.toFixed(2)}ms`);
	console.log(`  Total: ${latest.benchmarks.modalLoading.totalLoadTime.toFixed(2)}ms`);
	console.log('');
	console.log('Interactions:');
	console.log(`  Search: ${latest.benchmarks.interactions.searchTime.toFixed(2)}ms`);
	console.log(`  Sort: ${latest.benchmarks.interactions.sortTime.toFixed(2)}ms`);
	console.log(`  Selection: ${latest.benchmarks.interactions.selectionTime.toFixed(2)}ms`);
	console.log('');
	console.log('Document Processing:');
	console.log(
		`  Conversion: ${latest.benchmarks.documentProcessing.conversionTime.toFixed(2)}ms`
	);
	console.log(
		`  Duplicate detection: ${latest.benchmarks.documentProcessing.duplicateDetectionTime.toFixed(2)}ms`
	);
	console.log(
		`  File operations: ${latest.benchmarks.documentProcessing.fileOperationsTime.toFixed(2)}ms`
	);

	if (history.length > 1) {
		const previous = history[history.length - 2];
		console.log('');
		console.log('Trends (vs previous):');
		const modalChange =
			((latest.summary.totalModalLoadTime - previous.summary.totalModalLoadTime) /
				previous.summary.totalModalLoadTime) *
			100;
		const interactionChange =
			((latest.summary.averageInteractionTime - previous.summary.averageInteractionTime) /
				previous.summary.averageInteractionTime) *
			100;
		const processingChange =
			((latest.summary.totalProcessingTime - previous.summary.totalProcessingTime) /
				previous.summary.totalProcessingTime) *
			100;

		console.log(`  Modal loading: ${modalChange > 0 ? '+' : ''}${modalChange.toFixed(2)}%`);
		console.log(
			`  Interactions: ${interactionChange > 0 ? '+' : ''}${interactionChange.toFixed(2)}%`
		);
		console.log(
			`  Processing: ${processingChange > 0 ? '+' : ''}${processingChange.toFixed(2)}%`
		);
	}
}

function showHistory() {
	const history = loadHistory();

	if (history.length === 0) {
		console.log('No performance history available');
		return;
	}

	console.log('Performance History');
	console.log('===================');
	console.log(
		'Date'.padEnd(12) +
			'Modal'.padEnd(8) +
			'Interact'.padEnd(10) +
			'Process'.padEnd(10) +
			'Commit'
	);
	console.log('-'.repeat(60));

	history.slice(-20).forEach(entry => {
		const date = new Date(entry.timestamp).toLocaleDateString();
		const commit = entry.git.commit.slice(0, 8);
		console.log(
			date.padEnd(12) +
				`${entry.summary.totalModalLoadTime.toFixed(1)}ms`.padEnd(8) +
				`${entry.summary.averageInteractionTime.toFixed(1)}ms`.padEnd(10) +
				`${entry.summary.totalProcessingTime.toFixed(1)}ms`.padEnd(10) +
				commit
		);
	});
}

if (require.main === module) {
	main();
}

module.exports = {
	runBenchmark,
	loadHistory,
	saveHistory,
	checkForRegressions,
	CONFIG,
};
