/**
 * Utility functions for working with ProseMirror documents and other content formats
 */

import { GranolaDocument } from '../api';

/**
 * Extracts plain text from a ProseMirror document structure
 * @param proseMirrorDoc - The ProseMirror document object
 * @returns Extracted text content
 */
export function extractTextFromProseMirror(proseMirrorDoc: Record<string, unknown>): string {
	if (!proseMirrorDoc || !proseMirrorDoc.content) {
		return '';
	}

	const extractText = (node: Record<string, unknown>): string => {
		if (node && typeof node === 'object') {
			// Direct text node
			if (node.text && typeof node.text === 'string') {
				return node.text;
			}
			// Node with children - recurse
			if (node.content && Array.isArray(node.content)) {
				return node.content.map(extractText).join(' ');
			}
		}
		return '';
	};

	const content = proseMirrorDoc.content;
	if (!Array.isArray(content)) {
		return '';
	}

	const text = content
		.map(node => extractText(node as Record<string, unknown>))
		.join(' ')
		.trim()
		.replace(/\s+/g, ' ');

	return text || '';
}

/**
 * Extracts plain text from HTML string content
 * @param html - HTML string to extract text from
 * @returns Plain text content with HTML tags removed
 */
export function extractTextFromHtml(html: string): string {
	if (!html || typeof html !== 'string') {
		return '';
	}

	return html
		.replace(/<[^>]*>/g, ' ') // Remove all HTML tags
		.replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
		.replace(/&amp;/g, '&') // Handle common HTML entities
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim();
}

/**
 * Unified content extractor that handles multiple content formats
 * @param content - Content in unknown format (ProseMirror JSON, HTML string, plain text, etc.)
 * @returns Extracted plain text content
 */
export function extractTextFromContent(content: unknown): string {
	if (!content) {
		return '';
	}

	// Handle string content (HTML or plain text)
	if (typeof content === 'string') {
		// Check if it looks like HTML
		if (content.includes('<') && content.includes('>')) {
			return extractTextFromHtml(content);
		}
		// Plain text string
		return content.trim();
	}

	// Handle ProseMirror JSON object
	if (typeof content === 'object' && content !== null) {
		return extractTextFromProseMirror(content as Record<string, unknown>);
	}

	return '';
}

/**
 * Detects if a Granola document is empty based on the improvement proposal criteria.
 *
 * A document is considered empty if it has no meaningful content in any of the content fields.
 * Additionally, documents that were never modified after creation are considered empty placeholders.
 *
 * @param document - The Granola document to check
 * @returns true if the document is empty, false otherwise
 */
export function isEmptyDocument(document: GranolaDocument): boolean {
	// Check if there's meaningful content in any content field
	const hasContent =
		// Check last_viewed_panel.content (primary content location)
		(document.last_viewed_panel?.content &&
			extractTextFromContent(document.last_viewed_panel.content).trim().length > 0) ||
		// Check notes_plain
		(document.notes_plain && document.notes_plain.trim().length > 0) ||
		// Check notes_markdown
		(document.notes_markdown && document.notes_markdown.trim().length > 0) ||
		// Check notes.content (legacy ProseMirror)
		(document.notes?.content &&
			Array.isArray(document.notes.content) &&
			document.notes.content.length > 1) ||
		// Check if notes.content has any actual content
		(document.notes?.content &&
			Array.isArray(document.notes.content) &&
			document.notes.content.length > 0 &&
			extractTextFromContent(document.notes).trim().length > 0);

	// If document has content, it's not empty regardless of dates
	if (hasContent) {
		return false;
	}

	// If document has no content, it's empty
	return true;
}
