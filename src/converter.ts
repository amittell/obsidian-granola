import { ProseMirrorDoc, ProseMirrorNode, GranolaDocument } from './api';

// Converter Constants
const MAX_FILENAME_LENGTH = 100;

/**
 * Represents a successfully converted document ready for Obsidian import.
 *
 * Contains the converted Markdown content, sanitized filename, and extracted
 * frontmatter metadata. This is the final output format that gets written
 * to the Obsidian vault.
 *
 * @interface ConvertedNote
 * @since 1.0.0
 */
export interface ConvertedNote {
	/** Sanitized filename with .md extension for the Obsidian vault */
	filename: string;

	/** Complete file content including YAML frontmatter and Markdown body */
	content: string;

	/** Extracted metadata from the original Granola document */
	frontmatter: NoteFrontmatter;
}

/**
 * YAML frontmatter metadata extracted from Granola documents.
 *
 * This metadata is embedded at the top of each converted Markdown file
 * to preserve document identifiers, timestamps, and source attribution.
 * The frontmatter follows standard YAML format and is compatible with
 * Obsidian's metadata system.
 *
 * @interface NoteFrontmatter
 * @since 1.0.0
 */
export interface NoteFrontmatter {
	/** Original Granola document identifier */
	id: string;

	/** Document title, escaped for YAML compatibility */
	title: string;

	/** ISO timestamp when the document was created */
	created: string;

	/** ISO timestamp when the document was last updated */
	updated: string;

	/** Source attribution, always "Granola" for imported documents */
	source: string;
}

/**
 * Converts ProseMirror JSON documents to Markdown format for Obsidian.
 *
 * This class handles the complex task of transforming Granola's ProseMirror
 * document structure into clean, readable Markdown. It supports a wide range
 * of content types including:
 *
 * - Text formatting (bold, italic, code, links)
 * - Structural elements (headings, paragraphs, lists)
 * - Advanced content (code blocks, blockquotes, tables, horizontal rules)
 * - Nested structures and complex hierarchies
 *
 * The conversion process preserves semantic meaning while generating
 * Markdown that renders properly in Obsidian and other Markdown viewers.
 *
 * @class ProseMirrorConverter
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * const converter = new ProseMirrorConverter();
 * const granolaDoc = await api.getDocument('doc-id');
 * const convertedNote = converter.convertDocument(granolaDoc);
 *
 * console.log(convertedNote.filename); // "My Document.md"
 * console.log(convertedNote.content);  // "---\nid: doc-id\n...\n# My Document\n..."
 * ```
 */
export class ProseMirrorConverter {
	/**
	 * Converts a complete Granola document to Obsidian-compatible Markdown.
	 *
	 * This is the main entry point for document conversion. It orchestrates
	 * the conversion of ProseMirror content, generates YAML frontmatter,
	 * creates a safe filename, and assembles the final file content.
	 *
	 * @param {GranolaDocument} doc - The source document from Granola API
	 * @returns {ConvertedNote} Complete converted document with metadata
	 *
	 * @example
	 * ```typescript
	 * const granolaDoc = {
	 *   id: 'abc123',
	 *   title: 'My Meeting Notes',
	 *   content: { type: 'doc', content: [...] },
	 *   created_at: '2024-01-01T10:00:00Z',
	 *   updated_at: '2024-01-01T11:00:00Z'
	 * };
	 *
	 * const converted = converter.convertDocument(granolaDoc);
	 * // Result: { filename: "My Meeting Notes.md", content: "---\n...", frontmatter: {...} }
	 * ```
	 */
	convertDocument(doc: GranolaDocument): ConvertedNote {
		const markdown = this.convertProseMirrorToMarkdown(doc.content);
		const frontmatter = this.generateFrontmatter(doc);
		const filename = this.sanitizeFilename(doc.title || `Untitled-${doc.id}`);

		const content = this.generateFileContent(frontmatter, markdown);

		return {
			filename: `${filename}.md`,
			content,
			frontmatter,
		};
	}

	/**
	 * Converts ProseMirror document content to Markdown string.
	 *
	 * Processes the top-level content nodes of a ProseMirror document,
	 * converting each node to its Markdown equivalent and joining them
	 * with appropriate spacing.
	 *
	 * @private
	 * @param {ProseMirrorDoc} doc - ProseMirror document structure
	 * @returns {string} Converted Markdown content
	 *
	 * @example
	 * ```typescript
	 * const prosemirrorDoc = {
	 *   type: 'doc',
	 *   content: [
	 *     { type: 'heading', attrs: { level: 1 }, content: [...] },
	 *     { type: 'paragraph', content: [...] }
	 *   ]
	 * };
	 * const markdown = this.convertProseMirrorToMarkdown(prosemirrorDoc);
	 * // Result: "# Heading\n\nParagraph content"
	 * ```
	 */
	private convertProseMirrorToMarkdown(doc: ProseMirrorDoc): string {
		if (!doc.content || doc.content.length === 0) {
			return '';
		}

		return doc.content
			.map(node => this.convertNode(node))
			.join('\n\n')
			.trim();
	}

	/**
	 * Recursively converts a single ProseMirror node to Markdown.
	 *
	 * This is the core conversion method that dispatches to specific
	 * conversion handlers based on the node type. It handles both
	 * container nodes (with child content) and leaf nodes (with text content).
	 *
	 * Supported node types:
	 * - paragraph, heading, bulletList, orderedList, listItem
	 * - text, hardBreak, codeBlock, blockquote, table, horizontalRule
	 *
	 * @private
	 * @param {ProseMirrorNode} node - The node to convert
	 * @returns {string} Markdown representation of the node
	 *
	 * @example
	 * ```typescript
	 * const headingNode = {
	 *   type: 'heading',
	 *   attrs: { level: 2 },
	 *   content: [{ type: 'text', text: 'Section Title' }]
	 * };
	 * const markdown = this.convertNode(headingNode);
	 * // Result: "## Section Title"
	 * ```
	 */
	private convertNode(node: ProseMirrorNode): string {
		switch (node.type) {
			case 'paragraph':
				return this.convertParagraph(node);

			case 'heading':
				return this.convertHeading(node);

			case 'bulletList':
			case 'orderedList':
				return this.convertList(node);

			case 'listItem':
				return this.convertListItem(node);

			case 'text':
				return this.convertText(node);

			case 'hardBreak':
				return '\n';

			case 'codeBlock':
				return this.convertCodeBlock(node);

			case 'blockquote':
				return this.convertBlockquote(node);

			case 'table':
				return this.convertTable(node);

			case 'horizontalRule':
				return '---';

			default:
				// Handle unknown nodes by processing their content
				if (node.content) {
					return node.content.map(child => this.convertNode(child)).join('');
				}
				return node.text || '';
		}
	}

	/**
	 * Converts a paragraph node to Markdown.
	 *
	 * Paragraphs are simple container nodes that contain inline content
	 * like text, formatting marks, and links. The conversion processes
	 * all child nodes and joins them without additional markup.
	 *
	 * @private
	 * @param {ProseMirrorNode} node - Paragraph node to convert
	 * @returns {string} Plain text content of the paragraph
	 *
	 * @example
	 * ```typescript
	 * const paragraphNode = {
	 *   type: 'paragraph',
	 *   content: [
	 *     { type: 'text', text: 'This is ' },
	 *     { type: 'text', text: 'bold', marks: [{ type: 'strong' }] },
	 *     { type: 'text', text: ' text.' }
	 *   ]
	 * };
	 * const result = this.convertParagraph(paragraphNode);
	 * // Result: "This is **bold** text."
	 * ```
	 */
	private convertParagraph(node: ProseMirrorNode): string {
		if (!node.content) {
			return '';
		}

		return node.content.map(child => this.convertNode(child)).join('');
	}

	/**
	 * Converts a heading node to Markdown.
	 *
	 * Generates appropriate number of hash symbols (#) based on the heading
	 * level attribute, supporting levels 1-6. Processes the heading content
	 * and prefixes it with the heading marker.
	 *
	 * @private
	 * @param {ProseMirrorNode} node - Heading node with level attribute
	 * @returns {string} Markdown heading (e.g., "## Heading Text")
	 *
	 * @example
	 * ```typescript
	 * const headingNode = {
	 *   type: 'heading',
	 *   attrs: { level: 3 },
	 *   content: [{ type: 'text', text: 'Chapter Title' }]
	 * };
	 * const result = this.convertHeading(headingNode);
	 * // Result: "### Chapter Title"
	 * ```
	 */
	private convertHeading(node: ProseMirrorNode): string {
		const level = (node.attrs?.level as number) || 1;
		const headingMarker = '#'.repeat(Math.min(level, 6));

		if (!node.content) {
			return `${headingMarker} `;
		}

		const text = node.content.map(child => this.convertNode(child)).join('');
		return `${headingMarker} ${text}`;
	}

	/**
	 * Converts bullet or ordered list nodes to Markdown.
	 *
	 * Handles both unordered lists (with "-" markers) and ordered lists
	 * (with numbered markers). Processes each list item and applies
	 * appropriate prefixes based on the list type.
	 *
	 * @private
	 * @param {ProseMirrorNode} node - List node (bulletList or orderedList)
	 * @returns {string} Markdown list with proper item markers
	 *
	 * @example
	 * ```typescript
	 * const bulletListNode = {
	 *   type: 'bulletList',
	 *   content: [
	 *     { type: 'listItem', content: [{ type: 'paragraph', content: [...] }] },
	 *     { type: 'listItem', content: [{ type: 'paragraph', content: [...] }] }
	 *   ]
	 * };
	 * const result = this.convertList(bulletListNode);
	 * // Result: "- First item\n- Second item"
	 * ```
	 */
	private convertList(node: ProseMirrorNode): string {
		if (!node.content) {
			return '';
		}

		const isOrdered = node.type === 'orderedList';

		return node.content
			.map((item, index) => {
				const marker = isOrdered ? `${index + 1}.` : '-';
				const content = this.convertListItem(item);
				return `${marker} ${content}`;
			})
			.join('\n');
	}

	/**
	 * Converts a list item node to its content representation.
	 *
	 * List items typically contain paragraphs or other block content.
	 * This method processes the item content and handles paragraph
	 * unwrapping to avoid extra markup within list items.
	 *
	 * @private
	 * @param {ProseMirrorNode} node - List item node
	 * @returns {string} Text content of the list item
	 *
	 * @example
	 * ```typescript
	 * const listItemNode = {
	 *   type: 'listItem',
	 *   content: [
	 *     {
	 *       type: 'paragraph',
	 *       content: [{ type: 'text', text: 'Item content' }]
	 *     }
	 *   ]
	 * };
	 * const result = this.convertListItem(listItemNode);
	 * // Result: "Item content"
	 * ```
	 */
	private convertListItem(node: ProseMirrorNode): string {
		if (!node.content) {
			return '';
		}

		return node.content
			.map(child => {
				if (child.type === 'paragraph') {
					return this.convertParagraph(child);
				}
				return this.convertNode(child);
			})
			.join('\n');
	}

	/**
	 * Converts a text node with formatting marks to Markdown.
	 *
	 * Processes text content and applies Markdown formatting based on
	 * the marks array. Supports multiple mark types including bold (strong),
	 * italic (em), inline code, and links. Marks are applied in sequence
	 * to build the final formatted text.
	 *
	 * @private
	 * @param {ProseMirrorNode} node - Text node with optional marks
	 * @returns {string} Formatted Markdown text
	 *
	 * @example
	 * ```typescript
	 * const textNode = {
	 *   type: 'text',
	 *   text: 'example.com',
	 *   marks: [
	 *     { type: 'link', attrs: { href: 'https://example.com' } },
	 *     { type: 'strong' }
	 *   ]
	 * };
	 * const result = this.convertText(textNode);
	 * // Result: "**[example.com](https://example.com)**"
	 * ```
	 */
	private convertText(node: ProseMirrorNode): string {
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
					case 'link': {
						const href = mark.attrs?.href || '#';
						text = `[${text}](${href})`;
						break;
					}
				}
			}
		}

		return text;
	}

	/**
	 * Converts a code block node to fenced Markdown code block.
	 *
	 * Creates a fenced code block with triple backticks, including
	 * language specification if provided in the node attributes.
	 * Handles multi-line code content properly.
	 *
	 * TODO: Add unit tests to cover edge cases:
	 * - Empty content nodes
	 * - Missing language attributes
	 * - Multiline content with various line endings
	 * - Content with special characters or backticks
	 *
	 * @private
	 * @param {ProseMirrorNode} node - Code block node with optional language
	 * @returns {string} Fenced Markdown code block
	 *
	 * @example
	 * ```typescript
	 * const codeBlockNode = {
	 *   type: 'codeBlock',
	 *   attrs: { language: 'javascript' },
	 *   content: [
	 *     { type: 'text', text: 'function hello() {\n  console.log("Hello!");\n}' }
	 *   ]
	 * };
	 * const result = this.convertCodeBlock(codeBlockNode);
	 * // Result: "```javascript\nfunction hello() {\n  console.log(\"Hello!\");\n}\n```"
	 * ```
	 */
	private convertCodeBlock(node: ProseMirrorNode): string {
		const language = (node.attrs?.language as string) || '';
		const code = node.content?.map(child => child.text || '').join('\n') || node.text || '';
		return `\`\`\`${language}\n${code}\n\`\`\``;
	}

	/**
	 * Converts a blockquote node to Markdown blockquote format.
	 *
	 * Prefixes each line of the blockquote content with "> " to create
	 * proper Markdown blockquote formatting. Handles multi-line content
	 * and nested structures within blockquotes.
	 *
	 * @private
	 * @param {ProseMirrorNode} node - Blockquote node
	 * @returns {string} Markdown blockquote with "> " prefixes
	 *
	 * @example
	 * ```typescript
	 * const blockquoteNode = {
	 *   type: 'blockquote',
	 *   content: [
	 *     {
	 *       type: 'paragraph',
	 *       content: [{ type: 'text', text: 'This is a quote.\nWith multiple lines.' }]
	 *     }
	 *   ]
	 * };
	 * const result = this.convertBlockquote(blockquoteNode);
	 * // Result: "> This is a quote.\n> With multiple lines."
	 * ```
	 */
	private convertBlockquote(node: ProseMirrorNode): string {
		if (!node.content) {
			return '> ';
		}

		return node.content
			.map(child => {
				const content = this.convertNode(child);
				return content
					.split('\n')
					.map(line => `> ${line}`)
					.join('\n');
			})
			.join('\n');
	}

	/**
	 * Converts a table node to Markdown table format.
	 *
	 * Processes table rows and generates a properly formatted Markdown table
	 * with pipe separators. Automatically adds a header separator row after
	 * the first row to comply with Markdown table syntax.
	 *
	 * TODO: Add unit tests to cover edge cases:
	 * - Tables with no content
	 * - Single row tables
	 * - Tables with missing cells
	 * - Complex nested content in cells
	 *
	 * @private
	 * @param {ProseMirrorNode} node - Table node containing row nodes
	 * @returns {string} Formatted Markdown table
	 *
	 * @example
	 * ```typescript
	 * const tableNode = {
	 *   type: 'table',
	 *   content: [
	 *     {
	 *       type: 'tableRow',
	 *       content: [
	 *         { type: 'tableCell', content: [{ type: 'text', text: 'Header 1' }] },
	 *         { type: 'tableCell', content: [{ type: 'text', text: 'Header 2' }] }
	 *       ]
	 *     },
	 *     {
	 *       type: 'tableRow',
	 *       content: [
	 *         { type: 'tableCell', content: [{ type: 'text', text: 'Cell 1' }] },
	 *         { type: 'tableCell', content: [{ type: 'text', text: 'Cell 2' }] }
	 *       ]
	 *     }
	 *   ]
	 * };
	 * const result = this.convertTable(tableNode);
	 * // Result: "| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |"
	 * ```
	 */
	private convertTable(node: ProseMirrorNode): string {
		if (!node.content) {
			return '';
		}

		const rows = node.content.map(row => this.convertTableRow(row));

		if (rows.length === 0) {
			return '';
		}

		// Add header separator after first row
		if (rows.length > 0) {
			const headerSeparator = this.generateTableHeaderSeparator(rows[0]);
			rows.splice(1, 0, headerSeparator);
		}

		return rows.join('\n');
	}

	/**
	 * Converts a table row node to a Markdown table row.
	 *
	 * Processes all table cells in the row and joins them with pipe
	 * separators to create a properly formatted table row string.
	 *
	 * @private
	 * @param {ProseMirrorNode} node - Table row node containing cell nodes
	 * @returns {string} Markdown table row with pipe separators
	 *
	 * @example
	 * ```typescript
	 * const tableRowNode = {
	 *   type: 'tableRow',
	 *   content: [
	 *     { type: 'tableCell', content: [{ type: 'text', text: 'First' }] },
	 *     { type: 'tableCell', content: [{ type: 'text', text: 'Second' }] }
	 *   ]
	 * };
	 * const result = this.convertTableRow(tableRowNode);
	 * // Result: "| First | Second |"
	 * ```
	 */
	private convertTableRow(node: ProseMirrorNode): string {
		if (!node.content) {
			return '|  |';
		}

		const cells = node.content.map(cell => {
			const content = cell.content?.map(child => this.convertNode(child)).join('') || '';
			return ` ${content.trim()} `;
		});

		return `|${cells.join('|')}|`;
	}

	/**
	 * Generates a Markdown table header separator row.
	 *
	 * Creates the required separator row that goes between the header
	 * and data rows in Markdown tables. Counts the number of columns
	 * from the header row and generates appropriate "---" separators.
	 *
	 * TODO: Add unit tests to cover edge cases:
	 * - Header rows with no pipes
	 * - Header rows with escaped pipes
	 * - Malformed header rows
	 *
	 * @private
	 * @param {string} headerRow - The header row string to analyze
	 * @returns {string} Separator row with "---" for each column
	 *
	 * @example
	 * ```typescript
	 * const headerRow = "| Name | Age | City |";
	 * const separator = this.generateTableHeaderSeparator(headerRow);
	 * // Result: "| --- | --- | --- |"
	 * ```
	 */
	private generateTableHeaderSeparator(headerRow: string): string {
		const cellCount = (headerRow.match(/\|/g) || []).length - 1;
		const separators = Array(cellCount).fill(' --- ');
		return `|${separators.join('|')}|`;
	}

	/**
	 * Extracts metadata from a Granola document to create YAML frontmatter.
	 *
	 * Transforms the Granola document metadata into a standardized frontmatter
	 * structure that will be embedded at the top of the Markdown file.
	 * Provides consistent metadata format across all imported documents.
	 *
	 * @private
	 * @param {GranolaDocument} doc - Source Granola document
	 * @returns {NoteFrontmatter} Structured metadata for YAML frontmatter
	 *
	 * @example
	 * ```typescript
	 * const granolaDoc = {
	 *   id: 'doc-123',
	 *   title: 'Meeting Notes',
	 *   created_at: '2024-01-01T10:00:00Z',
	 *   updated_at: '2024-01-01T11:00:00Z',
	 *   content: {...}
	 * };
	 * const frontmatter = this.generateFrontmatter(granolaDoc);
	 * // Result: { id: 'doc-123', title: 'Meeting Notes', created: '2024-01-01T10:00:00Z', ... }
	 * ```
	 */
	private generateFrontmatter(doc: GranolaDocument): NoteFrontmatter {
		return {
			id: doc.id,
			title: doc.title || 'Untitled',
			created: doc.created_at,
			updated: doc.updated_at,
			source: 'Granola',
		};
	}

	/**
	 * Combines YAML frontmatter and Markdown content into final file content.
	 *
	 * Creates the complete file content by serializing the frontmatter metadata
	 * to YAML format, wrapping it in frontmatter delimiters (---), and appending
	 * the converted Markdown content. Handles proper escaping of YAML values.
	 *
	 * @private
	 * @param {NoteFrontmatter} frontmatter - Document metadata
	 * @param {string} markdown - Converted Markdown content
	 * @returns {string} Complete file content ready for writing to vault
	 *
	 * @example
	 * ```typescript
	 * const frontmatter = {
	 *   id: 'doc-123',
	 *   title: 'My "Special" Document',
	 *   created: '2024-01-01T10:00:00Z',
	 *   updated: '2024-01-01T11:00:00Z',
	 *   source: 'Granola'
	 * };
	 * const markdown = '# Document Title\n\nContent here.';
	 * const content = this.generateFileContent(frontmatter, markdown);
	 * // Result: "---\nid: doc-123\ntitle: \"My \\\"Special\\\" Document\"\n...\n---\n\n# Document Title\n\nContent here."
	 * ```
	 */
	private generateFileContent(frontmatter: NoteFrontmatter, markdown: string): string {
		const yamlFrontmatter = [
			'---',
			`id: ${frontmatter.id}`,
			`title: "${frontmatter.title.replace(/"/g, '\\"')}"`,
			`created: ${frontmatter.created}`,
			`updated: ${frontmatter.updated}`,
			`source: ${frontmatter.source}`,
			'---',
			'',
		].join('\n');

		return yamlFrontmatter + markdown;
	}

	/**
	 * Sanitizes a document title for use as a safe filename.
	 *
	 * Removes or replaces characters that are invalid in filenames across
	 * different operating systems. Handles edge cases like excessive whitespace,
	 * long titles, and special characters that could cause file system issues.
	 *
	 * @private
	 * @param {string} filename - Raw document title to sanitize
	 * @returns {string} Safe filename suitable for file system use
	 *
	 * @example
	 * ```typescript
	 * const unsafeTitle = 'My Document: "Special" <Notes> | 2024';
	 * const safeFilename = this.sanitizeFilename(unsafeTitle);
	 * // Result: "My Document- -Special- -Notes- - 2024"
	 *
	 * const longTitle = 'A'.repeat(200);
	 * const truncated = this.sanitizeFilename(longTitle);
	 * // Result: 'A'.repeat(100) (truncated to 100 characters)
	 * ```
	 */
	private sanitizeFilename(filename: string): string {
		// Remove or replace invalid filename characters
		return filename
			.replace(/[<>:"/\\|?*]/g, '-')
			.replace(/\s+/g, ' ')
			.trim()
			.substring(0, MAX_FILENAME_LENGTH); // Limit length
	}
}
