#!/usr/bin/env node

/**
 * Test script to debug ProseMirror validation logic.
 * This checks if isValidProseMirrorDoc is too strict and rejecting valid documents.
 */

console.log('🧪 Testing ProseMirror Validation Logic\n');

/**
 * Replicate the isValidProseMirrorDoc method from the converter
 */
function isValidProseMirrorDoc(doc) {
	console.log(`\n--- Testing document validation ---`);
	console.log(`Document:`, JSON.stringify(doc, null, 2));

	if (!doc) {
		console.log(`❌ ProseMirror doc is null/undefined`);
		return false;
	}

	if (doc.type !== 'doc') {
		console.log(`❌ ProseMirror doc has invalid type: ${doc.type}`);
		return false;
	}

	if (!doc.content || !Array.isArray(doc.content)) {
		console.log(`❌ ProseMirror doc has no content array`);
		return false;
	}

	if (doc.content.length === 0) {
		console.log(`❌ ProseMirror doc has empty content array`);
		return false;
	}

	// Check if content contains any meaningful nodes (not just empty paragraphs)
	const hasMeaningfulContent = doc.content.some(node => {
		console.log(`  - Checking node type: ${node.type}`);
		if (node.type === 'paragraph') {
			// Check if paragraph has content
			const hasContent =
				node.content &&
				node.content.length > 0 &&
				node.content.some(child => {
					console.log(`    - Child: ${child.type}, text: "${child.text || ''}"`);
					return child.text && child.text.trim().length > 0;
				});
			console.log(`    - Paragraph has content: ${hasContent}`);
			return hasContent;
		}
		// Other node types (headings, lists, etc.) are considered meaningful
		console.log(`    - Non-paragraph node considered meaningful`);
		return true;
	});

	if (!hasMeaningfulContent) {
		console.log(`❌ ProseMirror doc has no meaningful content`);
		return false;
	}

	console.log(`✅ ProseMirror doc validation passed`);
	return true;
}

// Test case 1: Valid document with text
const validDoc = {
	type: 'doc',
	content: [
		{
			type: 'paragraph',
			content: [{ type: 'text', text: 'This is a valid document.' }],
		},
	],
};

console.log('Test 1: Valid document with text');
const result1 = isValidProseMirrorDoc(validDoc);
console.log(`Result: ${result1 ? '✅ VALID' : '❌ INVALID'}`);

// Test case 2: Document with empty paragraph
const emptyParagraphDoc = {
	type: 'doc',
	content: [
		{
			type: 'paragraph',
			content: [],
		},
	],
};

console.log('\nTest 2: Document with empty paragraph');
const result2 = isValidProseMirrorDoc(emptyParagraphDoc);
console.log(`Result: ${result2 ? '✅ VALID' : '❌ INVALID'}`);

// Test case 3: Document with paragraph containing only whitespace
const whitespaceDoc = {
	type: 'doc',
	content: [
		{
			type: 'paragraph',
			content: [{ type: 'text', text: '   ' }],
		},
	],
};

console.log('\nTest 3: Document with whitespace-only text');
const result3 = isValidProseMirrorDoc(whitespaceDoc);
console.log(`Result: ${result3 ? '✅ VALID' : '❌ INVALID'}`);

// Test case 4: Document with heading (should be valid)
const headingDoc = {
	type: 'doc',
	content: [
		{
			type: 'heading',
			attrs: { level: 1 },
			content: [{ type: 'text', text: 'Meeting Notes' }],
		},
	],
};

console.log('\nTest 4: Document with heading');
const result4 = isValidProseMirrorDoc(headingDoc);
console.log(`Result: ${result4 ? '✅ VALID' : '❌ INVALID'}`);

// Test case 5: Document with mixed content including empty paragraph
const mixedDoc = {
	type: 'doc',
	content: [
		{
			type: 'paragraph',
			content: [], // Empty paragraph
		},
		{
			type: 'paragraph',
			content: [{ type: 'text', text: 'This has content.' }],
		},
	],
};

console.log('\nTest 5: Document with mixed content (empty + filled paragraphs)');
const result5 = isValidProseMirrorDoc(mixedDoc);
console.log(`Result: ${result5 ? '✅ VALID' : '❌ INVALID'}`);

// Test case 6: Document with only non-paragraph nodes
const listDoc = {
	type: 'doc',
	content: [
		{
			type: 'bulletList',
			content: [
				{
					type: 'listItem',
					content: [
						{
							type: 'paragraph',
							content: [{ type: 'text', text: 'List item' }],
						},
					],
				},
			],
		},
	],
};

console.log('\nTest 6: Document with bullet list');
const result6 = isValidProseMirrorDoc(listDoc);
console.log(`Result: ${result6 ? '✅ VALID' : '❌ INVALID'}`);

// Test case 7: Granola-specific structure (might be different from standard ProseMirror)
const granolaStyleDoc = {
	type: 'doc',
	content: [
		{
			type: 'title', // Custom node type that Granola might use
			content: [{ type: 'text', text: 'Meeting Title' }],
		},
		{
			type: 'content', // Custom content wrapper
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Meeting content here.' }],
				},
			],
		},
	],
};

console.log('\nTest 7: Granola-style document structure');
const result7 = isValidProseMirrorDoc(granolaStyleDoc);
console.log(`Result: ${result7 ? '✅ VALID' : '❌ INVALID'}`);

// Test case 8: Document with only empty content
const emptyContentDoc = {
	type: 'doc',
	content: [],
};

console.log('\nTest 8: Document with no content array items');
const result8 = isValidProseMirrorDoc(emptyContentDoc);
console.log(`Result: ${result8 ? '✅ VALID' : '❌ INVALID'}`);

// Test case 9: Document with paragraph that has no content property
const noContentPropertyDoc = {
	type: 'doc',
	content: [
		{
			type: 'paragraph',
			// No content property
		},
	],
};

console.log('\nTest 9: Document with paragraph missing content property');
const result9 = isValidProseMirrorDoc(noContentPropertyDoc);
console.log(`Result: ${result9 ? '✅ VALID' : '❌ INVALID'}`);

console.log('\n🎯 Analysis:');
console.log('The validation logic might be too strict if it rejects documents that:');
console.log('1. Have empty paragraphs but other meaningful content');
console.log('2. Use custom node types that Granola might employ');
console.log('3. Have different content structures than expected');
console.log('\nIf real Granola documents are being rejected, the validation should be relaxed.');

const results = [result1, result2, result3, result4, result5, result6, result7, result8, result9];
const validCount = results.filter(r => r).length;
console.log(`\nSummary: ${validCount}/${results.length} test cases passed validation`);

if (validCount < results.length - 2) {
	// Allow 2 failures for truly invalid cases
	console.log('⚠️  WARNING: Validation appears to be too strict!');
	console.log('Consider relaxing validation to allow more document structures.');
} else {
	console.log('✅ Validation logic appears reasonable.');
}
