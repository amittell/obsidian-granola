import { ProseMirrorNode } from '../api';
import { Logger } from '../types';

/**
 * Specialized node conversion functions for ProseMirror to Markdown conversion.
 * This module contains the heavy conversion logic that can be lazy-loaded.
 */
export class NodeConverters {
	private logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Converts a paragraph node to Markdown format.
	 *
	 * @param {ProseMirrorNode} node - The paragraph node to convert
	 * @returns {string} The converted Markdown text
	 * @private
	 */
	convertParagraph(node: ProseMirrorNode): string {
		this.logger.debug(`Converting paragraph node:`, node);

		if (!node || !node.content || node.content.length === 0) {
			return '';
		}

		const textContent = this.extractTextFromNodes(node.content);
		return textContent.trim() + '\n\n';
	}

	/**
	 * Converts a heading node to Markdown format.
	 *
	 * @param {ProseMirrorNode} node - The heading node to convert
	 * @returns {string} The converted Markdown heading
	 * @private
	 */
	convertHeading(node: ProseMirrorNode): string {
		this.logger.debug(`Converting heading node:`, node);

		const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
		const hashPrefix = '#'.repeat(level) + ' ';

		if (!node.content || node.content.length === 0) {
			return hashPrefix + '\n\n';
		}

		const textContent = this.extractTextFromNodes(node.content);
		return hashPrefix + textContent.trim() + '\n\n';
	}

	/**
	 * Converts a list node (ordered or unordered) to Markdown format.
	 *
	 * @param {ProseMirrorNode} node - The list node to convert
	 * @returns {string} The converted Markdown list
	 * @private
	 */
	convertList(node: ProseMirrorNode): string {
		this.logger.debug(`Converting list node:`, node);

		if (!node.content || node.content.length === 0) {
			return '';
		}

		const isOrdered = node.type === 'orderedList';
		const listItems: string[] = [];

		node.content.forEach((listItem, index) => {
			const prefix = isOrdered ? `${index + 1}. ` : '- ';
			const itemContent = this.convertListItem(listItem);
			if (itemContent.trim()) {
				listItems.push(prefix + itemContent.trim());
			}
		});

		return listItems.length > 0 ? listItems.join('\n') + '\n\n' : '';
	}

	/**
	 * Converts a list item node to Markdown format.
	 *
	 * @param {ProseMirrorNode} node - The list item node to convert
	 * @returns {string} The converted list item content
	 * @private
	 */
	convertListItem(node: ProseMirrorNode): string {
		this.logger.debug(`Converting list item node:`, node);

		if (!node.content || node.content.length === 0) {
			return '';
		}

		// Extract content from paragraphs within the list item
		const content = node.content
			.map(subNode => {
				if (subNode.type === 'paragraph' && subNode.content) {
					return this.extractTextFromNodes(subNode.content);
				}
				return '';
			})
			.filter(text => text.trim())
			.join(' ');

		return content;
	}

	/**
	 * Converts a text node with formatting marks to Markdown format.
	 *
	 * @param {ProseMirrorNode} node - The text node to convert
	 * @returns {string} The converted Markdown text with formatting
	 * @private
	 */
	convertText(node: ProseMirrorNode): string {
		if (!node.text) {
			return '';
		}

		let text = node.text;

		if (node.marks && node.marks.length > 0) {
			node.marks.forEach(mark => {
				switch (mark.type) {
					case 'strong':
						text = `**${text}**`;
						break;
					case 'em':
						text = `_${text}_`;
						break;
					case 'code':
						text = `\`${text}\``;
						break;
					case 'link': {
						const href = mark.attrs?.href || '#';
						text = `[${text}](${href})`;
						break;
					}
				}
			});
		}

		return text;
	}

	/**
	 * Converts a code block node to Markdown format.
	 *
	 * @param {ProseMirrorNode} node - The code block node to convert
	 * @returns {string} The converted Markdown code block
	 * @private
	 *
	 * @example
	 * Input:
	 *     { type: 'codeBlock', attrs: { language: 'javascript' }, content: [...] }
	 * Output:
	 *     "```javascript\ncode content here\n```\n\n"
	 *
	 * @example
	 * Input:
	 *     { type: 'text', text: 'function hello() {\n  console.log("Hello!");\n}' }
	 * Output:
	 *     "```\nfunction hello() {\n  console.log(\"Hello!\");\n}\n```"
	 *
	 * // Result: "```javascript\nfunction hello() {\n  console.log(\"Hello!\");\n}\n```"
	 */
	convertCodeBlock(node: ProseMirrorNode): string {
		this.logger.debug(`Converting code block node:`, node);

		const language = node.attrs?.language || '';
		const codeContent = node.content
			? this.extractTextFromNodes(node.content)
			: node.text || '';

		return `\`\`\`${language}\n${codeContent.trim()}\n\`\`\`\n\n`;
	}

	/**
	 * Converts a blockquote node to Markdown format.
	 *
	 * @param {ProseMirrorNode} node - The blockquote node to convert
	 * @returns {string} The converted Markdown blockquote
	 * @private
	 *
	 * @example
	 * Input:
	 *     { type: 'blockquote', content: [{ type: 'paragraph', content: [...] }] }
	 * Output:
	 *     "> Quote content here\n> \n> Second paragraph\n\n"
	 */
	convertBlockquote(node: ProseMirrorNode): string {
		this.logger.debug(`Converting blockquote node:`, node);

		if (!node.content || node.content.length === 0) {
			return '> \n\n';
		}

		const lines: string[] = [];

		node.content.forEach(subNode => {
			if (subNode.type === 'paragraph' && subNode.content) {
				const paragraphText = this.extractTextFromNodes(subNode.content);
				if (paragraphText.trim()) {
					// Split by lines and prefix each with '> '
					paragraphText.split('\n').forEach(line => {
						lines.push('> ' + line);
					});
				} else {
					lines.push('> ');
				}
			}
		});

		return lines.join('\n') + '\n\n';
	}

	/**
	 * Converts a table node to Markdown format.
	 *
	 * @param {ProseMirrorNode} node - The table node to convert
	 * @returns {string} The converted Markdown table
	 * @private
	 */
	convertTable(node: ProseMirrorNode): string {
		this.logger.debug(`Converting table node:`, node);

		if (!node.content || node.content.length === 0) {
			return '';
		}

		const rows: string[] = [];
		let headerProcessed = false;

		node.content.forEach(rowNode => {
			if (rowNode.type === 'tableRow') {
				const rowContent = this.convertTableRow(rowNode);
				if (rowContent) {
					rows.push(rowContent);

					// Add header separator after first row
					if (!headerProcessed) {
						const cellCount = (rowNode.content || []).length;
						const separator = '|' + ' --- |'.repeat(cellCount);
						rows.push(separator);
						headerProcessed = true;
					}
				}
			}
		});

		return rows.length > 0 ? rows.join('\n') + '\n\n' : '';
	}

	/**
	 * Converts a table row node to Markdown format.
	 *
	 * @param {ProseMirrorNode} node - The table row node to convert
	 * @returns {string} The converted Markdown table row
	 * @private
	 */
	convertTableRow(node: ProseMirrorNode): string {
		if (!node.content || node.content.length === 0) {
			return '';
		}

		const cells: string[] = [];

		node.content.forEach(cellNode => {
			if (cellNode.type === 'tableCell' || cellNode.type === 'tableHeader') {
				const cellContent = cellNode.content
					? this.extractTextFromNodes(cellNode.content)
					: '';
				cells.push(cellContent.trim());
			}
		});

		return cells.length > 0 ? '| ' + cells.join(' | ') + ' |' : '';
	}

	/**
	 * Extracts text content from an array of ProseMirror nodes.
	 *
	 * @param {ProseMirrorNode[]} nodes - Array of nodes to extract text from
	 * @returns {string} Combined text content
	 * @private
	 */
	private extractTextFromNodes(nodes: ProseMirrorNode[]): string {
		return nodes
			.map(node => {
				switch (node.type) {
					case 'text':
						return this.convertText(node);
					case 'hardBreak':
						return '\n';
					case 'paragraph':
						return node.content ? this.extractTextFromNodes(node.content) : '';
					default:
						// For unknown node types, try to extract text recursively
						if (node.content && Array.isArray(node.content)) {
							return this.extractTextFromNodes(node.content);
						}
						return node.text || '';
				}
			})
			.join('');
	}
}
