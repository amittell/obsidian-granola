#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Coverage Monitor
 *
 * Tracks test coverage changes over time and generates trending reports.
 * Integrates with Jest coverage data to provide historical tracking.
 */

const COVERAGE_HISTORY_FILE = path.join(__dirname, '..', 'monitoring', 'coverage-history.json');
const COVERAGE_FINAL_JSON = path.join(__dirname, '..', 'coverage', 'coverage-final.json');

// Configuration
const CONFIG = {
	// Minimum coverage thresholds (matching Jest config)
	MINIMUM_COVERAGE: {
		branches: 70,
		functions: 70,
		lines: 70,
		statements: 70,
	},
	// Alert if coverage drops by more than this percentage
	REGRESSION_THRESHOLD_PERCENT: 5,
	// Maximum number of history entries to keep
	MAX_HISTORY_ENTRIES: 100,
};

/**
 * Get current coverage statistics
 */
function getCurrentCoverage() {
	try {
		if (!fs.existsSync(COVERAGE_FINAL_JSON)) {
			throw new Error('Coverage data not found. Run "npm run test:coverage" first.');
		}

		const coverageData = JSON.parse(fs.readFileSync(COVERAGE_FINAL_JSON, 'utf8'));

		// Calculate overall coverage percentages
		const totals = Object.values(coverageData).reduce(
			(acc, file) => {
				// Count covered/uncovered statements
				if (file.s) {
					const statementCounts = Object.values(file.s);
					const totalStatements = statementCounts.length;
					const coveredStatements = statementCounts.filter(count => count > 0).length;
					acc.statements.total += totalStatements;
					acc.statements.covered += coveredStatements;
				}

				// Count covered/uncovered functions
				if (file.f) {
					const functionCounts = Object.values(file.f);
					const totalFunctions = functionCounts.length;
					const coveredFunctions = functionCounts.filter(count => count > 0).length;
					acc.functions.total += totalFunctions;
					acc.functions.covered += coveredFunctions;
				}

				// Count covered/uncovered branches
				if (file.b) {
					const branchCounts = Object.values(file.b);
					for (const branchSet of branchCounts) {
						if (Array.isArray(branchSet)) {
							const totalBranches = branchSet.length;
							const coveredBranches = branchSet.filter(count => count > 0).length;
							acc.branches.total += totalBranches;
							acc.branches.covered += coveredBranches;
						}
					}
				}

				// For lines, we need to count from statement map
				if (file.statementMap && file.s) {
					const lines = new Set();
					Object.entries(file.statementMap).forEach(([statementId, statementInfo]) => {
						if (statementInfo.start && statementInfo.start.line) {
							lines.add(statementInfo.start.line);
						}
					});
					const totalLines = lines.size;
					const coveredLines = Object.entries(file.s)
						.filter(([statementId, count]) => {
							const statementInfo = file.statementMap[statementId];
							return (
								count > 0 &&
								statementInfo &&
								statementInfo.start &&
								statementInfo.start.line
							);
						})
						.map(([statementId]) => {
							const statementInfo = file.statementMap[statementId];
							return statementInfo.start.line;
						});
					const uniqueCoveredLines = new Set(coveredLines).size;
					acc.lines.total += totalLines;
					acc.lines.covered += uniqueCoveredLines;
				}

				return acc;
			},
			{
				lines: { total: 0, covered: 0 },
				functions: { total: 0, covered: 0 },
				statements: { total: 0, covered: 0 },
				branches: { total: 0, covered: 0 },
			}
		);

		const coverage = {
			timestamp: new Date().toISOString(),
			lines: totals.lines.total > 0 ? (totals.lines.covered / totals.lines.total) * 100 : 0,
			functions:
				totals.functions.total > 0
					? (totals.functions.covered / totals.functions.total) * 100
					: 0,
			statements:
				totals.statements.total > 0
					? (totals.statements.covered / totals.statements.total) * 100
					: 0,
			branches:
				totals.branches.total > 0
					? (totals.branches.covered / totals.branches.total) * 100
					: 0,
			totals,
			files: Object.keys(coverageData).length,
			git: getCurrentGitInfo(),
		};

		// Calculate overall score (average of all metrics)
		coverage.overall =
			(coverage.lines + coverage.functions + coverage.statements + coverage.branches) / 4;

		return coverage;
	} catch (error) {
		console.error('Error getting coverage stats:', error.message);
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
 * Load coverage history
 */
function loadHistory() {
	try {
		if (fs.existsSync(COVERAGE_HISTORY_FILE)) {
			return JSON.parse(fs.readFileSync(COVERAGE_HISTORY_FILE, 'utf8'));
		}
	} catch (error) {
		console.warn('Could not load coverage history:', error.message);
	}
	return [];
}

/**
 * Save coverage history
 */
function saveHistory(history) {
	try {
		// Ensure monitoring directory exists
		const monitoringDir = path.dirname(COVERAGE_HISTORY_FILE);
		if (!fs.existsSync(monitoringDir)) {
			fs.mkdirSync(monitoringDir, { recursive: true });
		}

		// Limit history size
		if (history.length > CONFIG.MAX_HISTORY_ENTRIES) {
			history = history.slice(-CONFIG.MAX_HISTORY_ENTRIES);
		}

		fs.writeFileSync(COVERAGE_HISTORY_FILE, JSON.stringify(history, null, 2));
	} catch (error) {
		console.error('Error saving coverage history:', error.message);
	}
}

/**
 * Check for coverage regressions
 */
function checkForRegressions(current, history) {
	const issues = [];

	// Check against minimum thresholds
	Object.entries(CONFIG.MINIMUM_COVERAGE).forEach(([metric, threshold]) => {
		if (current[metric] < threshold) {
			issues.push(`${metric}: ${current[metric].toFixed(2)}% (below minimum ${threshold}%)`);
		}
	});

	// Check for regressions compared to previous run
	if (history.length > 0) {
		const previous = history[history.length - 1];

		Object.keys(CONFIG.MINIMUM_COVERAGE).forEach(metric => {
			const change = current[metric] - previous[metric];
			const percentChange = Math.abs(change);

			if (change < 0 && percentChange > CONFIG.REGRESSION_THRESHOLD_PERCENT) {
				issues.push(
					`${metric}: dropped by ${percentChange.toFixed(2)}% (${current[metric].toFixed(2)}% → ${previous[metric].toFixed(2)}%)`
				);
			}
		});
	}

	return {
		hasRegressions: issues.length > 0,
		issues,
		message:
			issues.length > 0
				? `🚨 COVERAGE REGRESSIONS DETECTED!\n${issues.join('\n')}`
				: `✅ Coverage checks passed: ${current.overall.toFixed(2)}% overall coverage`,
	};
}

/**
 * Generate coverage trend report
 */
function generateTrendReport(current, history) {
	if (history.length === 0) {
		return {
			current,
			trend: 'No historical data available',
			statistics: {},
		};
	}

	const metrics = ['lines', 'functions', 'statements', 'branches', 'overall'];
	const trends = {};

	metrics.forEach(metric => {
		const values = history.map(entry => entry[metric]);
		const recent = values.slice(-5); // Last 5 entries

		const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
		const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
		const trend = recentAvg > avg ? 'improving' : recentAvg < avg ? 'declining' : 'stable';

		trends[metric] = {
			current: current[metric],
			average: avg,
			recentAverage: recentAvg,
			trend,
			min: Math.min(...values),
			max: Math.max(...values),
		};
	});

	return {
		current,
		trends,
		history: history.slice(-10),
		statistics: {
			totalEntries: history.length,
			timespan:
				history.length > 0
					? {
							start: history[0].timestamp,
							end: history[history.length - 1].timestamp,
						}
					: null,
		},
	};
}

/**
 * Generate coverage dashboard HTML
 */
function generateDashboard(report) {
	const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Coverage Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; min-width: 150px; }
        .metric.good { border-color: #4CAF50; background-color: #f1f8e9; }
        .metric.warning { border-color: #FF9800; background-color: #fff3e0; }
        .metric.poor { border-color: #f44336; background-color: #ffebee; }
        .metric-name { font-weight: bold; font-size: 14px; }
        .metric-value { font-size: 24px; margin: 5px 0; }
        .metric-trend { font-size: 12px; color: #666; }
        .history { margin-top: 30px; }
        .history table { width: 100%; border-collapse: collapse; }
        .history th, .history td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        .history th { background-color: #f5f5f5; }
    </style>
</head>
<body>
    <h1>Test Coverage Dashboard</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <h2>Current Coverage</h2>
    <div class="metrics">
        ${Object.entries(report.trends)
			.map(([metric, data]) => {
				const className =
					data.current >= 70 ? 'good' : data.current >= 50 ? 'warning' : 'poor';
				return `
                <div class="metric ${className}">
                    <div class="metric-name">${metric.charAt(0).toUpperCase() + metric.slice(1)}</div>
                    <div class="metric-value">${data.current.toFixed(1)}%</div>
                    <div class="metric-trend">Trend: ${data.trend}</div>
                </div>
            `;
			})
			.join('')}
    </div>
    
    <div class="history">
        <h2>Recent History</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Lines</th>
                    <th>Functions</th>
                    <th>Statements</th>
                    <th>Branches</th>
                    <th>Overall</th>
                    <th>Commit</th>
                </tr>
            </thead>
            <tbody>
                ${report.history
					.map(
						entry => `
                    <tr>
                        <td>${new Date(entry.timestamp).toLocaleDateString()}</td>
                        <td>${entry.lines.toFixed(1)}%</td>
                        <td>${entry.functions.toFixed(1)}%</td>
                        <td>${entry.statements.toFixed(1)}%</td>
                        <td>${entry.branches.toFixed(1)}%</td>
                        <td>${entry.overall.toFixed(1)}%</td>
                        <td>${entry.git.commit.slice(0, 8)}</td>
                    </tr>
                `
					)
					.join('')}
            </tbody>
        </table>
    </div>
</body>
</html>
    `;

	const dashboardPath = path.join(__dirname, '..', 'monitoring', 'coverage-dashboard.html');
	fs.writeFileSync(dashboardPath, html);
	console.log(`Coverage dashboard generated: ${dashboardPath}`);
}

/**
 * Main execution function
 */
function main() {
	const args = process.argv.slice(2);
	const command = args[0] || 'track';

	switch (command) {
		case 'track':
			trackCoverage();
			break;
		case 'check':
			checkRegressions();
			break;
		case 'report':
			showReport();
			break;
		case 'dashboard':
			generateDashboardCommand();
			break;
		case 'history':
			showHistory();
			break;
		default:
			console.log(`
Coverage Monitor

Commands:
  track      - Record current coverage (default)
  check      - Check for regressions and exit with error code if found
  report     - Show detailed coverage trend report
  dashboard  - Generate HTML coverage dashboard
  history    - Show coverage history

Configuration:
  Minimum thresholds: ${JSON.stringify(CONFIG.MINIMUM_COVERAGE)}
  Regression threshold: ${CONFIG.REGRESSION_THRESHOLD_PERCENT}%
  History file: ${COVERAGE_HISTORY_FILE}
            `);
	}
}

function trackCoverage() {
	const current = getCurrentCoverage();
	if (!current) {
		process.exit(1);
	}

	const history = loadHistory();
	const regression = checkForRegressions(current, history);

	console.log(regression.message);

	// Add current stats to history
	history.push(current);
	saveHistory(history);

	if (regression.hasRegressions && process.env.CI) {
		console.error('\nCoverage regression detected in CI environment');
		process.exit(1);
	}
}

function checkRegressions() {
	const current = getCurrentCoverage();
	if (!current) {
		process.exit(1);
	}

	const history = loadHistory();
	const regression = checkForRegressions(current, history);

	console.log(regression.message);

	if (regression.hasRegressions) {
		process.exit(1);
	}
}

function showReport() {
	const current = getCurrentCoverage();
	if (!current) {
		process.exit(1);
	}

	const history = loadHistory();
	const report = generateTrendReport(current, history);

	console.log('Coverage Trend Report');
	console.log('====================');
	console.log(`Overall: ${report.current.overall.toFixed(2)}%`);
	console.log(`Lines: ${report.current.lines.toFixed(2)}%`);
	console.log(`Functions: ${report.current.functions.toFixed(2)}%`);
	console.log(`Statements: ${report.current.statements.toFixed(2)}%`);
	console.log(`Branches: ${report.current.branches.toFixed(2)}%`);
	console.log(`Files: ${report.current.files}`);
	console.log(`Git: ${report.current.git.branch}@${report.current.git.commit.slice(0, 8)}`);

	if (Object.keys(report.trends).length > 0) {
		console.log('\nTrends:');
		Object.entries(report.trends).forEach(([metric, data]) => {
			console.log(
				`  ${metric}: ${data.trend} (avg: ${data.average.toFixed(2)}%, recent: ${data.recentAverage.toFixed(2)}%)`
			);
		});
	}
}

function generateDashboardCommand() {
	const current = getCurrentCoverage();
	if (!current) {
		process.exit(1);
	}

	const history = loadHistory();
	const report = generateTrendReport(current, history);
	generateDashboard(report);
}

function showHistory() {
	const history = loadHistory();

	if (history.length === 0) {
		console.log('No coverage history available');
		return;
	}

	console.log('Coverage History');
	console.log('================');
	console.log(
		'Date'.padEnd(12) +
			'Overall'.padEnd(10) +
			'Lines'.padEnd(8) +
			'Functions'.padEnd(11) +
			'Statements'.padEnd(12) +
			'Branches'.padEnd(10) +
			'Commit'
	);
	console.log('-'.repeat(80));

	history.slice(-20).forEach(entry => {
		const date = new Date(entry.timestamp).toLocaleDateString();
		const commit = entry.git.commit.slice(0, 8);
		console.log(
			date.padEnd(12) +
				`${entry.overall.toFixed(1)}%`.padEnd(10) +
				`${entry.lines.toFixed(1)}%`.padEnd(8) +
				`${entry.functions.toFixed(1)}%`.padEnd(11) +
				`${entry.statements.toFixed(1)}%`.padEnd(12) +
				`${entry.branches.toFixed(1)}%`.padEnd(10) +
				commit
		);
	});
}

if (require.main === module) {
	main();
}

module.exports = {
	getCurrentCoverage,
	loadHistory,
	saveHistory,
	checkForRegressions,
	generateTrendReport,
	CONFIG,
};
