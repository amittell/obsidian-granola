#!/usr/bin/env node

/**
 * CI Monitoring Integration
 *
 * Integrates all monitoring systems for CI/CD pipelines.
 * Provides unified reporting and regression detection for automated builds.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import monitoring modules
const bundleTracker = require('./bundle-size-tracker');
const coverageMonitor = require('./coverage-monitor');
const performanceBenchmark = require('./performance-benchmark');

/**
 * Configuration for CI monitoring
 */
const CI_CONFIG = {
	// Exit codes
	SUCCESS: 0,
	BUNDLE_REGRESSION: 1,
	COVERAGE_REGRESSION: 2,
	PERFORMANCE_REGRESSION: 3,
	GENERAL_ERROR: 4,

	// Reporting
	REPORT_FILE: path.join(__dirname, '..', 'monitoring', 'ci-report.json'),
	SUMMARY_FILE: path.join(__dirname, '..', 'monitoring', 'ci-summary.md'),
};

/**
 * Run all monitoring checks
 */
async function runAllChecks() {
	const results = {
		timestamp: new Date().toISOString(),
		git: getCurrentGitInfo(),
		checks: {
			bundle: { status: 'pending', data: null, error: null },
			coverage: { status: 'pending', data: null, error: null },
			performance: { status: 'pending', data: null, error: null },
		},
		summary: {
			passed: 0,
			failed: 0,
			total: 3,
		},
	};

	console.log('Running CI monitoring checks...\n');

	// Run bundle size check
	try {
		console.log('📦 Checking bundle size...');
		const bundleStats = bundleTracker.getCurrentBundleStats();
		if (bundleStats) {
			const bundleHistory = bundleTracker.loadHistory();
			const bundleRegression = bundleTracker.checkForRegressions(bundleStats, bundleHistory);

			results.checks.bundle = {
				status: bundleRegression.hasRegression ? 'failed' : 'passed',
				data: { stats: bundleStats, regression: bundleRegression },
				error: null,
			};

			if (bundleRegression.hasRegression) {
				console.log(`   ❌ ${bundleRegression.message}`);
				results.summary.failed++;
			} else {
				console.log(`   ✅ ${bundleRegression.message}`);
				results.summary.passed++;
			}
		} else {
			throw new Error('Failed to get bundle statistics');
		}
	} catch (error) {
		console.log(`   ❌ Bundle check failed: ${error.message}`);
		results.checks.bundle = {
			status: 'error',
			data: null,
			error: error.message,
		};
		results.summary.failed++;
	}

	// Run coverage check
	try {
		console.log('\n📊 Checking test coverage...');
		const coverageStats = coverageMonitor.getCurrentCoverage();
		if (coverageStats) {
			const coverageHistory = coverageMonitor.loadHistory();
			const coverageRegression = coverageMonitor.checkForRegressions(
				coverageStats,
				coverageHistory
			);

			results.checks.coverage = {
				status: coverageRegression.hasRegressions ? 'failed' : 'passed',
				data: { stats: coverageStats, regression: coverageRegression },
				error: null,
			};

			if (coverageRegression.hasRegressions) {
				console.log(`   ❌ ${coverageRegression.message}`);
				results.summary.failed++;
			} else {
				console.log(`   ✅ ${coverageRegression.message}`);
				results.summary.passed++;
			}
		} else {
			throw new Error('Failed to get coverage statistics');
		}
	} catch (error) {
		console.log(`   ❌ Coverage check failed: ${error.message}`);
		results.checks.coverage = {
			status: 'error',
			data: null,
			error: error.message,
		};
		results.summary.failed++;
	}

	// Run performance check
	try {
		console.log('\n⚡ Checking performance benchmarks...');
		const perfResults = await performanceBenchmark.runBenchmark();
		if (perfResults) {
			const perfHistory = performanceBenchmark.loadHistory();
			const perfRegression = performanceBenchmark.checkForRegressions(
				perfResults,
				perfHistory
			);

			results.checks.performance = {
				status: perfRegression.hasRegressions ? 'failed' : 'passed',
				data: { stats: perfResults, regression: perfRegression },
				error: null,
			};

			if (perfRegression.hasRegressions) {
				console.log(`   ❌ ${perfRegression.message}`);
				results.summary.failed++;
			} else {
				console.log(`   ✅ ${perfRegression.message}`);
				results.summary.passed++;
			}
		} else {
			throw new Error('Failed to run performance benchmarks');
		}
	} catch (error) {
		console.log(`   ❌ Performance check failed: ${error.message}`);
		results.checks.performance = {
			status: 'error',
			data: null,
			error: error.message,
		};
		results.summary.failed++;
	}

	return results;
}

/**
 * Generate CI report files
 */
function generateReports(results) {
	try {
		// Ensure monitoring directory exists
		const monitoringDir = path.dirname(CI_CONFIG.REPORT_FILE);
		if (!fs.existsSync(monitoringDir)) {
			fs.mkdirSync(monitoringDir, { recursive: true });
		}

		// Generate JSON report
		fs.writeFileSync(CI_CONFIG.REPORT_FILE, JSON.stringify(results, null, 2));

		// Generate Markdown summary
		const summary = generateMarkdownSummary(results);
		fs.writeFileSync(CI_CONFIG.SUMMARY_FILE, summary);

		console.log(`\n📄 Reports generated:`);
		console.log(`   JSON: ${CI_CONFIG.REPORT_FILE}`);
		console.log(`   Markdown: ${CI_CONFIG.SUMMARY_FILE}`);
	} catch (error) {
		console.error('Error generating reports:', error.message);
	}
}

/**
 * Generate Markdown summary report
 */
function generateMarkdownSummary(results) {
	const { checks, summary, git } = results;

	let markdown = `# CI Monitoring Report\n\n`;
	markdown += `**Generated:** ${new Date(results.timestamp).toLocaleString()}\n`;
	markdown += `**Git:** ${git.branch}@${git.commit.slice(0, 8)}\n`;
	markdown += `**Commit:** ${git.message}\n\n`;

	// Summary
	markdown += `## Summary\n\n`;
	markdown += `- ✅ **Passed:** ${summary.passed}/${summary.total}\n`;
	markdown += `- ❌ **Failed:** ${summary.failed}/${summary.total}\n`;
	markdown += `- **Status:** ${summary.failed === 0 ? '🟢 All checks passed' : '🔴 Some checks failed'}\n\n`;

	// Bundle size check
	markdown += `## 📦 Bundle Size\n\n`;
	if (checks.bundle.status === 'passed') {
		const { stats, regression } = checks.bundle.data;
		markdown += `✅ **Status:** Passed\n`;
		markdown += `- **Size:** ${stats.bundleSize} bytes\n`;
		markdown += `- **Files:** ${stats.fileCount}\n`;
		markdown += `- **Compression:** ${(stats.compressionRatio * 100).toFixed(2)}%\n`;
		if (regression.sizeDiff !== undefined) {
			const direction = regression.sizeDiff > 0 ? 'increased' : 'decreased';
			markdown += `- **Change:** ${direction} by ${Math.abs(regression.sizeDiff)} bytes (${regression.percentChange.toFixed(2)}%)\n`;
		}
	} else {
		markdown += `❌ **Status:** ${checks.bundle.status}\n`;
		if (checks.bundle.error) {
			markdown += `- **Error:** ${checks.bundle.error}\n`;
		}
		if (checks.bundle.data?.regression) {
			markdown += `- **Issues:** ${checks.bundle.data.regression.message}\n`;
		}
	}
	markdown += `\n`;

	// Coverage check
	markdown += `## 📊 Test Coverage\n\n`;
	if (checks.coverage.status === 'passed') {
		const { stats } = checks.coverage.data;
		markdown += `✅ **Status:** Passed\n`;
		markdown += `- **Overall:** ${stats.overall.toFixed(2)}%\n`;
		markdown += `- **Lines:** ${stats.lines.toFixed(2)}%\n`;
		markdown += `- **Functions:** ${stats.functions.toFixed(2)}%\n`;
		markdown += `- **Statements:** ${stats.statements.toFixed(2)}%\n`;
		markdown += `- **Branches:** ${stats.branches.toFixed(2)}%\n`;
		markdown += `- **Files:** ${stats.files}\n`;
	} else {
		markdown += `❌ **Status:** ${checks.coverage.status}\n`;
		if (checks.coverage.error) {
			markdown += `- **Error:** ${checks.coverage.error}\n`;
		}
		if (checks.coverage.data?.regression?.issues) {
			markdown += `- **Issues:**\n`;
			checks.coverage.data.regression.issues.forEach(issue => {
				markdown += `  - ${issue}\n`;
			});
		}
	}
	markdown += `\n`;

	// Performance check
	markdown += `## ⚡ Performance\n\n`;
	if (checks.performance.status === 'passed') {
		const { stats } = checks.performance.data;
		markdown += `✅ **Status:** Passed\n`;
		markdown += `- **Modal Loading:** ${stats.summary.totalModalLoadTime.toFixed(2)}ms\n`;
		markdown += `- **Interactions:** ${stats.summary.averageInteractionTime.toFixed(2)}ms\n`;
		markdown += `- **Processing:** ${stats.summary.totalProcessingTime.toFixed(2)}ms\n`;
	} else {
		markdown += `❌ **Status:** ${checks.performance.status}\n`;
		if (checks.performance.error) {
			markdown += `- **Error:** ${checks.performance.error}\n`;
		}
		if (checks.performance.data?.regression?.issues) {
			markdown += `- **Issues:**\n`;
			checks.performance.data.regression.issues.forEach(issue => {
				markdown += `  - ${issue}\n`;
			});
		}
	}
	markdown += `\n`;

	return markdown;
}

/**
 * Get current git information
 */
function getCurrentGitInfo() {
	try {
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
 * Update historical data for all monitoring systems
 */
async function updateHistoricalData() {
	console.log('Updating historical monitoring data...\n');

	try {
		// Update bundle size history
		const bundleStats = bundleTracker.getCurrentBundleStats();
		if (bundleStats) {
			const bundleHistory = bundleTracker.loadHistory();
			bundleHistory.push(bundleStats);
			bundleTracker.saveHistory(bundleHistory);
			console.log('✅ Bundle size history updated');
		}

		// Update coverage history
		const coverageStats = coverageMonitor.getCurrentCoverage();
		if (coverageStats) {
			const coverageHistory = coverageMonitor.loadHistory();
			coverageHistory.push(coverageStats);
			coverageMonitor.saveHistory(coverageHistory);
			console.log('✅ Coverage history updated');
		}

		// Update performance history
		const perfResults = await performanceBenchmark.runBenchmark();
		if (perfResults) {
			const perfHistory = performanceBenchmark.loadHistory();
			perfHistory.push(perfResults);
			performanceBenchmark.saveHistory(perfHistory);
			console.log('✅ Performance history updated');
		}

		console.log('\n📈 All historical data updated successfully');
	} catch (error) {
		console.error('Error updating historical data:', error.message);
		throw error;
	}
}

/**
 * Main execution function
 */
async function main() {
	const args = process.argv.slice(2);
	const command = args[0] || 'check';

	try {
		switch (command) {
			case 'check':
				await checkCommand();
				break;
			case 'update':
				await updateCommand();
				break;
			case 'report':
				await reportCommand();
				break;
			default:
				console.log(`
CI Monitoring Integration

Commands:
  check   - Run all monitoring checks and exit with appropriate code (default)
  update  - Update historical data for all monitoring systems
  report  - Generate comprehensive monitoring report

Exit codes:
  0 - All checks passed
  1 - Bundle size regression detected
  2 - Coverage regression detected  
  3 - Performance regression detected
  4 - General error occurred
                `);
		}
	} catch (error) {
		console.error('\nCI monitoring failed:', error.message);
		process.exit(CI_CONFIG.GENERAL_ERROR);
	}
}

async function checkCommand() {
	const results = await runAllChecks();
	generateReports(results);

	console.log(
		`\n📋 Final Result: ${results.summary.passed}/${results.summary.total} checks passed`
	);

	// Determine exit code based on which checks failed
	if (results.summary.failed === 0) {
		console.log('🎉 All monitoring checks passed!');
		process.exit(CI_CONFIG.SUCCESS);
	} else {
		// Exit with specific code for the first failure type encountered
		if (results.checks.bundle.status === 'failed') {
			process.exit(CI_CONFIG.BUNDLE_REGRESSION);
		} else if (results.checks.coverage.status === 'failed') {
			process.exit(CI_CONFIG.COVERAGE_REGRESSION);
		} else if (results.checks.performance.status === 'failed') {
			process.exit(CI_CONFIG.PERFORMANCE_REGRESSION);
		} else {
			process.exit(CI_CONFIG.GENERAL_ERROR);
		}
	}
}

async function updateCommand() {
	await updateHistoricalData();
}

async function reportCommand() {
	const results = await runAllChecks();
	generateReports(results);
	console.log('\n📊 Comprehensive monitoring report generated');
}

if (require.main === module) {
	main();
}

module.exports = {
	runAllChecks,
	generateReports,
	updateHistoricalData,
	CI_CONFIG,
};
