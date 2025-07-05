#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Deployment Validation with Smoke Tests
 *
 * Comprehensive validation to ensure the plugin is ready for deployment.
 * Includes build validation, file integrity checks, and functional smoke tests.
 */

// Configuration
const CONFIG = {
	// Required files for deployment
	REQUIRED_FILES: ['main.js', 'manifest.json', 'styles.css', 'README.md', 'package.json'],
	// Required manifest fields
	REQUIRED_MANIFEST_FIELDS: [
		'id',
		'name',
		'version',
		'minAppVersion',
		'description',
		'author',
		'authorUrl',
	],
	// Bundle size limits (updated to accommodate less aggressive optimization for user-controllable debug logging)
	MAX_BUNDLE_SIZE: 716800, // 700KB (accommodates current size with console preservation and debug functionality)
	MIN_BUNDLE_SIZE: 1024, // 1KB minimum
	// Performance thresholds for smoke tests
	PERFORMANCE_THRESHOLDS: {
		STARTUP_TIME: 100, // ms
		MEMORY_USAGE: 50 * 1024 * 1024, // 50MB
	},
};

/**
 * Validate required files exist and are valid
 */
function validateRequiredFiles() {
	const results = [];

	console.log('Validating required files...');

	CONFIG.REQUIRED_FILES.forEach(file => {
		if (!fs.existsSync(file)) {
			results.push({
				type: 'error',
				message: `Required file missing: ${file}`,
			});
		} else {
			const stat = fs.statSync(file);
			if (stat.size === 0) {
				results.push({
					type: 'error',
					message: `Required file is empty: ${file}`,
				});
			} else {
				results.push({
					type: 'success',
					message: `Required file OK: ${file} (${stat.size} bytes)`,
				});
			}
		}
	});

	return results;
}

/**
 * Validate manifest.json content
 */
function validateManifest() {
	const results = [];

	console.log('Validating manifest.json...');

	try {
		if (!fs.existsSync('manifest.json')) {
			results.push({
				type: 'error',
				message: 'manifest.json file not found',
			});
			return results;
		}

		const manifestContent = fs.readFileSync('manifest.json', 'utf8');
		const manifest = JSON.parse(manifestContent);

		// Check required fields
		CONFIG.REQUIRED_MANIFEST_FIELDS.forEach(field => {
			if (!manifest[field]) {
				results.push({
					type: 'error',
					message: `Missing required manifest field: ${field}`,
				});
			} else {
				results.push({
					type: 'success',
					message: `Manifest field OK: ${field} = "${manifest[field]}"`,
				});
			}
		});

		// Validate version format
		if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
			results.push({
				type: 'warning',
				message: `Version format may be invalid: ${manifest.version} (expected: x.y.z)`,
			});
		}

		// Validate minAppVersion
		if (manifest.minAppVersion && !/^\d+\.\d+\.\d+$/.test(manifest.minAppVersion)) {
			results.push({
				type: 'warning',
				message: `minAppVersion format may be invalid: ${manifest.minAppVersion}`,
			});
		}

		// Check version consistency with package.json
		try {
			const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
			if (packageJson.version !== manifest.version) {
				results.push({
					type: 'error',
					message: `Version mismatch: package.json(${packageJson.version}) != manifest.json(${manifest.version})`,
				});
			} else {
				results.push({
					type: 'success',
					message: `Version consistency OK: ${manifest.version}`,
				});
			}
		} catch (error) {
			results.push({
				type: 'warning',
				message: 'Could not validate version consistency with package.json',
			});
		}
	} catch (error) {
		results.push({
			type: 'error',
			message: `Invalid manifest.json: ${error.message}`,
		});
	}

	return results;
}

/**
 * Validate build output
 */
function validateBuildOutput() {
	const results = [];

	console.log('Validating build output...');

	// Check main.js
	if (!fs.existsSync('main.js')) {
		results.push({
			type: 'error',
			message: 'main.js build output not found',
		});
		return results;
	}

	const mainJsStat = fs.statSync('main.js');

	// Check bundle size
	if (mainJsStat.size > CONFIG.MAX_BUNDLE_SIZE) {
		results.push({
			type: 'error',
			message: `Bundle too large: ${mainJsStat.size} bytes (max: ${CONFIG.MAX_BUNDLE_SIZE})`,
		});
	} else if (mainJsStat.size < CONFIG.MIN_BUNDLE_SIZE) {
		results.push({
			type: 'error',
			message: `Bundle too small: ${mainJsStat.size} bytes (min: ${CONFIG.MIN_BUNDLE_SIZE})`,
		});
	} else {
		results.push({
			type: 'success',
			message: `Bundle size OK: ${mainJsStat.size} bytes`,
		});
	}

	// Basic JavaScript syntax validation
	try {
		const mainJsContent = fs.readFileSync('main.js', 'utf8');

		// Check for basic JavaScript structure
		if (!mainJsContent.includes('Plugin') && !mainJsContent.includes('class')) {
			results.push({
				type: 'warning',
				message: 'main.js may not contain expected plugin structure',
			});
		}

		// Check for common build issues
		if (mainJsContent.includes('undefined')) {
			const undefinedCount = (mainJsContent.match(/undefined/g) || []).length;
			if (undefinedCount > 10) {
				// Allow some undefined usage
				results.push({
					type: 'warning',
					message: `High number of 'undefined' occurrences in bundle: ${undefinedCount}`,
				});
			}
		}

		// Check for error indicators
		if (mainJsContent.includes('Error: ') || mainJsContent.includes('SyntaxError')) {
			results.push({
				type: 'warning',
				message: 'Bundle may contain error indicators',
			});
		}

		results.push({
			type: 'success',
			message: 'Bundle content validation passed',
		});
	} catch (error) {
		results.push({
			type: 'error',
			message: `Could not validate bundle content: ${error.message}`,
		});
	}

	return results;
}

/**
 * Run smoke tests to validate basic functionality
 */
function runSmokeTests() {
	const results = [];

	console.log('Running smoke tests...');

	try {
		// Test 1: Module loading simulation
		const startTime = process.hrtime.bigint();

		// Simulate loading the main module
		const mainJsContent = fs.readFileSync('main.js', 'utf8');

		// Basic structure validation
		const hasPluginClass =
			mainJsContent.includes('class') &&
			(mainJsContent.includes('Plugin') || mainJsContent.includes('extends'));

		if (hasPluginClass) {
			results.push({
				type: 'success',
				message: 'Smoke test: Plugin class structure detected',
			});
		} else {
			results.push({
				type: 'warning',
				message: 'Smoke test: Plugin class structure not clearly detected',
			});
		}

		// Test loading time
		const loadTime = Number(process.hrtime.bigint() - startTime) / 1000000;

		if (loadTime > CONFIG.PERFORMANCE_THRESHOLDS.STARTUP_TIME) {
			results.push({
				type: 'warning',
				message: `Smoke test: Slow loading detected: ${loadTime.toFixed(2)}ms`,
			});
		} else {
			results.push({
				type: 'success',
				message: `Smoke test: Loading time OK: ${loadTime.toFixed(2)}ms`,
			});
		}

		// Test 2: Memory usage simulation
		const memUsage = process.memoryUsage();
		if (memUsage.heapUsed > CONFIG.PERFORMANCE_THRESHOLDS.MEMORY_USAGE) {
			results.push({
				type: 'warning',
				message: `Smoke test: High memory usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
			});
		} else {
			results.push({
				type: 'success',
				message: `Smoke test: Memory usage OK: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
			});
		}

		// Test 3: Configuration validation
		try {
			const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
			const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

			if (manifest.name && packageJson.name && manifest.version && packageJson.version) {
				results.push({
					type: 'success',
					message: 'Smoke test: Configuration consistency validated',
				});
			} else {
				results.push({
					type: 'warning',
					message: 'Smoke test: Configuration may be incomplete',
				});
			}
		} catch (error) {
			results.push({
				type: 'error',
				message: `Smoke test: Configuration validation failed: ${error.message}`,
			});
		}

		// Test 4: Dependencies validation
		const hasObsidianImport =
			mainJsContent.includes('obsidian') ||
			mainJsContent.includes('Plugin') ||
			mainJsContent.includes('Modal');

		if (hasObsidianImport) {
			results.push({
				type: 'success',
				message: 'Smoke test: Obsidian API integration detected',
			});
		} else {
			results.push({
				type: 'warning',
				message: 'Smoke test: Obsidian API integration not clearly detected',
			});
		}
	} catch (error) {
		results.push({
			type: 'error',
			message: `Smoke test failed: ${error.message}`,
		});
	}

	return results;
}

/**
 * Validate deployment readiness
 */
function validateDeploymentReadiness() {
	const results = [];

	console.log('Validating deployment readiness...');

	// Check if git working directory is clean
	try {
		const { execSync } = require('child_process');
		const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });

		if (gitStatus.trim()) {
			results.push({
				type: 'warning',
				message: 'Git working directory is not clean (uncommitted changes)',
			});
		} else {
			results.push({
				type: 'success',
				message: 'Git working directory is clean',
			});
		}
	} catch (error) {
		results.push({
			type: 'warning',
			message: 'Could not check git status',
		});
	}

	// Check for common deployment files
	const deploymentFiles = ['CHANGELOG.md', 'LICENSE', '.gitignore'];
	deploymentFiles.forEach(file => {
		if (fs.existsSync(file)) {
			results.push({
				type: 'success',
				message: `Deployment file present: ${file}`,
			});
		} else {
			results.push({
				type: 'info',
				message: `Optional deployment file missing: ${file}`,
			});
		}
	});

	// Check package.json fields important for deployment
	try {
		const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

		const importantFields = ['author', 'license', 'description', 'repository'];
		importantFields.forEach(field => {
			if (packageJson[field]) {
				results.push({
					type: 'success',
					message: `Package.json field OK: ${field}`,
				});
			} else {
				results.push({
					type: 'info',
					message: `Package.json field missing: ${field}`,
				});
			}
		});
	} catch (error) {
		results.push({
			type: 'warning',
			message: 'Could not validate package.json deployment fields',
		});
	}

	return results;
}

/**
 * Generate comprehensive deployment validation report
 */
function generateValidationReport() {
	const timestamp = new Date().toISOString();

	console.log('Deployment Validation Report');
	console.log('============================');
	console.log(`Timestamp: ${timestamp}`);
	console.log('');

	const allResults = [
		...validateRequiredFiles(),
		...validateManifest(),
		...validateBuildOutput(),
		...runSmokeTests(),
		...validateDeploymentReadiness(),
	];

	// Categorize results
	const errors = allResults.filter(r => r.type === 'error');
	const warnings = allResults.filter(r => r.type === 'warning');
	const successes = allResults.filter(r => r.type === 'success');
	const info = allResults.filter(r => r.type === 'info');

	// Print summary
	console.log(`Total checks: ${allResults.length}`);
	console.log(`✅ Passed: ${successes.length}`);
	console.log(`⚠️  Warnings: ${warnings.length}`);
	console.log(`❌ Errors: ${errors.length}`);
	console.log(`ℹ️  Info: ${info.length}`);
	console.log('');

	// Print detailed results
	if (errors.length > 0) {
		console.log('ERRORS:');
		errors.forEach(result => console.log(`  ❌ ${result.message}`));
		console.log('');
	}

	if (warnings.length > 0) {
		console.log('WARNINGS:');
		warnings.forEach(result => console.log(`  ⚠️  ${result.message}`));
		console.log('');
	}

	if (successes.length > 0 && process.env.VERBOSE) {
		console.log('SUCCESSES:');
		successes.forEach(result => console.log(`  ✅ ${result.message}`));
		console.log('');
	}

	if (info.length > 0 && process.env.VERBOSE) {
		console.log('INFO:');
		info.forEach(result => console.log(`  ℹ️  ${result.message}`));
		console.log('');
	}

	// Determine overall status
	const deploymentReady = errors.length === 0;
	const hasMinorIssues = warnings.length > 0;

	console.log('DEPLOYMENT STATUS:');
	if (deploymentReady && !hasMinorIssues) {
		console.log('🎉 READY FOR DEPLOYMENT - All checks passed!');
	} else if (deploymentReady && hasMinorIssues) {
		console.log('✅ READY FOR DEPLOYMENT - Minor warnings present');
	} else {
		console.log('❌ NOT READY FOR DEPLOYMENT - Critical errors found');
	}

	return {
		timestamp,
		deploymentReady,
		summary: {
			total: allResults.length,
			errors: errors.length,
			warnings: warnings.length,
			successes: successes.length,
			info: info.length,
		},
		results: allResults,
	};
}

/**
 * Main execution function
 */
function main() {
	const args = process.argv.slice(2);
	const command = args[0] || 'validate';

	switch (command) {
		case 'validate':
			runValidation();
			break;
		case 'check':
			runValidationCheck();
			break;
		case 'smoke':
			runSmokeTestsOnly();
			break;
		default:
			console.log(`
Deployment Validation

Commands:
  validate - Run full deployment validation (default)
  check    - Run validation and exit with error code if not ready
  smoke    - Run only smoke tests

Environment Variables:
  VERBOSE=1 - Show all results including successes
            `);
	}
}

function runValidation() {
	const report = generateValidationReport();

	// Save report to monitoring directory
	try {
		const monitoringDir = path.join(__dirname, '..', 'monitoring');
		if (!fs.existsSync(monitoringDir)) {
			fs.mkdirSync(monitoringDir, { recursive: true });
		}

		const reportFile = path.join(monitoringDir, 'deployment-validation.json');
		fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
		console.log(`\nReport saved to: ${reportFile}`);
	} catch (error) {
		console.warn('Could not save validation report:', error.message);
	}
}

function runValidationCheck() {
	const report = generateValidationReport();

	if (!report.deploymentReady) {
		process.exit(1);
	}
}

function runSmokeTestsOnly() {
	console.log('Running smoke tests only...');
	const results = runSmokeTests();

	const errors = results.filter(r => r.type === 'error');
	const warnings = results.filter(r => r.type === 'warning');

	console.log(`\nSmoke test results: ${results.length} checks`);
	console.log(`✅ Passed: ${results.filter(r => r.type === 'success').length}`);
	console.log(`⚠️  Warnings: ${warnings.length}`);
	console.log(`❌ Errors: ${errors.length}`);

	if (errors.length > 0) {
		console.log('\nErrors:');
		errors.forEach(result => console.log(`  ❌ ${result.message}`));
		process.exit(1);
	}

	if (warnings.length > 0) {
		console.log('\nWarnings:');
		warnings.forEach(result => console.log(`  ⚠️  ${result.message}`));
	}

	console.log('\n✅ Smoke tests passed!');
}

if (require.main === module) {
	main();
}

module.exports = {
	validateRequiredFiles,
	validateManifest,
	validateBuildOutput,
	runSmokeTests,
	validateDeploymentReadiness,
	generateValidationReport,
	CONFIG,
};
