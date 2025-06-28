#!/usr/bin/env node

/**
 * API Response Inspector
 * This script fetches a small sample from the Granola API and inspects the actual response structure
 * to identify any discrepancies with the expected interface.
 */

async function inspectAPIResponse() {
    console.log('🔍 Granola API Response Inspector');
    console.log('=================================\n');
    
    const token = process.env.GRANOLA_TOKEN;
    if (!token) {
        console.error('❌ GRANOLA_TOKEN environment variable not set');
        console.log('\nTo use this script:');
        console.log('1. Export your Granola token: export GRANOLA_TOKEN="your-token-here"');
        console.log('2. Run this script: node inspect-api-response.js');
        return;
    }
    
    try {
        // Fetch a small sample
        console.log('📡 Fetching documents from Granola API...');
        const response = await fetch('https://api.granola.ai/v2/get-documents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'granola-debug/1.0.0',
            },
            body: JSON.stringify({ limit: 3, offset: 0 })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log('✅ API response received\n');
        
        // Analyze top-level structure
        console.log('📋 TOP-LEVEL RESPONSE STRUCTURE');
        console.log('================================');
        console.log('Response type:', typeof data);
        console.log('Response keys:', Object.keys(data));
        console.log('');
        
        if (data.docs) {
            console.log(`📄 Documents array: ${data.docs.length} items`);
        } else {
            console.log('❌ No "docs" field found in response');
        }
        
        if (data.deleted) {
            console.log(`🗑️  Deleted array: ${data.deleted.length} items`);
        } else {
            console.log('ℹ️  No "deleted" field found in response');
        }
        
        console.log('');
        
        if (!data.docs || data.docs.length === 0) {
            console.log('❌ No documents found to analyze');
            return;
        }
        
        // Analyze first document structure
        const firstDoc = data.docs[0];
        console.log('📝 FIRST DOCUMENT STRUCTURE');
        console.log('============================');
        console.log('Document keys:', Object.keys(firstDoc));
        console.log('');
        
        // Check required fields
        const requiredFields = ['id', 'title', 'created_at', 'updated_at'];
        const contentFields = ['notes', 'notes_plain', 'notes_markdown'];
        
        console.log('✅ REQUIRED FIELDS CHECK');
        for (const field of requiredFields) {
            const exists = field in firstDoc;
            const value = firstDoc[field];
            console.log(`${exists ? '✅' : '❌'} ${field}: ${exists ? typeof value : 'missing'}`);
            if (exists && value) {
                const preview = String(value).substring(0, 50);
                console.log(`   Value: "${preview}${String(value).length > 50 ? '...' : ''}"`);
            }
        }
        console.log('');
        
        console.log('📝 CONTENT FIELDS ANALYSIS');
        for (const field of contentFields) {
            const exists = field in firstDoc;
            const value = firstDoc[field];
            console.log(`${exists ? '📄' : '❌'} ${field}:`);
            
            if (!exists) {
                console.log('   ❌ Field missing from API response');
            } else if (value === null) {
                console.log('   ⚠️  Field is null');
            } else if (value === undefined) {
                console.log('   ⚠️  Field is undefined');
            } else if (field === 'notes') {
                // Special handling for ProseMirror structure
                console.log(`   Type: ${typeof value}`);
                if (typeof value === 'object' && value !== null) {
                    console.log(`   Structure keys: ${Object.keys(value)}`);
                    console.log(`   Type: ${value.type || 'unknown'}`);
                    console.log(`   Has content: ${!!(value.content)}`);
                    if (value.content) {
                        console.log(`   Content length: ${value.content.length}`);
                        if (value.content.length > 0) {
                            console.log(`   First node type: ${value.content[0].type || 'unknown'}`);
                        }
                    }
                } else {
                    console.log(`   ⚠️  Expected object, got ${typeof value}`);
                }
            } else {
                // String content fields
                console.log(`   Type: ${typeof value}`);
                console.log(`   Length: ${value ? value.length : 0}`);
                if (value && value.length > 0) {
                    const preview = String(value).substring(0, 100);
                    console.log(`   Preview: "${preview}${value.length > 100 ? '...' : ''}"`);
                }
            }
            console.log('');
        }
        
        // Check for any unexpected fields
        const expectedFields = new Set([...requiredFields, ...contentFields, 'user_id']);
        const unexpectedFields = Object.keys(firstDoc).filter(key => !expectedFields.has(key));
        
        if (unexpectedFields.length > 0) {
            console.log('🔍 UNEXPECTED FIELDS FOUND');
            console.log('===========================');
            for (const field of unexpectedFields) {
                console.log(`📋 ${field}: ${typeof firstDoc[field]}`);
            }
            console.log('');
        }
        
        // Save detailed analysis to file
        const analysisData = {
            timestamp: new Date().toISOString(),
            responseStructure: {
                topLevelKeys: Object.keys(data),
                documentCount: data.docs?.length || 0,
                deletedCount: data.deleted?.length || 0
            },
            firstDocument: {
                fields: Object.keys(firstDoc),
                fieldTypes: Object.fromEntries(
                    Object.keys(firstDoc).map(key => [key, typeof firstDoc[key]])
                ),
                contentAnalysis: {
                    notes: firstDoc.notes ? {
                        type: typeof firstDoc.notes,
                        structure: firstDoc.notes.type || 'unknown',
                        hasContent: !!(firstDoc.notes.content),
                        contentLength: firstDoc.notes.content?.length || 0
                    } : null,
                    notes_plain: firstDoc.notes_plain ? {
                        type: typeof firstDoc.notes_plain,
                        length: firstDoc.notes_plain.length,
                        isEmpty: firstDoc.notes_plain.trim().length === 0
                    } : null,
                    notes_markdown: firstDoc.notes_markdown ? {
                        type: typeof firstDoc.notes_markdown,
                        length: firstDoc.notes_markdown.length,
                        isEmpty: firstDoc.notes_markdown.trim().length === 0
                    } : null
                }
            },
            sampleDocument: firstDoc // Include full document for debugging
        };
        
        const analysisFile = 'api-response-analysis.json';
        require('fs').writeFileSync(analysisFile, JSON.stringify(analysisData, null, 2));
        console.log(`📊 Detailed analysis saved to: ${analysisFile}`);
        
        // Provide recommendations
        console.log('\n💡 RECOMMENDATIONS');
        console.log('==================');
        
        if (!firstDoc.notes) {
            console.log('❌ CRITICAL: "notes" field is missing or null');
            console.log('   This explains why content is empty in imports!');
        } else if (!firstDoc.notes.content || firstDoc.notes.content.length === 0) {
            console.log('❌ CRITICAL: ProseMirror content is empty');
            console.log('   Check if documents actually have content in Granola');
        }
        
        if (!firstDoc.notes_plain && !firstDoc.notes_markdown) {
            console.log('❌ CRITICAL: All content fields are empty');
            console.log('   This document may not have any actual content');
        }
        
        if (firstDoc.notes_plain && firstDoc.notes_plain.trim().length > 0) {
            console.log('✅ Plain text fallback is available');
        }
        
        if (firstDoc.notes_markdown && firstDoc.notes_markdown.trim().length > 0) {
            console.log('✅ Markdown fallback is available');
        }
        
        // Date analysis
        try {
            const createdDate = new Date(firstDoc.created_at);
            if (isNaN(createdDate.getTime())) {
                console.log('❌ CRITICAL: created_at is not a valid date');
            } else {
                console.log(`✅ Date parsing works: ${createdDate.toISOString()}`);
                const year = createdDate.getFullYear();
                const month = (createdDate.getMonth() + 1).toString().padStart(2, '0');
                const day = createdDate.getDate().toString().padStart(2, '0');
                const expectedFilename = `${year}-${month}-${day} - ${firstDoc.title || 'Untitled'}`;
                console.log(`✅ Expected filename: "${expectedFilename}.md"`);
            }
        } catch (error) {
            console.log(`❌ Date parsing error: ${error.message}`);
        }
        
    } catch (error) {
        console.error('❌ Failed to inspect API response:', error.message);
    }
}

if (require.main === module) {
    inspectAPIResponse().catch(console.error);
}

module.exports = { inspectAPIResponse };