#!/usr/bin/env node

/**
 * Debug script to inspect Granola API response structure and content fields.
 * This helps diagnose why note content might be empty during import.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import the authentication and API classes
const { GranolaAuth } = require('./lib/src/auth');
const { GranolaAPI } = require('./lib/src/api');

/**
 * Main debugging function
 */
async function debugAPIResponse() {
    console.log('🔍 [DEBUG] Starting Granola API Response Inspection...\n');
    
    try {
        // Initialize auth and API
        console.log('📡 [DEBUG] Initializing API connection...');
        const auth = new GranolaAuth();
        const api = new GranolaAPI(auth);
        
        // Load credentials
        console.log('🔐 [DEBUG] Loading credentials...');
        await api.loadCredentials();
        console.log('✅ [DEBUG] Credentials loaded successfully\n');
        
        // Fetch documents
        console.log('📥 [DEBUG] Fetching documents from Granola API...');
        const documents = await api.getAllDocuments();
        console.log(`✅ [DEBUG] Retrieved ${documents.length} documents\n`);
        
        if (documents.length === 0) {
            console.log('⚠️  [DEBUG] No documents found in account');
            return;
        }
        
        // Analyze first few documents in detail
        const samplesToAnalyze = Math.min(3, documents.length);
        console.log(`🔬 [DEBUG] Analyzing structure of first ${samplesToAnalyze} documents:\n`);
        
        for (let i = 0; i < samplesToAnalyze; i++) {
            const doc = documents[i];
            console.log(`--- Document ${i + 1}: "${doc.title}" ---`);
            console.log(`ID: ${doc.id}`);
            console.log(`Created: ${doc.created_at}`);
            console.log(`Updated: ${doc.updated_at}`);
            console.log(`User ID: ${doc.user_id}`);
            
            // Check content fields
            console.log('\n📋 Content Field Analysis:');
            
            // Check notes (ProseMirror)
            if (doc.notes) {
                console.log(`✅ notes field: EXISTS (type: ${typeof doc.notes})`);
                if (typeof doc.notes === 'object') {
                    console.log(`   - Type: ${doc.notes.type || 'unknown'}`);
                    console.log(`   - Has content: ${!!doc.notes.content}`);
                    if (doc.notes.content) {
                        console.log(`   - Content length: ${doc.notes.content.length}`);
                        console.log(`   - Sample structure:`, JSON.stringify(doc.notes, null, 2).substring(0, 200) + '...');
                    }
                }
            } else {
                console.log('❌ notes field: MISSING');
            }
            
            // Check notes_plain
            if (doc.notes_plain) {
                console.log(`✅ notes_plain field: EXISTS (${doc.notes_plain.length} chars)`);
                if (doc.notes_plain.length > 0) {
                    console.log(`   - Preview: "${doc.notes_plain.substring(0, 100)}..."`);
                } else {
                    console.log('   - ⚠️  Empty string');
                }
            } else {
                console.log('❌ notes_plain field: MISSING');
            }
            
            // Check notes_markdown
            if (doc.notes_markdown) {
                console.log(`✅ notes_markdown field: EXISTS (${doc.notes_markdown.length} chars)`);
                if (doc.notes_markdown.length > 0) {
                    console.log(`   - Preview: "${doc.notes_markdown.substring(0, 100)}..."`);
                } else {
                    console.log('   - ⚠️  Empty string');
                }
            } else {
                console.log('❌ notes_markdown field: MISSING');
            }
            
            // Overall content assessment
            const hasAnyContent = (doc.notes && doc.notes.content && doc.notes.content.length > 0) ||
                                (doc.notes_plain && doc.notes_plain.trim().length > 0) ||
                                (doc.notes_markdown && doc.notes_markdown.trim().length > 0);
            
            console.log(`\n📊 Content Status: ${hasAnyContent ? '✅ HAS CONTENT' : '❌ NO CONTENT FOUND'}`);
            console.log('\n' + '='.repeat(60) + '\n');
        }
        
        // Overall statistics
        console.log('📈 Overall Statistics:');
        let docsWithNotes = 0;
        let docsWithPlain = 0;
        let docsWithMarkdown = 0;
        let docsWithAnyContent = 0;
        
        documents.forEach(doc => {
            if (doc.notes && doc.notes.content && doc.notes.content.length > 0) docsWithNotes++;
            if (doc.notes_plain && doc.notes_plain.trim().length > 0) docsWithPlain++;
            if (doc.notes_markdown && doc.notes_markdown.trim().length > 0) docsWithMarkdown++;
            
            const hasContent = (doc.notes && doc.notes.content && doc.notes.content.length > 0) ||
                             (doc.notes_plain && doc.notes_plain.trim().length > 0) ||
                             (doc.notes_markdown && doc.notes_markdown.trim().length > 0);
            if (hasContent) docsWithAnyContent++;
        });
        
        console.log(`Total documents: ${documents.length}`);
        console.log(`Documents with notes (ProseMirror): ${docsWithNotes} (${(docsWithNotes/documents.length*100).toFixed(1)}%)`);
        console.log(`Documents with notes_plain: ${docsWithPlain} (${(docsWithPlain/documents.length*100).toFixed(1)}%)`);
        console.log(`Documents with notes_markdown: ${docsWithMarkdown} (${(docsWithMarkdown/documents.length*100).toFixed(1)}%)`);
        console.log(`Documents with ANY content: ${docsWithAnyContent} (${(docsWithAnyContent/documents.length*100).toFixed(1)}%)`);
        
        // Save full response for deeper analysis
        const debugFile = path.join(__dirname, 'debug-api-response.json');
        fs.writeFileSync(debugFile, JSON.stringify(documents, null, 2));
        console.log(`\n💾 Full API response saved to: ${debugFile}`);
        
        console.log('\n🎯 [DEBUG] Key Findings:');
        if (docsWithAnyContent === 0) {
            console.log('❗ CRITICAL: No documents have any content in any field!');
            console.log('   This explains why imports are showing empty content.');
            console.log('   Possible causes:');
            console.log('   - API credentials don\'t have access to full content');
            console.log('   - Granola API has changed their response format');
            console.log('   - Documents genuinely have no content');
        } else if (docsWithNotes === 0 && docsWithMarkdown > 0) {
            console.log('💡 ProseMirror content is missing, but markdown fallback available');
            console.log('   The issue might be in ProseMirror validation being too strict');
        } else if (docsWithNotes > 0) {
            console.log('💡 ProseMirror content exists - issue likely in conversion logic');
        }
        
        console.log('\n✅ [DEBUG] API Response Inspection Complete!');
        
    } catch (error) {
        console.error('❌ [DEBUG] Error during API inspection:', error);
        
        if (error.message.includes('credentials') || error.message.includes('unauthorized')) {
            console.log('\n🔧 Credential Issue Detected:');
            console.log('1. Make sure Granola desktop app is logged in');
            console.log('2. Check that supabase.json exists in the expected location');
            console.log('3. Verify the access token is valid and not expired');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            console.log('\n🌐 Network Issue Detected:');
            console.log('1. Check internet connection');
            console.log('2. Verify Granola API endpoint is accessible');
            console.log('3. Check for any firewall blocking');
        }
    }
}

// Run the debug function
if (require.main === module) {
    debugAPIResponse().catch(console.error);
}

module.exports = { debugAPIResponse };