#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Bundle Size Tracker
 *
 * Tracks bundle size changes over time and detects regressions.
 * Stores historical data and provides regression detection with configurable thresholds.
 */

const BUNDLE_SIZE_HISTORY_FILE = path.join(
	__dirname,
	'..',
	'monitoring',
	'bundle-size-history.json'
);
const MAIN_JS_PATH = path.join(__dirname, '..', 'main.js');
const META_JSON_PATH = path.join(__dirname, '..', 'meta.json');

// Configuration
const CONFIG = {
	// Alert if bundle size increases by more than this percentage
	REGRESSION_THRESHOLD_PERCENT: 5,
	// Alert if bundle size increases by more than this many bytes
	REGRESSION_THRESHOLD_BYTES: 1024,
	// Maximum number of history entries to keep
	MAX_HISTORY_ENTRIES: 100,
};

/**
 * Get current bundle statistics
 */
function getCurrentBundleStats() {
	try {
		// Get main bundle size
		const mainJsStats = fs.statSync(MAIN_JS_PATH);
		const bundleSize = mainJsStats.size;

		// Get metadata if available
		let inputSize = 0;
		let fileCount = 0;

		if (fs.existsSync(META_JSON_PATH)) {
			const meta = JSON.parse(fs.readFileSync(META_JSON_PATH, 'utf8'));
			inputSize = Object.values(meta.inputs).reduce((acc, i) => acc + (i.bytes || 0), 0);
			fileCount = Object.keys(meta.inputs).length;
		}

		return {
			timestamp: new Date().toISOString(),
			bundleSize,
			inputSize,
			fileCount,
			compressionRatio: inputSize > 0 ? 1 - bundleSize / inputSize : 0,
			git: getCurrentGitInfo(),
		};
	} catch (error) {
		console.error('Error getting bundle stats:', error.message);
		return null;
	}
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
 * Load bundle size history
 */
function loadHistory() {
	try {
		if (fs.existsSync(BUNDLE_SIZE_HISTORY_FILE)) {
			return JSON.parse(fs.readFileSync(BUNDLE_SIZE_HISTORY_FILE, 'utf8'));
		}
	} catch (error) {
		console.warn('Could not load bundle size history:', error.message);
	}
	return [];
}

/**
 * Save bundle size history
 */
function saveHistory(history) {
	try {
		// Ensure monitoring directory exists
		const monitoringDir = path.dirname(BUNDLE_SIZE_HISTORY_FILE);
		if (!fs.existsSync(monitoringDir)) {
			fs.mkdirSync(monitoringDir, { recursive: true });
		}

		// Limit history size
		if (history.length > CONFIG.MAX_HISTORY_ENTRIES) {
			history = history.slice(-CONFIG.MAX_HISTORY_ENTRIES);
		}

		fs.writeFileSync(BUNDLE_SIZE_HISTORY_FILE, JSON.stringify(history, null, 2));
	} catch (error) {
		console.error('Error saving bundle size history:', error.message);
	}
}

/**
 * Check for bundle size regressions
 */
function checkForRegressions(current, history) {
	if (history.length === 0) {
		return { hasRegression: false, message: 'No previous data for comparison' };
	}

	// Get the most recent entry for comparison
	const previous = history[history.length - 1];
	const sizeDiff = current.bundleSize - previous.bundleSize;
	const percentChange = (sizeDiff / previous.bundleSize) * 100;

	const hasRegression =
		sizeDiff > CONFIG.REGRESSION_THRESHOLD_BYTES ||
		percentChange > CONFIG.REGRESSION_THRESHOLD_PERCENT;

	let message = `Bundle size: ${current.bundleSize} bytes`;

	if (sizeDiff !== 0) {
		const changeDirection = sizeDiff > 0 ? 'increased' : 'decreased';
		message += ` (${changeDirection} by ${Math.abs(sizeDiff)} bytes, ${percentChange.toFixed(2)}%)`;
	}

	if (hasRegression) {
		message =
			`🚨 BUNDLE SIZE REGRESSION DETECTED!\n${message}\n` +
			`Previous: ${previous.bundleSize} bytes\n` +
			`Threshold: ${CONFIG.REGRESSION_THRESHOLD_BYTES} bytes or ${CONFIG.REGRESSION_THRESHOLD_PERCENT}%`;
	}

	return { hasRegression, message, sizeDiff, percentChange };
}

/**
 * Generate bundle size report
 */
function generateReport(current, history) {
	const report = {
		current,
		history: history.slice(-10), // Last 10 entries
		statistics: {
			totalEntries: history.length,
			averageSize:
				history.length > 0
					? Math.round(
							history.reduce((sum, entry) => sum + entry.bundleSize, 0) /
								history.length
						)
					: 0,
			minSize: history.length > 0 ? Math.min(...history.map(entry => entry.bundleSize)) : 0,
			maxSize: history.length > 0 ? Math.max(...history.map(entry => entry.bundleSize)) : 0,
		},
	};

	if (history.length > 1) {
		const first = history[0];
		const totalChange = current.bundleSize - first.bundleSize;
		const totalPercentChange = (totalChange / first.bundleSize) * 100;

		report.statistics.totalChange = totalChange;
		report.statistics.totalPercentChange = totalPercentChange;
	}

	return report;
}

/**
 * Main execution function
 */
function main() {
	const args = process.argv.slice(2);
	const command = args[0] || 'track';

	switch (command) {
		case 'track':
			trackBundleSize();
			break;
		case 'check':
			checkRegressions();
			break;
		case 'report':
			showReport();
			break;
		case 'history':
			showHistory();
			break;
		default:
			console.log(`
Bundle Size Tracker

Commands:
  track    - Record current bundle size (default)
  check    - Check for regressions and exit with error code if found
  report   - Show detailed bundle size report
  history  - Show bundle size history

Configuration:
  Regression threshold: ${CONFIG.REGRESSION_THRESHOLD_BYTES} bytes or ${CONFIG.REGRESSION_THRESHOLD_PERCENT}%
  History file: ${BUNDLE_SIZE_HISTORY_FILE}
            `);
	}
}

function trackBundleSize() {
	const current = getCurrentBundleStats();
	if (!current) {
		process.exit(1);
	}

	const history = loadHistory();
	const regression = checkForRegressions(current, history);

	console.log(regression.message);

	// Add current stats to history
	history.push(current);
	saveHistory(history);

	if (regression.hasRegression && process.env.CI) {
		console.error('\nBundle size regression detected in CI environment');
		process.exit(1);
	}
}

function checkRegressions() {
	const current = getCurrentBundleStats();
	if (!current) {
		process.exit(1);
	}

	const history = loadHistory();
	const regression = checkForRegressions(current, history);

	console.log(regression.message);

	if (regression.hasRegression) {
		process.exit(1);
	}
}

function showReport() {
	const current = getCurrentBundleStats();
	if (!current) {
		process.exit(1);
	}

	const history = loadHistory();
	const report = generateReport(current, history);

	console.log('Bundle Size Report');
	console.log('==================');
	console.log(`Current size: ${report.current.bundleSize} bytes`);
	console.log(`Input size: ${report.current.inputSize} bytes`);
	console.log(`Compression: ${(report.current.compressionRatio * 100).toFixed(2)}%`);
	console.log(`Files: ${report.current.fileCount}`);
	console.log(`Git: ${report.current.git.branch}@${report.current.git.commit.slice(0, 8)}`);

	if (report.statistics.totalEntries > 0) {
		console.log('\nStatistics:');
		console.log(`  Total entries: ${report.statistics.totalEntries}`);
		console.log(`  Average size: ${report.statistics.averageSize} bytes`);
		console.log(`  Min size: ${report.statistics.minSize} bytes`);
		console.log(`  Max size: ${report.statistics.maxSize} bytes`);

		if (report.statistics.totalChange !== undefined) {
			const changeDirection = report.statistics.totalChange > 0 ? 'increased' : 'decreased';
			console.log(
				`  Total change: ${changeDirection} by ${Math.abs(report.statistics.totalChange)} bytes (${report.statistics.totalPercentChange.toFixed(2)}%)`
			);
		}
	}
}

function showHistory() {
	const history = loadHistory();

	if (history.length === 0) {
		console.log('No bundle size history available');
		return;
	}

	console.log('Bundle Size History');
	console.log('===================');

	history.slice(-20).forEach((entry, index) => {
		const date = new Date(entry.timestamp).toLocaleString();
		const commit = entry.git.commit.slice(0, 8);
		console.log(
			`${date} | ${entry.bundleSize.toString().padStart(6)} bytes | ${commit} | ${entry.git.message.slice(0, 50)}`
		);
	});
}

if (require.main === module) {
	main();
}

module.exports = {
	getCurrentBundleStats,
	loadHistory,
	saveHistory,
	checkForRegressions,
	generateReport,
	CONFIG,
};
