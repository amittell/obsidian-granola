/**
 * Utility functions for working with ProseMirror documents
 */

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