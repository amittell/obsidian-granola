import { ProseMirrorDoc, ProseMirrorNode, GranolaDocument } from './api';
import { Logger, GranolaSettings } from './types';

// Converter Constants (removing unused constant)
// const MAX_FILENAME_LENGTH = 100;

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
 * to preserve document metadata. The frontmatter follows standard YAML format
 * and is compatible with Obsidian's metadata system.
 *
 * @interface NoteFrontmatter
 * @since 1.0.0
 */
export interface NoteFrontmatter {
	/** ISO timestamp when the document was created */
	created: string;

	/** Source attribution, always "Granola" for imported documents */
	source: string;

	/** Optional: Original Granola document identifier (when enhanced frontmatter enabled) */
	id?: string;

	/** Optional: Document title, escaped for YAML compatibility (when enhanced frontmatter enabled) */
	title?: string;

	/** Optional: ISO timestamp when the document was last updated (when enhanced frontmatter enabled) */
	updated?: string;
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
 * const converter = new ProseMirrorConverter(logger);
 * const granolaDoc = await api.getDocument('doc-id');
 * const convertedNote = converter.convertDocument(granolaDoc);
 *
 * console.log(convertedNote.filename); // "My Document.md"
 * console.log(convertedNote.content);  // "---\nid: doc-id\n...\n# My Document\n..."
 * ```
 */
export class ProseMirrorConverter {
	private logger: Logger;
	private settings: GranolaSettings;

	constructor(logger: Logger, settings: GranolaSettings) {
		this.logger = logger;
		this.settings = settings;
	}

	/**
	 * Updates the converter settings.
	 *
	 * @param {GranolaSettings} settings - New settings to apply
	 */
	updateSettings(settings: GranolaSettings): void {
		this.settings = settings;
	}
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
		// Debug logging for content analysis
		this.logger.debug(`========== Processing document: ${doc.id} - "${doc.title}" ==========`);
		this.logger.debug(`Document created_at: ${doc.created_at}`);
		this.logger.debug(`Document updated_at: ${doc.updated_at}`);
		this.logger.debug(`Notes field exists: ${!!doc.notes}`);
		this.logger.debug(`Notes plain exists: ${!!doc.notes_plain}`);
		this.logger.debug(`Notes markdown exists: ${!!doc.notes_markdown}`);
		this.logger.debug(`Last viewed panel exists: ${!!doc.last_viewed_panel}`);
		this.logger.debug(`Last viewed panel content exists: ${!!doc.last_viewed_panel?.content}`);

		if (doc.last_viewed_panel?.content) {
			this.logger.debug(
				`Last viewed panel content type: ${doc.last_viewed_panel.content.type}`
			);
			this.logger.debug(
				`Last viewed panel content array length: ${doc.last_viewed_panel.content.content ? doc.last_viewed_panel.content.content.length : 'NO CONTENT ARRAY'}`
			);
			this.logger.debug(
				`Last viewed panel full structure:`,
				JSON.stringify(doc.last_viewed_panel.content, null, 2)
			);
		}

		if (doc.notes) {
			this.logger.debug(`Notes structure type: ${doc.notes.type}`);
			this.logger.debug(
				`Notes content array length: ${doc.notes.content ? doc.notes.content.length : 'NO CONTENT ARRAY'}`
			);
			this.logger.debug(`Notes full structure:`, JSON.stringify(doc.notes, null, 2));
		}

		if (doc.notes_plain) {
			this.logger.debug(`Notes plain length: ${doc.notes_plain.length}`);
			this.logger.debug(`Notes plain preview: ${doc.notes_plain.substring(0, 200)}`);
		}
		if (doc.notes_markdown) {
			this.logger.debug(`Notes markdown length: ${doc.notes_markdown.length}`);
			this.logger.debug(`Notes markdown preview: ${doc.notes_markdown.substring(0, 200)}`);
		}

		// Content validation and fallback logic
		let markdown = '';
		let contentSource = 'unknown';

		// Try last_viewed_panel.content first (the correct location per reverse engineering)
		if (
			doc.last_viewed_panel?.content &&
			this.isValidProseMirrorDoc(doc.last_viewed_panel.content)
		) {
			this.logger.debug(`Attempting conversion from last_viewed_panel.content`);
			markdown = this.convertProseMirrorToMarkdown(doc.last_viewed_panel.content);
			contentSource = 'last_viewed_panel';
			this.logger.debug(`Last viewed panel conversion result - length: ${markdown.length}`);
			if (markdown.trim()) {
				this.logger.debug(`Last viewed panel conversion successful`);
			} else {
				this.logger.warn(
					`Last viewed panel conversion produced empty content despite valid structure`
				);
			}
		}

		// Fallback: Try ProseMirror conversion from notes field
		if (!markdown.trim() && doc.notes && this.isValidProseMirrorDoc(doc.notes)) {
			this.logger.debug(`Attempting conversion from notes field as fallback`);
			markdown = this.convertProseMirrorToMarkdown(doc.notes);
			contentSource = 'prosemirror';
			this.logger.debug(`Notes field conversion result - length: ${markdown.length}`);
			if (markdown.trim()) {
				this.logger.debug(`Notes field conversion successful`);
			} else {
				this.logger.warn(
					`Notes field conversion produced empty content despite valid structure`
				);
			}
		}

		// Fallback to notes_markdown if ProseMirror conversion failed or is empty
		if (!markdown.trim() && doc.notes_markdown?.trim()) {
			markdown = doc.notes_markdown.trim();
			contentSource = 'markdown';
			this.logger.debug(`Using notes_markdown fallback, length: ${markdown.length}`);
		}

		// Final fallback to notes_plain if everything else failed
		if (!markdown.trim() && doc.notes_plain?.trim()) {
			markdown = doc.notes_plain.trim();
			contentSource = 'plain';
			this.logger.debug(`Using notes_plain fallback, length: ${markdown.length}`);
		}

		// Log final content status
		this.logger.info(`Final content source: ${contentSource}`);
		this.logger.info(`Final markdown length: ${markdown.length}`);
		this.logger.debug(`Content preview: ${markdown.substring(0, 200)}...`);

		// Handle documents that appear empty but might have content in Granola
		if (!markdown.trim()) {
			this.logger.warn(
				`WARNING: No content extracted for document ${doc.id} - "${doc.title}"`
			);
			this.logger.warn(
				`Creating placeholder document - content may need to be manually synced from Granola`
			);

			// Create a helpful placeholder instead of failing completely
			markdown = `# ${doc.title}\n\n*This document appears to have no extractable content from the Granola API.*\n\n*Possible causes:*\n- Content exists in Granola but wasn't included in the API response\n- Document was created but never had content added\n- Sync issue between Granola desktop app and API\n\n*To fix: Check the original document in Granola and manually copy content if needed.*\n\n---\n*Document ID: ${doc.id}*\n*Created: ${doc.created_at}*\n*Updated: ${doc.updated_at}*`;
		}

		const frontmatter = this.generateFrontmatter(doc);
		const filename = this.generateFilename(doc);

		const content = this.generateFileContent(frontmatter, markdown);

		return {
			filename: `${filename}.md`,
			content,
			frontmatter,
		};
	}

	/**
	 * Generates a filename for the converted document based on settings.
	 *
	 * Creates filenames with optional date prefix based on datePrefixFormat setting.
	 * This allows flexible filename formats while preventing duplicates.
	 *
	 * @private
	 * @param {GranolaDocument} doc - Source document with title and created_at
	 * @returns {string} Filename without extension
	 */
	private generateFilename(doc: GranolaDocument): string {
		// Get sanitized title
		const title = doc.title || `Untitled-${doc.id}`;
		const sanitizedTitle = this.sanitizeFilename(title);

		// Check if date prefix is disabled
		if (this.settings.content.datePrefixFormat === 'none') {
			return sanitizedTitle;
		}

		// Generate date prefix using existing method
		return this.generateDatePrefixedFilename(doc);
	}

	/**
	 * Generates a date-prefixed filename using the document's created_at timestamp.
	 *
	 * Creates filenames in the format: "YYYY-MM-DD - Title.md"
	 * This prevents duplicate filenames for recurring meetings with identical titles
	 * while making files sortable and searchable by date.
	 *
	 * @private
	 * @param {GranolaDocument} doc - Source document with title and created_at
	 * @returns {string} Date-prefixed filename without extension
	 *
	 * @example
	 * ```typescript
	 * const doc = {
	 *   title: 'Alex <> Shannon 1:1',
	 *   created_at: '2025-06-21T14:30:00.000Z',
	 *   id: 'abc123'
	 * };
	 * const filename = this.generateDatePrefixedFilename(doc);
	 * // Result: "2025-06-21 - Alex  Shannon 1-1"
	 * ```
	 */
	private generateDatePrefixedFilename(doc: GranolaDocument): string {
		this.logger.debug(`Generating date-prefixed filename for: ${doc.id}`);
		this.logger.debug(`Original title: "${doc.title}"`);
		this.logger.debug(`Created at: ${doc.created_at}`);

		// Extract date from created_at timestamp
		let datePrefix = '';
		try {
			const createdDate = new Date(doc.created_at);
			if (isNaN(createdDate.getTime())) {
				this.logger.warn(`Invalid created_at date: ${doc.created_at}`);
				datePrefix = 'INVALID-DATE';
			} else {
				// Format as YYYY-MM-DD
				const year = createdDate.getFullYear();
				const month = (createdDate.getMonth() + 1).toString().padStart(2, '0');
				const day = createdDate.getDate().toString().padStart(2, '0');
				datePrefix = `${year}-${month}-${day}`;
			}
		} catch (error) {
			this.logger.error(`Error parsing date: ${error}`);
			datePrefix = 'INVALID-DATE';
		}

		// Get sanitized title
		const title = doc.title || `Untitled-${doc.id}`;
		const sanitizedTitle = this.sanitizeFilename(title);

		// Combine date prefix with title
		const filename = `${datePrefix} - ${sanitizedTitle}`;

		this.logger.debug(`Generated filename: "${filename}"`);

		return filename;
	}

	/**
	 * Validates whether a ProseMirror document has valid structure.
	 *
	 * This function validates the basic structure of a ProseMirror document
	 * but does not reject documents based on text extraction failures.
	 * Content extraction should happen during conversion, not validation.
	 *
	 * @private
	 * @param {ProseMirrorDoc} doc - ProseMirror document to validate
	 * @returns {boolean} True if document has valid structure
	 */
	private isValidProseMirrorDoc(doc: ProseMirrorDoc): boolean {
		if (!doc) {
			this.logger.debug(`ProseMirror doc is null/undefined`);
			return false;
		}

		if (doc.type !== 'doc') {
			this.logger.debug(`ProseMirror doc has invalid type: ${doc.type}`);
			return false;
		}

		if (!doc.content || !Array.isArray(doc.content)) {
			this.logger.debug(`ProseMirror doc has no content array`);
			return false;
		}

		if (doc.content.length === 0) {
			this.logger.debug(`ProseMirror doc has empty content array`);
			return false;
		}

		// Log document structure for debugging
		this.logger.debug(`ProseMirror validation - Content nodes: ${doc.content.length}`);
		this.logger.debug(
			`ProseMirror validation - Document structure:`,
			JSON.stringify(doc, null, 2)
		);

		// Only validate structure - let conversion handle text extraction
		this.logger.debug(`ProseMirror doc structure validation passed`);
		return true;
	}

	/**
	 * Recursively extracts all text content from ProseMirror nodes.
	 *
	 * @private
	 * @param {ProseMirrorNode[]} nodes - Array of ProseMirror nodes to extract text from
	 * @returns {string} Concatenated text content from all nodes
	 */
	private extractTextFromNodes(nodes: ProseMirrorNode[]): string {
		let text = '';

		this.logger.debug(`extractTextFromNodes called with ${nodes.length} nodes`);

		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			this.logger.debug(`Processing node ${i}:`, JSON.stringify(node, null, 2));

			try {
				// Method 1: Direct text node
				if (node.text) {
					this.logger.debug(`Found direct text: "${node.text}"`);
					text += node.text;
				}

				// Method 2: Node with children - recurse
				if (node.content && node.content.length > 0) {
					this.logger.debug(`Node has ${node.content.length} children, recursing...`);
					const childText = this.extractTextFromNodes(node.content);
					this.logger.debug(`Child text extracted: "${childText}"`);
					text += childText;
				}

				// Method 3: Special case for empty content arrays that might have text in attrs
				if (node.type === 'paragraph' && !node.content?.length) {
					this.logger.debug(`Empty paragraph node, checking attrs:`, node.attrs);
				}
			} catch (error) {
				this.logger.warn(`Error extracting text from node:`, error, node);
				// Continue with other nodes even if one fails
			}
		}

		return text;
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
		this.logger.debug(`convertProseMirrorToMarkdown called with:`, doc);

		try {
			// Handle undefined/null doc
			if (!doc) {
				this.logger.debug(`Document is null/undefined`);
				return '';
			}

			if (!doc.content || doc.content.length === 0) {
				this.logger.debug(`Document content is empty or missing`);
				this.logger.debug(`Doc structure:`, JSON.stringify(doc, null, 2));
				return '';
			}

			this.logger.debug(`Converting ${doc.content.length} top-level nodes`);

			const convertedNodes: string[] = [];

			for (let index = 0; index < doc.content.length; index++) {
				const node = doc.content[index];
				try {
					this.logger.debug(`Converting node ${index}:`, node.type, node);
					const converted = this.convertNode(node);
					this.logger.debug(`Node ${index} converted to:`, converted);
					convertedNodes.push(converted);
				} catch (nodeError) {
					const errorMsg =
						nodeError instanceof Error ? nodeError.message : 'Unknown error';
					this.logger.error(`Error converting node ${index} (${node.type}):`, errorMsg);
					this.logger.error(`Problematic node:`, JSON.stringify(node, null, 2));

					// Add a placeholder for failed nodes so conversion can continue
					convertedNodes.push(
						`[Error converting ${node.type || 'unknown'} node: ${errorMsg}]`
					);
				}
			}

			const result = convertedNodes.join('\n\n').trim();
			this.logger.debug(`Final conversion result:`, result);

			return result;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			this.logger.error(`Fatal error in ProseMirror conversion:`, errorMsg);
			this.logger.error(`Document structure:`, JSON.stringify(doc, null, 2));

			// Return error information for debugging
			return `[Error: ProseMirror conversion failed - ${errorMsg}]`;
		}
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
	 * When enhanced frontmatter is enabled in settings, includes additional
	 * fields like document ID, title, and updated timestamp.
	 *
	 * @private
	 * @param {GranolaDocument} doc - Source Granola document
	 * @returns {NoteFrontmatter} Structured metadata for YAML frontmatter
	 *
	 * @example
	 * ```typescript
	 * // Basic frontmatter (default)
	 * const frontmatter = this.generateFrontmatter(granolaDoc);
	 * // Result: { created: '2024-01-01T10:00:00Z', source: 'Granola' }
	 *
	 * // Enhanced frontmatter (when setting enabled)
	 * // Result: { id: 'doc-123', title: 'Meeting Notes', created: '...', updated: '...', source: 'Granola' }
	 * ```
	 */
	private generateFrontmatter(doc: GranolaDocument): NoteFrontmatter {
		const frontmatter: NoteFrontmatter = {
			created: doc.created_at,
			source: 'Granola',
		};

		// Add enhanced fields if setting is enabled
		if (this.settings.content.includeEnhancedFrontmatter) {
			frontmatter.id = doc.id;
			frontmatter.title = doc.title || 'Untitled';
			frontmatter.updated = doc.updated_at;
		}

		return frontmatter;
	}

	/**
	 * Combines YAML frontmatter and Markdown content into final file content.
	 *
	 * Creates the complete file content by serializing the frontmatter metadata
	 * to YAML format, wrapping it in frontmatter delimiters (---), and appending
	 * the converted Markdown content. Handles proper escaping of YAML values.
	 *
	 * Includes enhanced frontmatter fields (id, title, updated) when present.
	 *
	 * @private
	 * @param {NoteFrontmatter} frontmatter - Document metadata
	 * @param {string} markdown - Converted Markdown content
	 * @returns {string} Complete file content ready for writing to vault
	 *
	 * @example
	 * ```typescript
	 * // Basic frontmatter
	 * const frontmatter = { created: '2024-01-01T10:00:00Z', source: 'Granola' };
	 * const content = this.generateFileContent(frontmatter, markdown);
	 * // Result: "---\ncreated: 2024-01-01T10:00:00Z\nsource: Granola\n---\n\n# Title\n..."
	 *
	 * // Enhanced frontmatter
	 * const enhanced = { id: 'doc-123', title: 'My "Notes"', created: '...', updated: '...', source: 'Granola' };
	 * // Result: "---\nid: doc-123\ntitle: \"My \\\"Notes\\\"\"\ncreated: ...\n---\n\n# Title\n..."
	 * ```
	 */
	private generateFileContent(frontmatter: NoteFrontmatter, markdown: string): string {
		const yamlLines = ['---'];

		// Add enhanced fields first if present
		if (frontmatter.id) {
			yamlLines.push(`id: ${frontmatter.id}`);
		}
		if (frontmatter.title) {
			// Escape quotes in title for YAML
			const escapedTitle = frontmatter.title.replace(/"/g, '\\"');
			yamlLines.push(`title: "${escapedTitle}"`);
		}

		// Always include basic fields
		yamlLines.push(`created: ${frontmatter.created}`);

		if (frontmatter.updated) {
			yamlLines.push(`updated: ${frontmatter.updated}`);
		}

		yamlLines.push(`source: ${frontmatter.source}`);
		yamlLines.push('---', '');

		return yamlLines.join('\n') + markdown;
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
			.substring(0, this.settings.import.maxFilenameLength); // Limit length
	}
}
