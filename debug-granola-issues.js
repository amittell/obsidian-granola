#!/usr/bin/env node

/**
 * Debug script for Granola Importer issues:
 * 1. Date-prefixed filenames not working
 * 2. Missing note content (only headers importing)
 *
 * This script tests the data flow from API response to final Markdown output
 * without requiring the full Obsidian environment.
 */

const fs = require('fs');
const path = require('path');

// Mock the required modules for testing outside Obsidian
class MockAuth {
	constructor() {
		this.token = process.env.GRANOLA_TOKEN || null;
	}

	async loadCredentials() {
		if (!this.token) {
			throw new Error('GRANOLA_TOKEN environment variable not set');
		}
	}

	getBearerToken() {
		return this.token;
	}
}

class MockAPI {
	constructor(auth) {
		this.auth = auth;
		this.baseUrl = 'https://api.granola.ai/v2';
		this.userAgent = 'granola-debug/1.0.0';
	}

	async loadCredentials() {
		await this.auth.loadCredentials();
	}

	async getAllDocuments() {
		const response = await fetch(`${this.baseUrl}/get-documents`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.auth.getBearerToken()}`,
				'User-Agent': this.userAgent,
			},
			body: JSON.stringify({ limit: 10, offset: 0 }), // Limit to 10 for debugging
		});

		if (!response.ok) {
			throw new Error(`API Error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		console.log('\n=== API Response Structure ===');
		console.log('Response keys:', Object.keys(data));
		console.log('Documents array length:', data.docs?.length || 0);
		console.log('Deleted array length:', data.deleted?.length || 0);

		return data.docs || [];
	}
}

// Import the actual converter logic
let ProseMirrorConverter;
try {
	// Try to load the built version first
	const converterPath = path.join(__dirname, 'src', 'converter.ts');
	if (fs.existsSync(converterPath)) {
		// For this debug script, we'll use a simplified version of the converter
		ProseMirrorConverter = require('./simplified-converter-for-debug');
	}
} catch (error) {
	console.log('Using simplified converter for debugging...');
}

// Simplified converter for debugging (mimics the real converter logic)
class DebugConverter {
	convertDocument(doc) {
		console.log(`\n=== Converting Document: ${doc.id} ===`);
		console.log(`Title: "${doc.title}"`);
		console.log(`Created: ${doc.created_at}`);
		console.log(`Updated: ${doc.updated_at}`);

		// Check content fields
		console.log('\n--- Content Field Analysis ---');
		console.log('notes field exists:', !!doc.notes);
		console.log('notes structure:', doc.notes ? typeof doc.notes : 'undefined');
		console.log('notes_plain exists:', !!doc.notes_plain);
		console.log('notes_plain length:', doc.notes_plain?.length || 0);
		console.log('notes_markdown exists:', !!doc.notes_markdown);
		console.log('notes_markdown length:', doc.notes_markdown?.length || 0);

		if (doc.notes) {
			console.log('notes.type:', doc.notes.type);
			console.log('notes.content exists:', !!doc.notes.content);
			console.log('notes.content length:', doc.notes.content?.length || 0);

			if (doc.notes.content && doc.notes.content.length > 0) {
				console.log('First content node:', doc.notes.content[0]);
			}
		}

		// Test content conversion
		let markdown = '';
		let contentSource = 'none';

		// Test ProseMirror conversion
		if (doc.notes && this.isValidProseMirrorDoc(doc.notes)) {
			try {
				markdown = this.convertProseMirrorToMarkdown(doc.notes);
				contentSource = 'prosemirror';
				console.log(`ProseMirror conversion successful: ${markdown.length} chars`);
			} catch (error) {
				console.error('ProseMirror conversion failed:', error.message);
			}
		}

		// Test markdown fallback
		if (!markdown.trim() && doc.notes_markdown && doc.notes_markdown.trim()) {
			markdown = doc.notes_markdown.trim();
			contentSource = 'markdown';
			console.log(`Using notes_markdown fallback: ${markdown.length} chars`);
		}

		// Test plain fallback
		if (!markdown.trim() && doc.notes_plain && doc.notes_plain.trim()) {
			markdown = doc.notes_plain.trim();
			contentSource = 'plain';
			console.log(`Using notes_plain fallback: ${markdown.length} chars`);
		}

		console.log(`\nFinal content source: ${contentSource}`);
		console.log(`Final content length: ${markdown.length}`);
		console.log(
			'Content preview:',
			markdown.substring(0, 200) + (markdown.length > 200 ? '...' : '')
		);

		// Test filename generation
		const filename = this.generateDatePrefixedFilename(doc);
		console.log(`\nGenerated filename: "${filename}"`);

		return {
			filename: `${filename}.md`,
			content: this.generateFileContent(doc, markdown),
			contentSource,
		};
	}

	isValidProseMirrorDoc(doc) {
		console.log('\n--- ProseMirror Validation ---');

		if (!doc) {
			console.log('❌ Doc is null/undefined');
			return false;
		}

		if (doc.type !== 'doc') {
			console.log(`❌ Invalid type: ${doc.type} (expected 'doc')`);
			return false;
		}

		if (!doc.content || !Array.isArray(doc.content)) {
			console.log('❌ No content array');
			return false;
		}

		if (doc.content.length === 0) {
			console.log('❌ Empty content array');
			return false;
		}

		// Check for meaningful content
		const hasMeaningfulContent = doc.content.some(node => {
			if (node.type === 'paragraph') {
				const hasText =
					node.content &&
					node.content.length > 0 &&
					node.content.some(child => child.text && child.text.trim().length > 0);
				console.log(`Paragraph node meaningful: ${hasText}`);
				return hasText;
			}
			console.log(`Non-paragraph node (${node.type}): meaningful`);
			return true;
		});

		if (!hasMeaningfulContent) {
			console.log('❌ No meaningful content found');
			return false;
		}

		console.log('✅ ProseMirror validation passed');
		return true;
	}

	convertProseMirrorToMarkdown(doc) {
		console.log('\n--- ProseMirror to Markdown Conversion ---');

		if (!doc.content || doc.content.length === 0) {
			console.log('No content to convert');
			return '';
		}

		const convertedNodes = [];

		for (let i = 0; i < doc.content.length; i++) {
			const node = doc.content[i];
			console.log(`Converting node ${i}: ${node.type}`);

			try {
				const converted = this.convertNode(node);
				console.log(`Node ${i} result: "${converted}"`);
				convertedNodes.push(converted);
			} catch (error) {
				console.error(`Error converting node ${i}:`, error.message);
				convertedNodes.push(`[Error converting ${node.type}: ${error.message}]`);
			}
		}

		const result = convertedNodes.join('\n\n').trim();
		console.log(`Final conversion result (${result.length} chars):`, result);
		return result;
	}

	convertNode(node) {
		switch (node.type) {
			case 'paragraph':
				if (!node.content) return '';
				return node.content.map(child => this.convertNode(child)).join('');

			case 'heading':
				const level = node.attrs?.level || 1;
				const headingMarker = '#'.repeat(Math.min(level, 6));
				if (!node.content) return `${headingMarker} `;
				const text = node.content.map(child => this.convertNode(child)).join('');
				return `${headingMarker} ${text}`;

			case 'text':
				let text = node.text || '';
				if (node.marks) {
					for (const mark of node.marks) {
						switch (mark.type) {
							case 'strong':
								text = `**${text}**`;
								break;
							case 'em':
								text = `*${text}*`;
								break;
							case 'code':
								text = `\`${text}\``;
								break;
							case 'link':
								const href = mark.attrs?.href || '#';
								text = `[${text}](${href})`;
								break;
						}
					}
				}
				return text;

			case 'bulletList':
			case 'orderedList':
				if (!node.content) return '';
				const isOrdered = node.type === 'orderedList';
				return node.content
					.map((item, index) => {
						const marker = isOrdered ? `${index + 1}.` : '-';
						const content = this.convertNode(item);
						return `${marker} ${content}`;
					})
					.join('\n');

			case 'listItem':
				if (!node.content) return '';
				return node.content
					.map(child => {
						if (child.type === 'paragraph') {
							return (
								child.content
									?.map(grandchild => this.convertNode(grandchild))
									.join('') || ''
							);
						}
						return this.convertNode(child);
					})
					.join('\n');

			case 'hardBreak':
				return '\n';

			default:
				console.log(`Unknown node type: ${node.type}`);
				if (node.content) {
					return node.content.map(child => this.convertNode(child)).join('');
				}
				return node.text || '';
		}
	}

	generateDatePrefixedFilename(doc) {
		console.log('\n--- Filename Generation ---');
		console.log(`Input created_at: ${doc.created_at}`);

		let datePrefix = '';
		try {
			const createdDate = new Date(doc.created_at);
			if (isNaN(createdDate.getTime())) {
				console.log(`❌ Invalid date: ${doc.created_at}`);
				datePrefix = 'INVALID-DATE';
			} else {
				const year = createdDate.getFullYear();
				const month = (createdDate.getMonth() + 1).toString().padStart(2, '0');
				const day = createdDate.getDate().toString().padStart(2, '0');
				datePrefix = `${year}-${month}-${day}`;
				console.log(`✅ Date parsed: ${datePrefix}`);
			}
		} catch (error) {
			console.error('Date parsing error:', error);
			datePrefix = 'INVALID-DATE';
		}

		const title = doc.title || `Untitled-${doc.id}`;
		const sanitizedTitle = this.sanitizeFilename(title);
		const filename = `${datePrefix} - ${sanitizedTitle}`;

		console.log(`Generated filename: "${filename}"`);
		return filename;
	}

	sanitizeFilename(filename) {
		return filename
			.replace(/[<>:"/\\|?*]/g, '-')
			.replace(/\s+/g, ' ')
			.trim()
			.substring(0, 100);
	}

	generateFileContent(doc, markdown) {
		const frontmatter = [
			'---',
			`id: ${doc.id}`,
			`title: "${(doc.title || 'Untitled').replace(/"/g, '\\"')}"`,
			`created: ${doc.created_at}`,
			`updated: ${doc.updated_at}`,
			`source: Granola`,
			'---',
			'',
		].join('\n');

		return frontmatter + markdown;
	}
}

async function main() {
	console.log('🔍 Granola Importer Debug Tool');
	console.log('================================\n');

	try {
		// Initialize components
		console.log('Initializing components...');
		const auth = new MockAuth();
		await auth.loadCredentials();

		const api = new MockAPI(auth);
		const converter = new DebugConverter();

		// Fetch documents
		console.log('Fetching documents from Granola API...');
		const documents = await api.getAllDocuments();

		if (documents.length === 0) {
			console.log('❌ No documents found in API response');
			return;
		}

		console.log(`✅ Found ${documents.length} documents`);

		// Test conversion for first few documents
		const testCount = Math.min(3, documents.length);
		console.log(`\nTesting conversion for first ${testCount} documents...\n`);

		for (let i = 0; i < testCount; i++) {
			const doc = documents[i];
			console.log(`\n${'='.repeat(60)}`);
			console.log(`DOCUMENT ${i + 1}/${testCount}`);
			console.log(`${'='.repeat(60)}`);

			try {
				const result = converter.convertDocument(doc);

				// Write debug output to file
				const debugFile = `debug-output-${i + 1}.md`;
				fs.writeFileSync(debugFile, result.content);
				console.log(`\n📝 Debug output written to: ${debugFile}`);

				// Summary
				console.log('\n--- SUMMARY ---');
				console.log(`✅ Filename: ${result.filename}`);
				console.log(`✅ Content source: ${result.contentSource}`);
				console.log(`✅ Content length: ${result.content.length} chars`);
			} catch (error) {
				console.error(`❌ Conversion failed for document ${i + 1}:`, error.message);
			}
		}

		console.log('\n🎉 Debug analysis complete!');
		console.log('\nNext steps:');
		console.log('1. Check the debug-output-*.md files for actual converted content');
		console.log('2. Look for patterns in failed conversions');
		console.log('3. Verify date-prefix functionality is working');
		console.log('4. Identify why content might be empty');
	} catch (error) {
		console.error('❌ Debug script failed:', error.message);
		console.log('\nTroubleshooting:');
		console.log('1. Set GRANOLA_TOKEN environment variable');
		console.log('2. Check internet connection');
		console.log('3. Verify Granola API access');
	}
}

if (require.main === module) {
	main().catch(console.error);
}

module.exports = { DebugConverter, MockAPI, MockAuth };
