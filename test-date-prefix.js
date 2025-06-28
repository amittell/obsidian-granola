#!/usr/bin/env node

/**
 * Test script to verify date-prefix filename generation is working correctly.
 * This addresses the user's concern about duplicate filenames for recurring meetings.
 */

// Mock Granola document for testing
const mockGranolaDocument = {
    id: 'test-doc-123',
    title: 'Alex <> Shannon 1:1',
    created_at: '2025-06-21T14:30:00.000Z',
    updated_at: '2025-06-21T15:00:00.000Z',
    user_id: 'user-456',
    notes: {
        type: 'doc',
        content: [
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'This is a test meeting note.' }
                ]
            }
        ]
    },
    notes_plain: 'This is a test meeting note.',
    notes_markdown: 'This is a test meeting note.'
};

/**
 * Test the date-prefix filename generation logic directly
 */
function testDatePrefixGeneration() {
    console.log('🧪 Testing Date-Prefix Filename Generation\n');
    
    // Test case 1: Normal date
    const testDoc1 = {
        ...mockGranolaDocument,
        title: 'Alex <> Shannon 1:1',
        created_at: '2025-06-21T14:30:00.000Z'
    };
    
    const expectedFilename1 = '2025-06-21 - Alex  Shannon 1-1.md';
    const actualFilename1 = generateDatePrefixedFilename(testDoc1);
    
    console.log(`Test 1 - Normal date:`);
    console.log(`  Input title: "${testDoc1.title}"`);
    console.log(`  Input date: ${testDoc1.created_at}`);
    console.log(`  Expected: ${expectedFilename1}`);
    console.log(`  Actual: ${actualFilename1}`);
    console.log(`  Result: ${actualFilename1 === expectedFilename1 ? '✅ PASS' : '❌ FAIL'}\n`);
    
    // Test case 2: Different date
    const testDoc2 = {
        ...mockGranolaDocument,
        title: 'Weekly Team Standup',
        created_at: '2025-01-15T09:00:00.000Z'
    };
    
    const expectedFilename2 = '2025-01-15 - Weekly Team Standup.md';
    const actualFilename2 = generateDatePrefixedFilename(testDoc2);
    
    console.log(`Test 2 - Different date:`);
    console.log(`  Input title: "${testDoc2.title}"`);
    console.log(`  Input date: ${testDoc2.created_at}`);
    console.log(`  Expected: ${expectedFilename2}`);
    console.log(`  Actual: ${actualFilename2}`);
    console.log(`  Result: ${actualFilename2 === expectedFilename2 ? '✅ PASS' : '❌ FAIL'}\n`);
    
    // Test case 3: Invalid date
    const testDoc3 = {
        ...mockGranolaDocument,
        title: 'Test Document',
        created_at: 'invalid-date'
    };
    
    const expectedFilename3 = 'INVALID-DATE - Test Document.md';
    const actualFilename3 = generateDatePrefixedFilename(testDoc3);
    
    console.log(`Test 3 - Invalid date:`);
    console.log(`  Input title: "${testDoc3.title}"`);
    console.log(`  Input date: ${testDoc3.created_at}`);
    console.log(`  Expected: ${expectedFilename3}`);
    console.log(`  Actual: ${actualFilename3}`);
    console.log(`  Result: ${actualFilename3 === expectedFilename3 ? '✅ PASS' : '❌ FAIL'}\n`);
    
    // Test case 4: Special characters in title
    const testDoc4 = {
        ...mockGranolaDocument,
        title: 'Project "Update" & Review: <Important>',
        created_at: '2025-12-31T23:59:59.000Z'
    };
    
    const expectedFilename4 = '2025-12-31 - Project -Update- - Review- -Important-.md';
    const actualFilename4 = generateDatePrefixedFilename(testDoc4);
    
    console.log(`Test 4 - Special characters:`);
    console.log(`  Input title: "${testDoc4.title}"`);
    console.log(`  Input date: ${testDoc4.created_at}`);
    console.log(`  Expected: ${expectedFilename4}`);
    console.log(`  Actual: ${actualFilename4}`);
    console.log(`  Result: ${actualFilename4 === expectedFilename4 ? '✅ PASS' : '❌ FAIL'}\n`);
    
    // Test multiple documents with same title but different dates
    console.log('🔄 Testing Recurring Meeting Scenario:');
    const recurringMeetings = [
        { ...mockGranolaDocument, title: 'Weekly 1:1', created_at: '2025-06-07T10:00:00.000Z' },
        { ...mockGranolaDocument, title: 'Weekly 1:1', created_at: '2025-06-14T10:00:00.000Z' },
        { ...mockGranolaDocument, title: 'Weekly 1:1', created_at: '2025-06-21T10:00:00.000Z' },
        { ...mockGranolaDocument, title: 'Weekly 1:1', created_at: '2025-06-28T10:00:00.000Z' }
    ];
    
    const generatedFilenames = recurringMeetings.map(generateDatePrefixedFilename);
    const uniqueFilenames = new Set(generatedFilenames);
    
    generatedFilenames.forEach((filename, index) => {
        console.log(`  Week ${index + 1}: ${filename}`);
    });
    
    console.log(`\nRecurring Meeting Test Result: ${uniqueFilenames.size === generatedFilenames.length ? '✅ ALL UNIQUE' : '❌ DUPLICATES FOUND'}`);
    console.log(`Generated ${generatedFilenames.length} filenames, ${uniqueFilenames.size} unique\n`);
}

/**
 * Replicate the date-prefix filename generation logic from the converter
 */
function generateDatePrefixedFilename(doc) {
    // Extract date from created_at timestamp
    let datePrefix = '';
    try {
        const createdDate = new Date(doc.created_at);
        if (isNaN(createdDate.getTime())) {
            console.warn(`Invalid created_at date: ${doc.created_at}`);
            datePrefix = 'INVALID-DATE';
        } else {
            // Format as YYYY-MM-DD
            const year = createdDate.getFullYear();
            const month = (createdDate.getMonth() + 1).toString().padStart(2, '0');
            const day = createdDate.getDate().toString().padStart(2, '0');
            datePrefix = `${year}-${month}-${day}`;
        }
    } catch (error) {
        console.error(`Error parsing date: ${error}`);
        datePrefix = 'INVALID-DATE';
    }

    // Get sanitized title
    const title = doc.title || `Untitled-${doc.id}`;
    const sanitizedTitle = sanitizeFilename(title);

    // Combine date prefix with title and add extension
    return `${datePrefix} - ${sanitizedTitle}.md`;
}

/**
 * Replicate the filename sanitization logic from the converter
 */
function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100); // Match MAX_FILENAME_LENGTH from converter
}

// Run the tests
if (require.main === module) {
    testDatePrefixGeneration();
    
    console.log('🎯 Summary:');
    console.log('Date-prefix filename generation creates unique filenames for recurring meetings.');
    console.log('Format: "YYYY-MM-DD - Title.md" where special characters are sanitized.');
    console.log('This should resolve the duplicate filename issue the user reported.');
}