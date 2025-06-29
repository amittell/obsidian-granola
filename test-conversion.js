#!/usr/bin/env node

/**
 * Test script for ProseMirror to Markdown conversion
 * This tests the conversion logic with known test data to identify issues
 */

const fs = require('fs');
const path = require('path');

// Load test data
const testData = JSON.parse(fs.readFileSync('test-prosemirror-data.json', 'utf8'));

// Import debug converter
const { DebugConverter } = require('./debug-granola-issues.js');

function runConversionTests() {
	console.log('🧪 ProseMirror Conversion Test Suite');
	console.log('====================================\n');

	const converter = new DebugConverter();
	const testCases = Object.entries(testData);

	let passed = 0;
	let failed = 0;

	for (const [testName, document] of testCases) {
		console.log(`\n${'─'.repeat(50)}`);
		console.log(`TEST: ${testName}`);
		console.log(`${'─'.repeat(50)}`);

		try {
			const result = converter.convertDocument(document);

			// Validate results
			const validations = validateConversionResult(document, result, testName);

			if (validations.allPassed) {
				console.log('✅ TEST PASSED');
				passed++;
			} else {
				console.log('❌ TEST FAILED');
				console.log('Failed validations:', validations.failures);
				failed++;
			}

			// Write output for inspection
			const outputFile = `test-output-${testName}.md`;
			fs.writeFileSync(outputFile, result.content);
			console.log(`📄 Output written to: ${outputFile}`);
		} catch (error) {
			console.error('❌ TEST ERROR:', error.message);
			failed++;
		}
	}

	console.log('\n' + '='.repeat(50));
	console.log('TEST SUMMARY');
	console.log('='.repeat(50));
	console.log(`✅ Passed: ${passed}`);
	console.log(`❌ Failed: ${failed}`);
	console.log(`📊 Total: ${passed + failed}`);

	if (failed === 0) {
		console.log('\n🎉 All tests passed! Conversion logic is working correctly.');
	} else {
		console.log('\n⚠️  Some tests failed. Check the output files and logs above for details.');
	}
}

function validateConversionResult(document, result, testName) {
	const failures = [];

	// Test 1: Filename should be date-prefixed
	if (!result.filename.match(/^\d{4}-\d{2}-\d{2} - .+\.md$/)) {
		failures.push(`Filename not date-prefixed: "${result.filename}"`);
	}

	// Test 2: Content should include frontmatter
	if (!result.content.includes('---') || !result.content.includes('source: Granola')) {
		failures.push('Missing or invalid frontmatter');
	}

	// Test 3: Content source validation based on test case
	switch (testName) {
		case 'validDocumentWithContent':
			if (result.contentSource !== 'prosemirror') {
				failures.push(`Expected prosemirror source, got: ${result.contentSource}`);
			}
			if (!result.content.includes('# Team Sync - June 21, 2025')) {
				failures.push('Missing expected heading content');
			}
			if (!result.content.includes('- Project status updates')) {
				failures.push('Missing expected list content');
			}
			break;

		case 'emptyProseMirrorDoc':
			if (result.contentSource !== 'none') {
				failures.push(`Expected empty content, got source: ${result.contentSource}`);
			}
			if (!result.content.includes('*No content available for this document.*')) {
				failures.push('Missing "no content" placeholder');
			}
			break;

		case 'invalidProseMirrorDoc':
			if (result.contentSource !== 'plain') {
				failures.push(`Expected plain text fallback, got: ${result.contentSource}`);
			}
			if (!result.content.includes('This document has actual plain text content')) {
				failures.push('Missing plain text fallback content');
			}
			break;

		case 'fallbackToMarkdown':
			if (result.contentSource !== 'markdown') {
				failures.push(`Expected markdown fallback, got: ${result.contentSource}`);
			}
			if (!result.content.includes('# Fallback Test')) {
				failures.push('Missing markdown fallback content');
			}
			break;

		case 'onlyPlainTextAvailable':
			if (result.contentSource !== 'plain') {
				failures.push(`Expected plain text only, got: ${result.contentSource}`);
			}
			if (!result.content.includes('Only plain text is available')) {
				failures.push('Missing plain text content');
			}
			break;

		case 'complexProseMirrorDoc':
			if (result.contentSource !== 'prosemirror') {
				failures.push(`Expected prosemirror conversion, got: ${result.contentSource}`);
			}
			if (!result.content.includes('# 1:1 Meeting - Alex & Shannon')) {
				failures.push('Missing heading conversion');
			}
			if (!result.content.includes('1. Q3 project roadmap')) {
				failures.push('Missing ordered list conversion');
			}
			if (!result.content.includes('*June 21, 2025*')) {
				failures.push('Missing italic text conversion');
			}
			if (!result.content.includes('`automated testing`')) {
				failures.push('Missing code formatting conversion');
			}
			// Test special characters in filename
			if (!result.filename.includes('2025-06-21 - Alex  Shannon 1-1')) {
				failures.push(`Filename sanitization issue: "${result.filename}"`);
			}
			break;
	}

	return {
		allPassed: failures.length === 0,
		failures,
	};
}

function analyzeCommonIssues() {
	console.log('\n🔍 ISSUE ANALYSIS');
	console.log('=================\n');

	console.log('Based on the test results, here are the most likely root causes:\n');

	console.log('**Issue 1: Date-prefixed filenames**');
	console.log('- ✅ Implementation appears correct');
	console.log('- ✅ Test data shows proper "YYYY-MM-DD - Title" format');
	console.log('- 🤔 Possible causes if still not working:');
	console.log('  - User running old version of plugin');
	console.log('  - Edge case with invalid dates');
	console.log('  - Timezone conversion issues');
	console.log('');

	console.log('**Issue 2: Missing note content**');
	console.log('- 🔍 Check if API returns different structure than expected');
	console.log('- 🔍 Verify ProseMirror validation logic');
	console.log('- 🔍 Test with real API data (not just mock data)');
	console.log('- 🤔 Possible causes:');
	console.log('  - API response format changed');
	console.log('  - ProseMirror nodes have unexpected structure');
	console.log('  - Content fields are null/empty in API response');
	console.log('  - Validation logic too strict');
	console.log('');

	console.log('**Next Steps:**');
	console.log('1. Run debug script with real Granola API data');
	console.log('2. Compare API response structure with expected interface');
	console.log('3. Check if recent Granola updates changed content format');
	console.log('4. Test with various document types (new, old, edited, etc.)');
}

if (require.main === module) {
	runConversionTests();
	analyzeCommonIssues();
}
