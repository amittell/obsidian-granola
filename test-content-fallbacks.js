#!/usr/bin/env node

/**
 * Test script to verify content fallback logic in the converter.
 * This tests if notes_markdown and notes_plain fallbacks work when ProseMirror fails.
 */

console.log('🧪 Testing Content Fallback Logic\n');

/**
 * Replicate the content conversion logic from convertDocument method
 */
function testContentConversion(doc, testName) {
    console.log(`\n--- ${testName} ---`);
    console.log(`Document structure:`, JSON.stringify(doc, null, 2));
    
    let markdown = '';
    let contentSource = 'unknown';

    // Try ProseMirror conversion first
    if (doc.notes && isValidProseMirrorDoc(doc.notes)) {
        markdown = convertProseMirrorToMarkdown(doc.notes);
        contentSource = 'prosemirror';
        console.log(`✅ ProseMirror conversion successful, length: ${markdown.length}`);
    } else {
        console.log(`❌ ProseMirror conversion failed or invalid`);
    }

    // Fallback to notes_markdown if ProseMirror conversion failed or is empty
    if (!markdown.trim() && doc.notes_markdown && doc.notes_markdown.trim()) {
        markdown = doc.notes_markdown.trim();
        contentSource = 'markdown';
        console.log(`✅ Using notes_markdown fallback, length: ${markdown.length}`);
    } else if (!markdown.trim()) {
        console.log(`❌ notes_markdown fallback not available or empty`);
    }

    // Final fallback to notes_plain if everything else failed
    if (!markdown.trim() && doc.notes_plain && doc.notes_plain.trim()) {
        markdown = doc.notes_plain.trim();
        contentSource = 'plain';
        console.log(`✅ Using notes_plain fallback, length: ${markdown.length}`);
    } else if (!markdown.trim()) {
        console.log(`❌ notes_plain fallback not available or empty`);
    }

    // Log final content status
    console.log(`Final content source: ${contentSource}`);
    console.log(`Final markdown length: ${markdown.length}`);
    console.log(`Content preview: "${markdown.substring(0, 100)}${markdown.length > 100 ? '...' : ''}"`);

    // Warn if no content was found
    if (!markdown.trim()) {
        console.log(`⚠️ WARNING: No content found for document`);
        markdown = `*No content available for this document.*\n\n*Document ID: ${doc.id}*`;
    }
    
    return { markdown, contentSource };
}

/**
 * Simplified ProseMirror validation
 */
function isValidProseMirrorDoc(doc) {
    if (!doc || doc.type !== 'doc' || !doc.content || !Array.isArray(doc.content) || doc.content.length === 0) {
        return false;
    }
    
    // Check for meaningful content
    const hasMeaningfulContent = doc.content.some(node => {
        if (node.type === 'paragraph') {
            return node.content && node.content.length > 0 && 
                   node.content.some(child => child.text && child.text.trim().length > 0);
        }
        return true;
    });
    
    return hasMeaningfulContent;
}

/**
 * Simplified ProseMirror to Markdown conversion
 */
function convertProseMirrorToMarkdown(doc) {
    if (!doc || !doc.content) return '';
    
    return doc.content.map(node => {
        if (node.type === 'paragraph' && node.content) {
            return node.content.map(child => child.text || '').join('');
        } else if (node.type === 'heading' && node.content) {
            const level = node.attrs?.level || 1;
            const text = node.content.map(child => child.text || '').join('');
            return '#'.repeat(level) + ' ' + text;
        }
        return '';
    }).join('\n\n');
}

// Test Case 1: Valid ProseMirror document
const validProseMirrorDoc = {
    id: 'test-1',
    title: 'Valid ProseMirror Document',
    notes: {
        type: 'doc',
        content: [
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'This is valid ProseMirror content.' }
                ]
            }
        ]
    },
    notes_markdown: 'This is markdown fallback content.',
    notes_plain: 'This is plain text fallback content.'
};

const result1 = testContentConversion(validProseMirrorDoc, 'Test 1: Valid ProseMirror');

// Test Case 2: Invalid ProseMirror with valid markdown fallback
const invalidProseMirrorDoc = {
    id: 'test-2',
    title: 'Invalid ProseMirror with Markdown',
    notes: {
        type: 'doc',
        content: []  // Empty content - should fail validation
    },
    notes_markdown: '# Meeting Notes\n\nThis content comes from markdown fallback.',
    notes_plain: 'Plain text version of the content.'
};

const result2 = testContentConversion(invalidProseMirrorDoc, 'Test 2: Invalid ProseMirror, Valid Markdown');

// Test Case 3: No ProseMirror, no markdown, but valid plain text
const plainTextOnlyDoc = {
    id: 'test-3',
    title: 'Plain Text Only',
    notes: null,
    notes_markdown: '',
    notes_plain: 'This is the only content available - plain text fallback.'
};

const result3 = testContentConversion(plainTextOnlyDoc, 'Test 3: Plain Text Only');

// Test Case 4: All content fields empty
const emptyDoc = {
    id: 'test-4',
    title: 'Empty Document',
    notes: null,
    notes_markdown: '',
    notes_plain: ''
};

const result4 = testContentConversion(emptyDoc, 'Test 4: All Fields Empty');

// Test Case 5: ProseMirror with only whitespace, markdown available
const whitespaceDoc = {
    id: 'test-5',
    title: 'Whitespace ProseMirror',
    notes: {
        type: 'doc',
        content: [
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: '   ' }  // Only whitespace
                ]
            }
        ]
    },
    notes_markdown: '# Actual Content\n\nThis is the real content from markdown.',
    notes_plain: 'Real content from plain text.'
};

const result5 = testContentConversion(whitespaceDoc, 'Test 5: Whitespace ProseMirror, Valid Markdown');

// Test Case 6: Real Granola-style document structure
const granolaStyleDoc = {
    id: 'test-6',
    title: 'Granola Meeting Notes',
    notes: {
        type: 'doc',
        content: [
            {
                type: 'title',  // Custom Granola node type
                content: [
                    { type: 'text', text: 'Weekly 1:1' }
                ]
            },
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'Discussed project status and next steps.' }
                ]
            }
        ]
    },
    notes_markdown: '# Weekly 1:1\n\nDiscussed project status and next steps.',
    notes_plain: 'Weekly 1:1\n\nDiscussed project status and next steps.'
};

const result6 = testContentConversion(granolaStyleDoc, 'Test 6: Granola-style Document');

console.log('\n🎯 Summary of Test Results:');
const results = [result1, result2, result3, result4, result5, result6];
results.forEach((result, index) => {
    const testNum = index + 1;
    const hasContent = result.markdown.trim().length > 0 && !result.markdown.includes('No content available');
    console.log(`Test ${testNum}: ${hasContent ? '✅' : '❌'} ${result.contentSource} (${result.markdown.length} chars)`);
});

const successfulTests = results.filter(r => r.markdown.trim().length > 0 && !r.markdown.includes('No content available')).length;
console.log(`\nOverall: ${successfulTests}/${results.length} tests produced content`);

console.log('\n🔍 Analysis:');
console.log('- If fallbacks are working correctly, tests 1-3 and 5-6 should produce content');
console.log('- Test 4 should fail (all empty) but show warning message');
console.log('- If ProseMirror validation is too strict, we should see more markdown/plain fallbacks');
console.log('- If user reports empty content, it suggests API fields are all empty or fallbacks are broken');