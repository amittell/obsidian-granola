#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Enhanced Security Audit
 *
 * Comprehensive security scanning including dependency vulnerabilities,
 * code analysis, and security best practices validation.
 */

const SECURITY_HISTORY_FILE = path.join(__dirname, '..', 'monitoring', 'security-history.json');

// Configuration
const CONFIG = {
	// Audit levels and thresholds
	AUDIT_LEVEL: 'moderate', // low, moderate, high, critical
	MAX_VULNERABILITIES: {
		critical: 0,
		high: 0,
		moderate: 5,
		low: 10,
	},
	// Security patterns to check in code
	SECURITY_PATTERNS: [
		{
			pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']*["']/gi,
			description: 'Potential hardcoded password',
			severity: 'high',
		},
		{
			pattern: /(?:api_key|apikey|secret)\s*[:=]\s*["'][^"']*["']/gi,
			description: 'Potential hardcoded API key or secret',
			severity: 'high',
		},
		{
			pattern: /eval\s*\(/gi,
			description: 'Use of eval() function',
			severity: 'moderate',
		},
		{
			pattern: /innerHTML\s*=\s*[^;]+['"]/gi,
			description: 'Direct innerHTML assignment (XSS risk)',
			severity: 'moderate',
		},
		{
			pattern: /document\.write\s*\(/gi,
			description: 'Use of document.write()',
			severity: 'low',
		},
	],
	// Files to scan for security issues
	SCAN_PATTERNS: ['src/**/*.ts', 'main.ts', '*.js'],
	// Files to exclude from security scan
	EXCLUDE_PATTERNS: ['node_modules/**', 'coverage/**', 'docs/**', 'tests/**', 'scripts/**'],
};

/**
 * Run npm security audit
 */
function runNpmAudit() {
	try {
		console.log('Running npm security audit...');

		// Run npm audit and capture output
		const auditResult = execSync('npm audit --json', {
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr to avoid noise
		});

		const auditData = JSON.parse(auditResult);

		return {
			success: true,
			vulnerabilities: auditData.vulnerabilities || {},
			metadata: auditData.metadata || {},
			summary: {
				total: auditData.metadata?.vulnerabilities?.total || 0,
				critical: auditData.metadata?.vulnerabilities?.critical || 0,
				high: auditData.metadata?.vulnerabilities?.high || 0,
				moderate: auditData.metadata?.vulnerabilities?.moderate || 0,
				low: auditData.metadata?.vulnerabilities?.low || 0,
				info: auditData.metadata?.vulnerabilities?.info || 0,
			},
		};
	} catch (error) {
		// npm audit returns non-zero exit code when vulnerabilities are found
		// Try to parse the output anyway
		try {
			const auditData = JSON.parse(error.stdout || '{}');
			if (auditData.metadata) {
				return {
					success: false,
					vulnerabilities: auditData.vulnerabilities || {},
					metadata: auditData.metadata || {},
					summary: {
						total: auditData.metadata.vulnerabilities?.total || 0,
						critical: auditData.metadata.vulnerabilities?.critical || 0,
						high: auditData.metadata.vulnerabilities?.high || 0,
						moderate: auditData.metadata.vulnerabilities?.moderate || 0,
						low: auditData.metadata.vulnerabilities?.low || 0,
						info: auditData.metadata.vulnerabilities?.info || 0,
					},
				};
			}
		} catch (parseError) {
			// Fallback error handling
		}

		return {
			success: false,
			error: error.message,
			vulnerabilities: {},
			metadata: {},
			summary: { total: 0, critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
		};
	}
}

/**
 * Scan source code for security patterns
 */
function scanSourceCode() {
	const issues = [];

	try {
		console.log('Scanning source code for security issues...');

		// Get list of files to scan
		const filesToScan = [];

		// Add main files
		if (fs.existsSync('main.ts')) filesToScan.push('main.ts');
		if (fs.existsSync('main.js')) filesToScan.push('main.js');

		// Add src directory files
		if (fs.existsSync('src')) {
			const scanSrcFiles = dir => {
				const files = fs.readdirSync(dir);
				files.forEach(file => {
					const filePath = path.join(dir, file);
					const stat = fs.statSync(filePath);

					if (stat.isDirectory()) {
						scanSrcFiles(filePath);
					} else if (file.endsWith('.ts') || file.endsWith('.js')) {
						filesToScan.push(filePath);
					}
				});
			};
			scanSrcFiles('src');
		}

		// Scan each file
		filesToScan.forEach(filePath => {
			try {
				const content = fs.readFileSync(filePath, 'utf8');

				CONFIG.SECURITY_PATTERNS.forEach(({ pattern, description, severity }) => {
					const matches = content.match(pattern);
					if (matches) {
						matches.forEach(match => {
							const lines = content.substring(0, content.indexOf(match)).split('\n');
							const lineNumber = lines.length;

							issues.push({
								file: filePath,
								line: lineNumber,
								severity,
								description,
								match: match.substring(0, 100), // Limit match length
							});
						});
					}
				});
			} catch (error) {
				console.warn(`Could not scan file ${filePath}: ${error.message}`);
			}
		});
	} catch (error) {
		console.error('Error scanning source code:', error.message);
	}

	return issues;
}

/**
 * Check dependency versions for known security issues
 */
function checkDependencyVersions() {
	const issues = [];

	try {
		console.log('Checking dependency versions...');

		const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
		const allDeps = {
			...(packageJson.dependencies || {}),
			...(packageJson.devDependencies || {}),
		};

		// Check for outdated dependencies
		try {
			const outdatedResult = execSync('npm outdated --json', {
				encoding: 'utf8',
				stdio: ['pipe', 'pipe', 'ignore'],
			});

			const outdatedData = JSON.parse(outdatedResult);

			Object.entries(outdatedData).forEach(([pkg, info]) => {
				if (info.type === 'devDependencies' || info.type === 'dependencies') {
					const currentMajor = parseInt(info.current.split('.')[0]);
					const wantedMajor = parseInt(info.wanted.split('.')[0]);
					const latestMajor = parseInt(info.latest.split('.')[0]);

					if (latestMajor > currentMajor + 1) {
						issues.push({
							package: pkg,
							severity: 'moderate',
							description: 'Dependency is significantly outdated',
							current: info.current,
							latest: info.latest,
						});
					}
				}
			});
		} catch (error) {
			// npm outdated returns non-zero exit code when outdated packages exist
			// This is expected behavior
		}
	} catch (error) {
		console.warn('Could not check dependency versions:', error.message);
	}

	return issues;
}

/**
 * Validate security configuration
 */
function validateSecurityConfig() {
	const issues = [];

	console.log('Validating security configuration...');

	// Check package.json for security-related settings
	try {
		const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

		// Check if audit script exists
		if (!packageJson.scripts || !packageJson.scripts.audit) {
			issues.push({
				type: 'config',
				severity: 'low',
				description: 'No audit script defined in package.json',
			});
		}

		// Check for security-related dependencies
		const securityDeps = ['helmet', 'cors', 'express-rate-limit'];
		const hasSecurity = securityDeps.some(
			dep =>
				(packageJson.dependencies && packageJson.dependencies[dep]) ||
				(packageJson.devDependencies && packageJson.devDependencies[dep])
		);

		if (
			!hasSecurity &&
			packageJson.dependencies &&
			Object.keys(packageJson.dependencies).some(dep => dep.includes('express'))
		) {
			issues.push({
				type: 'config',
				severity: 'moderate',
				description: 'Express detected but no security middleware found',
			});
		}
	} catch (error) {
		issues.push({
			type: 'config',
			severity: 'moderate',
			description: 'Could not validate package.json security configuration',
		});
	}

	// Check for security-sensitive files
	const sensitiveFiles = ['.env', '.env.local', '.env.production', 'config.json'];
	sensitiveFiles.forEach(file => {
		if (fs.existsSync(file)) {
			issues.push({
				type: 'config',
				severity: 'high',
				description: `Sensitive file found: ${file} (ensure it's in .gitignore)`,
			});
		}
	});

	return issues;
}

/**
 * Generate comprehensive security report
 */
function generateSecurityReport() {
	const timestamp = new Date().toISOString();
	const git = getCurrentGitInfo();

	console.log('Generating security audit report...');

	// Run all security checks
	const npmAudit = runNpmAudit();
	const codeIssues = scanSourceCode();
	const dependencyIssues = checkDependencyVersions();
	const configIssues = validateSecurityConfig();

	// Calculate overall security score
	let securityScore = 100;

	// Deduct points for vulnerabilities
	securityScore -= npmAudit.summary.critical * 20;
	securityScore -= npmAudit.summary.high * 10;
	securityScore -= npmAudit.summary.moderate * 5;
	securityScore -= npmAudit.summary.low * 1;

	// Deduct points for code issues
	codeIssues.forEach(issue => {
		switch (issue.severity) {
			case 'high':
				securityScore -= 10;
				break;
			case 'moderate':
				securityScore -= 5;
				break;
			case 'low':
				securityScore -= 1;
				break;
		}
	});

	// Deduct points for config issues
	configIssues.forEach(issue => {
		switch (issue.severity) {
			case 'high':
				securityScore -= 10;
				break;
			case 'moderate':
				securityScore -= 5;
				break;
			case 'low':
				securityScore -= 1;
				break;
		}
	});

	securityScore = Math.max(0, securityScore);

	const report = {
		timestamp,
		git,
		securityScore,
		npmAudit,
		codeIssues,
		dependencyIssues,
		configIssues,
		summary: {
			totalIssues:
				codeIssues.length +
				dependencyIssues.length +
				configIssues.length +
				npmAudit.summary.total,
			highSeverityCount:
				codeIssues.filter(i => i.severity === 'high').length +
				configIssues.filter(i => i.severity === 'high').length +
				npmAudit.summary.critical +
				npmAudit.summary.high,
			passed: securityScore >= 90,
		},
	};

	return report;
}

/**
 * Check if security audit passes thresholds
 */
function checkSecurityThresholds(report) {
	const issues = [];

	// Check vulnerability thresholds
	Object.entries(CONFIG.MAX_VULNERABILITIES).forEach(([severity, maxCount]) => {
		const actualCount = report.npmAudit.summary[severity] || 0;
		if (actualCount > maxCount) {
			issues.push(`Too many ${severity} vulnerabilities: ${actualCount} (max: ${maxCount})`);
		}
	});

	// Check high-severity code issues
	const highSeverityCodeIssues = report.codeIssues.filter(issue => issue.severity === 'high');
	if (highSeverityCodeIssues.length > 0) {
		issues.push(`${highSeverityCodeIssues.length} high-severity code security issues found`);
	}

	// Check high-severity config issues
	const highSeverityConfigIssues = report.configIssues.filter(issue => issue.severity === 'high');
	if (highSeverityConfigIssues.length > 0) {
		issues.push(`${highSeverityConfigIssues.length} high-severity configuration issues found`);
	}

	return {
		passed: issues.length === 0,
		issues,
		securityScore: report.securityScore,
	};
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
 * Load security audit history
 */
function loadHistory() {
	try {
		if (fs.existsSync(SECURITY_HISTORY_FILE)) {
			return JSON.parse(fs.readFileSync(SECURITY_HISTORY_FILE, 'utf8'));
		}
	} catch (error) {
		console.warn('Could not load security history:', error.message);
	}
	return [];
}

/**
 * Save security audit history
 */
function saveHistory(history) {
	try {
		const monitoringDir = path.dirname(SECURITY_HISTORY_FILE);
		if (!fs.existsSync(monitoringDir)) {
			fs.mkdirSync(monitoringDir, { recursive: true });
		}

		// Limit history size
		if (history.length > 50) {
			history = history.slice(-50);
		}

		fs.writeFileSync(SECURITY_HISTORY_FILE, JSON.stringify(history, null, 2));
	} catch (error) {
		console.error('Error saving security history:', error.message);
	}
}

/**
 * Main execution function
 */
async function main() {
	const args = process.argv.slice(2);
	const command = args[0] || 'audit';

	switch (command) {
		case 'audit':
			await runSecurityAudit();
			break;
		case 'check':
			await checkSecurity();
			break;
		case 'report':
			await showReport();
			break;
		case 'history':
			showHistory();
			break;
		default:
			console.log(`
Enhanced Security Audit

Commands:
  audit   - Run comprehensive security audit (default)
  check   - Check security and exit with error code if issues found
  report  - Show detailed security report
  history - Show security audit history

Configuration:
  Audit level: ${CONFIG.AUDIT_LEVEL}
  Max vulnerabilities: Critical(${CONFIG.MAX_VULNERABILITIES.critical}), High(${CONFIG.MAX_VULNERABILITIES.high}), Moderate(${CONFIG.MAX_VULNERABILITIES.moderate}), Low(${CONFIG.MAX_VULNERABILITIES.low})
            `);
	}
}

async function runSecurityAudit() {
	const report = generateSecurityReport();
	const check = checkSecurityThresholds(report);

	console.log('\nSecurity Audit Results:');
	console.log('=======================');
	console.log(`Security Score: ${report.securityScore}/100`);
	console.log(`Total Issues: ${report.summary.totalIssues}`);
	console.log(`High Severity: ${report.summary.highSeverityCount}`);
	console.log(`Status: ${check.passed ? '✅ PASSED' : '❌ FAILED'}`);

	if (report.npmAudit.summary.total > 0) {
		console.log('\nDependency Vulnerabilities:');
		console.log(`  Critical: ${report.npmAudit.summary.critical}`);
		console.log(`  High: ${report.npmAudit.summary.high}`);
		console.log(`  Moderate: ${report.npmAudit.summary.moderate}`);
		console.log(`  Low: ${report.npmAudit.summary.low}`);
	}

	if (report.codeIssues.length > 0) {
		console.log(`\nCode Security Issues: ${report.codeIssues.length}`);
		report.codeIssues.slice(0, 5).forEach(issue => {
			console.log(
				`  ${issue.severity.toUpperCase()}: ${issue.description} in ${issue.file}:${issue.line}`
			);
		});
		if (report.codeIssues.length > 5) {
			console.log(`  ... and ${report.codeIssues.length - 5} more issues`);
		}
	}

	if (!check.passed) {
		console.log('\nSecurity Issues:');
		check.issues.forEach(issue => console.log(`  • ${issue}`));
	}

	// Save to history
	const history = loadHistory();
	history.push(report);
	saveHistory(history);

	if (!check.passed && process.env.CI) {
		console.error('\nSecurity audit failed in CI environment');
		process.exit(1);
	}
}

async function checkSecurity() {
	const report = generateSecurityReport();
	const check = checkSecurityThresholds(report);

	console.log(
		`Security check: ${check.passed ? '✅ PASSED' : '❌ FAILED'} (Score: ${report.securityScore}/100)`
	);

	if (!check.passed) {
		check.issues.forEach(issue => console.log(`  • ${issue}`));
		process.exit(1);
	}
}

async function showReport() {
	const history = loadHistory();

	if (history.length === 0) {
		console.log('No security audit history available. Run audit first.');
		return;
	}

	const latest = history[history.length - 1];

	console.log('Security Audit Report');
	console.log('=====================');
	console.log(`Date: ${new Date(latest.timestamp).toLocaleString()}`);
	console.log(`Git: ${latest.git.branch}@${latest.git.commit.slice(0, 8)}`);
	console.log(`Security Score: ${latest.securityScore}/100`);
	console.log('');
	console.log('Dependency Vulnerabilities:');
	console.log(`  Critical: ${latest.npmAudit.summary.critical}`);
	console.log(`  High: ${latest.npmAudit.summary.high}`);
	console.log(`  Moderate: ${latest.npmAudit.summary.moderate}`);
	console.log(`  Low: ${latest.npmAudit.summary.low}`);
	console.log('');
	console.log(`Code Issues: ${latest.codeIssues.length}`);
	console.log(`Config Issues: ${latest.configIssues.length}`);
	console.log(`Dependency Issues: ${latest.dependencyIssues.length}`);
}

function showHistory() {
	const history = loadHistory();

	if (history.length === 0) {
		console.log('No security audit history available');
		return;
	}

	console.log('Security Audit History');
	console.log('======================');
	console.log('Date'.padEnd(12) + 'Score'.padEnd(8) + 'Issues'.padEnd(8) + 'Commit');
	console.log('-'.repeat(50));

	history.slice(-20).forEach(entry => {
		const date = new Date(entry.timestamp).toLocaleDateString();
		const commit = entry.git.commit.slice(0, 8);
		console.log(
			date.padEnd(12) +
				`${entry.securityScore}/100`.padEnd(8) +
				`${entry.summary.totalIssues}`.padEnd(8) +
				commit
		);
	});
}

if (require.main === module) {
	main();
}

module.exports = {
	generateSecurityReport,
	checkSecurityThresholds,
	loadHistory,
	saveHistory,
	CONFIG,
};
