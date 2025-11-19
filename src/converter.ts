import { htmlToMarkdown, stringifyYaml } from 'obsidian';
import { ProseMirrorDoc, ProseMirrorNode, GranolaDocument } from './api';
import { Logger, GranolaSettings, DatePrefixFormat } from './types';
import { decodeHtmlEntities } from './utils/html';

// Converter Constants

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

	/** Whether this document is truly empty (never modified after creation) */
	isTrulyEmpty?: boolean;
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

	/** Optional: Direct URL to the Granola note (when includeGranolaUrl enabled) */
	granola_url?: string;

	/** Optional: Tags array for attendees and other metadata */
	tags?: string[];
}

/**
 * Result of document structure validation.
 *
 * @interface DocumentValidationResult
 * @since 1.1.0
 */
export interface DocumentValidationResult {
	/** Whether the document passed validation */
	isValid: boolean;

	/** Reason for validation failure, if any */
	reason?: string;

	/** Detected content sources available for conversion */
	availableContentSources: Array<
		| 'last_viewed_panel_html'
		| 'last_viewed_panel_prosemirror'
		| 'notes_prosemirror'
		| 'notes_markdown'
		| 'notes_plain'
	>;

	/** Whether the document appears to be empty */
	isEmpty: boolean;

	/** Validation warnings that don't prevent conversion */
	warnings: string[];
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
	 * @throws {Error} When document is invalid or conversion fails critically
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
		// Enhanced content validation before conversion
		const validationResult = this.validateDocumentStructure(doc);
		if (!validationResult.isValid) {
			throw new Error(`Document validation failed: ${validationResult.reason}`);
		}
		// Debug logging for content analysis
		this.logger.debug(
			`========== Processing document: ${doc.id} - "${decodeHtmlEntities(doc.title)}" ==========`
		);
		this.logger.debug(`Document created_at: ${doc.created_at}`);
		this.logger.debug(`Document updated_at: ${doc.updated_at}`);
		this.logger.debug(`Notes field exists: ${!!doc.notes}`);
		this.logger.debug(`Notes plain exists: ${!!doc.notes_plain}`);
		this.logger.debug(`Notes markdown exists: ${!!doc.notes_markdown}`);
		this.logger.debug(`Last viewed panel exists: ${!!doc.last_viewed_panel}`);
		this.logger.debug(`Last viewed panel content exists: ${!!doc.last_viewed_panel?.content}`);

		// Enhanced debugging for empty document detection
		if (doc.notes_plain) {
			this.logger.debug(`Notes plain length: ${doc.notes_plain.length}`);
			this.logger.debug(`Notes plain trimmed length: ${doc.notes_plain.trim().length}`);
			this.logger.debug(
				`Notes plain preview (first 100 chars): ${doc.notes_plain.substring(0, 100)}`
			);
		}
		if (doc.notes_markdown) {
			this.logger.debug(`Notes markdown length: ${doc.notes_markdown.length}`);
			this.logger.debug(`Notes markdown trimmed length: ${doc.notes_markdown.trim().length}`);
			this.logger.debug(
				`Notes markdown preview (first 100 chars): ${doc.notes_markdown.substring(0, 100)}`
			);
		}

		// Log all available fields in the document for investigation
		this.logger.debug(`All document fields: ${Object.keys(doc).join(', ')}`);

		if (doc.last_viewed_panel?.content) {
			const panelContent = doc.last_viewed_panel.content;
			if (typeof panelContent === 'string') {
				this.logger.debug(`Last viewed panel content type: HTML string`);
				this.logger.debug(`Last viewed panel content length: ${panelContent.length}`);
			} else {
				this.logger.debug(`Last viewed panel content type: ${panelContent.type}`);
				this.logger.debug(
					`Last viewed panel content array length: ${panelContent.content ? panelContent.content.length : 'NO CONTENT ARRAY'}`
				);
			}
			this.logger.debug(
				`Last viewed panel full structure:`,
				JSON.stringify(panelContent, null, 2)
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
		if (doc.last_viewed_panel?.content) {
			const panelContent = doc.last_viewed_panel.content;
			// Check if content is HTML string (newer API format)
			if (typeof panelContent === 'string') {
				this.logger.debug(
					`Attempting conversion from last_viewed_panel.content (HTML format)`
				);
				markdown = this.convertHtmlToMarkdown(panelContent);
				contentSource = 'last_viewed_panel_html';
				this.logger.debug(
					`Last viewed panel HTML conversion result - length: ${markdown.length}`
				);
				if (markdown.trim()) {
					this.logger.debug(`Last viewed panel HTML conversion successful`);
				} else {
					this.logger.warn(`Last viewed panel HTML conversion produced empty content`);
				}
			}
			// Check if content is ProseMirror JSON (legacy format)
			else if (this.isValidProseMirrorDoc(panelContent)) {
				this.logger.debug(
					`Attempting conversion from last_viewed_panel.content (ProseMirror format)`
				);
				markdown = this.convertProseMirrorToMarkdown(panelContent);
				contentSource = 'last_viewed_panel_prosemirror';
				this.logger.debug(
					`Last viewed panel ProseMirror conversion result - length: ${markdown.length}`
				);
				if (markdown.trim()) {
					this.logger.debug(`Last viewed panel ProseMirror conversion successful`);
				} else {
					this.logger.warn(
						`Last viewed panel ProseMirror conversion produced empty content despite valid structure`
					);
					// Additional debugging for failed conversions
					this.logger.debug(
						`Panel content structure that failed conversion:`,
						JSON.stringify(panelContent, null, 2)
					);
					// Try text extraction directly to see what we can get
					const extractedText = this.extractTextFromNodes(panelContent.content || []);
					this.logger.debug(
						`Direct text extraction from panel content: "${extractedText}"`
					);
					if (extractedText.trim()) {
						this.logger.warn(
							`Text extraction found content that conversion missed: "${extractedText}"`
						);
						markdown = extractedText; // Use extracted text as fallback
						contentSource = 'panel_text_extraction';
					}
				}
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
				// Additional debugging for failed conversions
				this.logger.debug(
					`Notes field structure that failed conversion:`,
					JSON.stringify(doc.notes, null, 2)
				);
				// Try text extraction directly to see what we can get
				const extractedText = this.extractTextFromNodes(doc.notes.content || []);
				this.logger.debug(`Direct text extraction from notes field: "${extractedText}"`);
				if (extractedText.trim()) {
					this.logger.warn(
						`Text extraction found content that conversion missed: "${extractedText}"`
					);
					markdown = extractedText; // Use extracted text as fallback
					contentSource = 'notes_text_extraction';
				}
			}
		}

		// Fallback to notes_markdown if ProseMirror conversion failed or is empty
		if (!markdown.trim() && doc.notes_markdown?.trim()) {
			markdown = decodeHtmlEntities(doc.notes_markdown.trim());
			contentSource = 'markdown';
			this.logger.debug(`Using notes_markdown fallback, length: ${markdown.length}`);
		}

		// Final fallback to notes_plain if everything else failed
		if (!markdown.trim() && doc.notes_plain?.trim()) {
			markdown = decodeHtmlEntities(doc.notes_plain.trim());
			contentSource = 'plain';
			this.logger.debug(`Using notes_plain fallback, length: ${markdown.length}`);
		}

		// Log final content status
		this.logger.info(`Final content source: ${contentSource}`);
		this.logger.info(`Final markdown length: ${markdown.length}`);
		this.logger.debug(`Content preview: ${markdown.substring(0, 200)}...`);

		// Track if document is truly empty
		let isTrulyEmpty = false;

		// Handle documents that appear empty but might have content in Granola
		if (!markdown.trim()) {
			// Enhanced empty document analysis
			const emptyAnalysis = {
				hasNotes: !!doc.notes,
				hasNotesContent: (doc.notes?.content?.length ?? 0) > 0,
				hasNotesPlain: !!doc.notes_plain?.trim(),
				hasNotesMarkdown: !!doc.notes_markdown?.trim(),
				hasLastViewedPanel: !!doc.last_viewed_panel,
				hasLastViewedPanelContent: !!doc.last_viewed_panel?.content,
				createdEqualsUpdated: doc.created_at === doc.updated_at,
				timeSinceCreation: new Date().getTime() - new Date(doc.created_at).getTime(),
				timeSinceUpdate: new Date().getTime() - new Date(doc.updated_at).getTime(),
			};

			this.logger.warn(
				`WARNING: No content extracted for document ${doc.id} - "${decodeHtmlEntities(doc.title)}"`
			);
			this.logger.warn(`Empty document analysis:`, JSON.stringify(emptyAnalysis, null, 2));

			// Determine if this is truly empty or a conversion failure
			// A document is truly empty if:
			// 1. It was never modified after creation (created_at === updated_at)
			// 2. It has no plain text or markdown content
			// 3. It has no last_viewed_panel content (the primary content source)
			// 4. The markdown conversion produced no meaningful content (empty after trim)
			isTrulyEmpty =
				emptyAnalysis.createdEqualsUpdated &&
				!emptyAnalysis.hasNotesPlain &&
				!emptyAnalysis.hasNotesMarkdown &&
				!emptyAnalysis.hasLastViewedPanelContent;

			if (isTrulyEmpty) {
				this.logger.info(
					`Document appears to be truly empty (never modified after creation)`
				);
			} else {
				this.logger.warn(`Document may have content that failed to convert`);
			}

			this.logger.warn(
				`Creating placeholder document - content may need to be manually synced from Granola`
			);

			// Create a helpful placeholder instead of failing completely
			markdown = `# ${decodeHtmlEntities(doc.title)}\n\n*This document appears to have no extractable content from the Granola API.*\n\n*Possible causes:*\n- Content exists in Granola but wasn't included in the API response\n- Document was created but never had content added\n- Sync issue between Granola desktop app and API\n\n*To fix: Check the original document in Granola and manually copy content if needed.*\n\n---\n*Document ID: ${doc.id}*\n*Created: ${doc.created_at}*\n*Updated: ${doc.updated_at}*`;
		}

		// Process action items if enabled
		if (this.settings.actionItems.convertToTasks) {
			markdown = this.processActionItems(markdown);
		}

		const frontmatter = this.generateFrontmatter(doc);
		const filename = this.generateFilename(doc);

		const content = this.generateFileContent(frontmatter, markdown);

		return {
			filename: `${filename}.md`,
			content,
			frontmatter,
			isTrulyEmpty: isTrulyEmpty,
		};
	}

	/**
	 * Generates a filename for the converted document based on settings.
	 *
	 * Creates filenames using a template system that supports variables.
	 * This allows flexible filename formats while preventing duplicates.
	 *
	 * @private
	 * @param {GranolaDocument} doc - Source document with title and created_at
	 * @returns {string} Filename without extension
	 */
	private generateFilename(doc: GranolaDocument): string {
		// Get sanitized title and decode HTML entities
		const title = decodeHtmlEntities(doc.title || `Untitled-${doc.id}`);
		const sanitizedTitle = this.sanitizeFilename(title);

		// If not using custom template, use the original date-prefix behavior
		if (!this.settings.content.useCustomFilenameTemplate) {
			const createdDate = new Date(doc.created_at);
			const dateFormat = this.settings.content.datePrefixFormat;

			// Original behavior: add date prefix if format is not NONE
			if (dateFormat === DatePrefixFormat.NONE) {
				return sanitizedTitle;
			} else {
				const formattedDate = this.formatDate(createdDate, dateFormat);
				return `${formattedDate} - ${sanitizedTitle}`;
			}
		}

		// Custom template logic
		const template = this.settings.content.filenameTemplate || '{created_date} - {title}';

		// Create date formatters
		const createdDate = new Date(doc.created_at);
		const updatedDate = new Date(doc.updated_at);

		// Format dates according to settings
		const dateFormat = this.settings.content.datePrefixFormat;
		const formattedCreatedDate = this.formatDate(createdDate, dateFormat);
		const formattedUpdatedDate = this.formatDate(updatedDate, dateFormat);

		// Format times
		const createdTime = this.formatTime(createdDate);
		const updatedTime = this.formatTime(updatedDate);

		// Replace template variables (longer variables first to avoid substring conflicts)
		const filename = template
			.replace(/{created_datetime}/g, `${formattedCreatedDate}_${createdTime}`)
			.replace(/{updated_datetime}/g, `${formattedUpdatedDate}_${updatedTime}`)
			.replace(/{created_date}/g, formattedCreatedDate)
			.replace(/{updated_date}/g, formattedUpdatedDate)
			.replace(/{created_time}/g, createdTime)
			.replace(/{updated_time}/g, updatedTime)
			.replace(/{title}/g, sanitizedTitle)
			.replace(/{id}/g, doc.id);

		// Sanitize the final filename
		return this.sanitizeFilename(filename);
	}

	/**
	 * Formats a date according to the specified format setting.
	 *
	 * @private
	 * @param {Date} date - Date to format
	 * @param {DatePrefixFormat} format - Format setting
	 * @returns {string} Formatted date string
	 */
	private formatDate(date: Date, format: DatePrefixFormat): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');

		switch (format) {
			case DatePrefixFormat.ISO_DATE:
				return `${year}-${month}-${day}`;
			case DatePrefixFormat.US_DATE:
				return `${month}-${day}-${year}`;
			case DatePrefixFormat.EU_DATE:
				return `${day}-${month}-${year}`;
			case DatePrefixFormat.DOT_DATE:
				return `${year}.${month}.${day}`;
			case DatePrefixFormat.NONE:
				return ''; // No date prefix
			default:
				return `${year}-${month}-${day}`; // Default to ISO
		}
	}

	/**
	 * Formats a time as HH-mm-ss.
	 *
	 * @private
	 * @param {Date} date - Date to extract time from
	 * @returns {string} Formatted time string
	 */
	private formatTime(date: Date): string {
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');
		return `${hours}-${minutes}-${seconds}`;
	}

	/**
	 * Validates document structure before attempting conversion.
	 *
	 * Performs comprehensive validation of the document structure to identify
	 * potential issues early and provide clear error messages. This helps
	 * prevent conversion failures and gives better user feedback.
	 *
	 * @private
	 * @param {GranolaDocument} doc - Document to validate
	 * @returns {DocumentValidationResult} Validation result with details
	 */
	private validateDocumentStructure(doc: GranolaDocument): DocumentValidationResult {
		const result: DocumentValidationResult = {
			isValid: true,
			availableContentSources: [],
			isEmpty: true,
			warnings: [],
		};

		// Critical validation: Document must exist and have basic structure
		if (!doc) {
			result.isValid = false;
			result.reason = 'Document is null or undefined';
			return result;
		}

		if (!doc.id) {
			result.isValid = false;
			result.reason = 'Document missing required ID field';
			return result;
		}

		if (!doc.created_at) {
			result.warnings.push('Document missing created_at timestamp');
		} else {
			// Validate date format
			const createdDate = new Date(doc.created_at);
			if (isNaN(createdDate.getTime())) {
				result.warnings.push(`Invalid created_at date format: ${doc.created_at}`);
			}
		}

		// Check available content sources
		if (doc.last_viewed_panel?.content) {
			const content = doc.last_viewed_panel.content;
			if (typeof content === 'string') {
				result.availableContentSources.push('last_viewed_panel_html');
				if (content.trim().length > 0) {
					result.isEmpty = false;
				}
			} else if (this.isValidProseMirrorDoc(content as ProseMirrorDoc)) {
				result.availableContentSources.push('last_viewed_panel_prosemirror');
				// Check if ProseMirror has extractable content
				const proseMirrorContent = content as ProseMirrorDoc;
				const extractedText = this.extractTextFromNodes(proseMirrorContent.content || []);
				if (extractedText.trim().length > 0) {
					result.isEmpty = false;
				}
			}
		}

		if (doc.notes && this.isValidProseMirrorDoc(doc.notes)) {
			result.availableContentSources.push('notes_prosemirror');
			const extractedText = this.extractTextFromNodes(doc.notes.content || []);
			if (extractedText.trim().length > 0) {
				result.isEmpty = false;
			}
		}

		if (doc.notes_markdown && doc.notes_markdown.trim().length > 0) {
			result.availableContentSources.push('notes_markdown');
			result.isEmpty = false;
		}

		if (doc.notes_plain && doc.notes_plain.trim().length > 0) {
			result.availableContentSources.push('notes_plain');
			result.isEmpty = false;
		}

		// Warn if no content sources are available
		if (result.availableContentSources.length === 0) {
			result.warnings.push('No valid content sources detected in document');
		}

		// Log validation results
		this.logger.debug(`Document validation for ${doc.id}:`);
		this.logger.debug(`- Valid: ${result.isValid}`);
		this.logger.debug(`- Empty: ${result.isEmpty}`);
		this.logger.debug(`- Content sources: ${result.availableContentSources.join(', ')}`);
		this.logger.debug(`- Warnings: ${result.warnings.join('; ')}`);

		return result;
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
		this.logger.debug(`Original title: "${decodeHtmlEntities(doc.title)}"`);
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

		// Get sanitized title and decode HTML entities
		const title = decodeHtmlEntities(doc.title || `Untitled-${doc.id}`);
		const sanitizedTitle = this.sanitizeFilename(title);

		// Combine date prefix with title
		const filename = `${datePrefix} - ${sanitizedTitle}`;

		this.logger.debug(`Generated filename: "${filename}"`);

		return filename;
	}

	/**
	 * Converts HTML content to Markdown format using Obsidian's API.
	 *
	 * @private
	 * @param {string} html - HTML content to convert
	 * @returns {string} Converted Markdown content
	 */
	private convertHtmlToMarkdown(html: string): string {
		if (!html || typeof html !== 'string') {
			return '';
		}

		// Use Obsidian's built-in HTML to Markdown converter
		const markdown = htmlToMarkdown(html);

		// Decode HTML entities in the converted markdown
		return decodeHtmlEntities(markdown);
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

				// Method 4: Some Granola documents may have text content in unexpected places
				// Check for text content in various properties that might contain actual content
				if (!node.text && (!node.content || node.content.length === 0)) {
					// Check for alternative text fields that might exist in Granola's format
					const altTextFields = [
						'textContent',
						'innerHTML',
						'innerText',
						'value',
						'data',
					];
					const nodeAsRecord = node as unknown as Record<string, unknown>;
					for (const field of altTextFields) {
						const altText = nodeAsRecord[field];
						if (typeof altText === 'string' && altText.trim().length > 0) {
							this.logger.debug(`Found alternative text in ${field}: "${altText}"`);
							text += altText;
							break;
						}
					}

					// Check attrs for text content
					if (node.attrs && typeof node.attrs === 'object') {
						for (const [key, value] of Object.entries(node.attrs)) {
							if (
								typeof value === 'string' &&
								value.trim().length > 0 &&
								(key.toLowerCase().includes('text') ||
									key.toLowerCase().includes('content'))
							) {
								this.logger.debug(`Found text in attrs.${key}: "${value}"`);
								text += value;
							}
						}
					}
				}
			} catch (error) {
				this.logger.warn(`Error extracting text from node:`, error, node);
				// Continue with other nodes even if one fails
			}
		}

		this.logger.debug(`extractTextFromNodes returning: "${text}"`);
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

		// Decode HTML entities
		text = decodeHtmlEntities(text);

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
			// Decode HTML entities in title
			frontmatter.title = decodeHtmlEntities(doc.title || 'Untitled');
			frontmatter.updated = doc.updated_at;
		}

		// Add Granola URL if setting is enabled
		if (this.settings.content.includeGranolaUrl) {
			frontmatter.granola_url = `https://notes.granola.ai/d/${doc.id}`;
		}

		// Extract and process attendee tags if enabled
		interface AttendeeData {
			name: string;
			email: string | null;
			company: string | null;
			isHost?: boolean;
		}

		let attendeeData: AttendeeData[] = [];

		// Handle different people field formats
		if (doc.people) {
			if (Array.isArray(doc.people)) {
				// Original format: array of strings - convert to object format
				attendeeData = doc.people.map(name => ({
					name: name,
					email: null,
					company: null,
				}));
			} else if (
				typeof doc.people === 'object' &&
				doc.people.attendees &&
				Array.isArray(doc.people.attendees)
			) {
				// New format: object with attendees array
				// First, let's log the full structure to see all available properties
				if (doc.people.attendees.length > 0) {
					this.logger.debug(
						'Full attendee structure:',
						JSON.stringify(doc.people.attendees[0], null, 2)
					);
				}

				// Extract attendee data
				attendeeData = doc.people.attendees
					.filter(
						(attendee: {
							email?: string;
							details?: {
								person?: {
									name?: {
										fullName?: string;
									};
								};
								company?: {
									name?: string;
								};
							};
						}) => attendee?.details?.person?.name?.fullName
					)
					.map(
						(attendee: {
							email?: string;
							details?: {
								person?: {
									name?: {
										fullName?: string;
									};
								};
								company?: {
									name?: string;
								};
							};
						}) => ({
							name: attendee.details?.person?.name?.fullName || 'Unknown',
							email: attendee.email || null,
							company: attendee.details?.company?.name || null,
						})
					);

				// Optionally include the host/creator
				if (this.settings.attendeeTags.includeHost && doc.people.creator) {
					const creator = doc.people.creator;
					attendeeData.push({
						name: creator.name || 'Unknown Host',
						email: creator.email || null,
						company: null, // Creator doesn't have company details in the current API
						isHost: true,
					});
				}
			}
		}

		const hasPeopleData = attendeeData.length > 0;

		this.logger.debug('Attendee tags settings:', {
			enabled: this.settings.attendeeTags.enabled,
			hasPeople: !!doc.people,
			peopleStructure: doc.people ? (Array.isArray(doc.people) ? 'array' : 'object') : 'none',
			peopleCount: attendeeData.length,
			extractedAttendees: attendeeData,
		});

		if (this.settings.attendeeTags.enabled && hasPeopleData) {
			const tags = this.extractAttendeeTags(attendeeData);
			this.logger.debug('Extracted attendee tags:', tags);
			if (tags.length > 0) {
				frontmatter.tags = tags;
			}
		}

		return frontmatter;
	}

	/**
	 * Extracts and processes attendee data into tags.
	 *
	 * Converts attendee information into tags using the configured template.
	 * Supports multiple template variables: {name}, {email}, {domain}, {company}
	 * Optionally excludes the user's own name based on settings.
	 *
	 * @private
	 * @param {AttendeeData[]} attendees - Array of attendee objects with name, email, company
	 * @returns {string[]} Array of formatted tags
	 */
	private extractAttendeeTags(
		attendees: Array<{
			name: string;
			email: string | null;
			company: string | null;
			isHost?: boolean;
		}>
	): string[] {
		const tags: string[] = [];
		const template = this.settings.attendeeTags.tagTemplate || 'person/{name}';
		const myName = this.settings.attendeeTags.myName?.trim().toLowerCase();
		const excludeMyName = this.settings.attendeeTags.excludeMyName;

		this.logger.debug('Extracting attendee tags:', {
			template,
			myName,
			excludeMyName,
			peopleCount: attendees.length,
		});

		for (const attendee of attendees) {
			const name = attendee.name?.trim() || '';

			// Skip if excluding own name and this matches
			if (excludeMyName && myName && name.toLowerCase() === myName) {
				this.logger.debug(`Skipping own name: ${name}`);
				continue;
			}

			// Skip if host is excluded (only applies if attendee is marked as host)
			if (attendee.isHost && !this.settings.attendeeTags.includeHost) {
				continue;
			}

			// Process template variables
			let tag = template;
			let hasRequiredVariables = true;

			// Helper function to normalize strings for tag format
			const normalizeForTag = (str: string) => {
				return str
					.normalize('NFD') // Decompose accented characters
					.replace(/[\u0300-\u036f]/g, '') // Remove diacritic marks (accents)
					.toLowerCase()
					.replace(/\s+/g, '-') // Replace spaces with hyphens
					.replace(/[^a-z0-9-]/g, '') // Remove remaining special characters
					.replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
					.replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
			};

			// Replace {name} variable
			if (tag.includes('{name}')) {
				if (name) {
					const normalizedName = normalizeForTag(name);
					tag = tag.replace(/{name}/g, normalizedName);
					this.logger.debug(`Replaced {name} with: ${normalizedName}`);
				} else {
					// Skip this attendee if name is required but not available
					hasRequiredVariables = false;
				}
			}

			// Replace {email} variable
			if (tag.includes('{email}')) {
				this.logger.debug(`Processing {email} variable. Attendee email: ${attendee.email}`);
				if (attendee.email) {
					const normalizedEmail = attendee.email.toLowerCase().replace(/[@.]/g, '-');
					tag = tag.replace(/{email}/g, normalizedEmail);
					this.logger.debug(`Replaced {email} with: ${normalizedEmail}`);
				} else {
					// Skip this attendee if email is required but not available
					hasRequiredVariables = false;
					this.logger.debug(`No email found for attendee, skipping`);
				}
			}

			// Replace {domain} variable (extract from email)
			if (tag.includes('{domain}')) {
				if (attendee.email && attendee.email.includes('@')) {
					const domain = attendee.email.split('@')[1];
					const normalizedDomain = domain.toLowerCase().replace(/\./g, '-');
					tag = tag.replace(/{domain}/g, normalizedDomain);
					this.logger.debug(`Replaced {domain} with: ${normalizedDomain}`);
				} else {
					// Skip this attendee if domain is required but not available
					hasRequiredVariables = false;
				}
			}

			// Replace {company} variable
			if (tag.includes('{company}')) {
				if (attendee.company) {
					const normalizedCompany = normalizeForTag(attendee.company);
					tag = tag.replace(/{company}/g, normalizedCompany);
					this.logger.debug(`Replaced {company} with: ${normalizedCompany}`);
				} else {
					// Skip this attendee if company is required but not available
					hasRequiredVariables = false;
				}
			}

			// Only add the tag if all required variables were available
			if (!hasRequiredVariables) {
				this.logger.debug(
					`Skipping attendee due to missing required variables: ${JSON.stringify(attendee)}`
				);
				continue;
			}

			// Clean up the tag (remove empty path segments)
			tag = tag
				.replace(/\/+/g, '/') // Replace multiple slashes with single
				.replace(/\/$/, '') // Remove trailing slash
				.trim();

			// Only add valid tags
			if (tag) {
				tags.push(tag);
				this.logger.debug(`Added tag: ${tag}`);
			}
		}

		// Remove duplicates
		const uniqueTags = [...new Set(tags)];
		this.logger.debug(`Final unique tags: ${uniqueTags.join(', ')}`);

		return uniqueTags;
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
		// Prepare frontmatter object for stringifyYaml
		const frontmatterObj: Record<string, unknown> = {};

		// Add fields in desired order
		if (frontmatter.id) {
			frontmatterObj.id = frontmatter.id;
		}
		if (frontmatter.title) {
			frontmatterObj.title = frontmatter.title;
		}

		frontmatterObj.created = frontmatter.created;

		if (frontmatter.updated) {
			frontmatterObj.updated = frontmatter.updated;
		}

		frontmatterObj.source = frontmatter.source;

		if (frontmatter.granola_url) {
			frontmatterObj.granola_url = frontmatter.granola_url;
		}

		// Add tags if present, removing # prefix for YAML
		if (frontmatter.tags && frontmatter.tags.length > 0) {
			frontmatterObj.tags = frontmatter.tags.map(tag =>
				tag.startsWith('#') ? tag.substring(1) : tag
			);
		}

		// Use Obsidian's built-in YAML stringifier
		const yamlContent = stringifyYaml(frontmatterObj);

		return `---\n${yamlContent}---\n\n${markdown}`;
	}

	/**
	 * Processes action items in markdown content by converting bullet points to tasks.
	 *
	 * Detects headers that indicate action items sections using flexible pattern matching.
	 * Supports both markdown headers (with # prefix) and plain-text headers, including
	 * headers with colons like "Action Items:" or "Follow-ups:". Converts bullet points
	 * under those headers to markdown task format (- [ ]). Optionally adds tags after
	 * converted tasks if the setting is enabled.
	 *
	 * Supported header patterns:
	 * - Markdown headers: "### Action Items", "## Tasks", etc.
	 * - Plain-text headers: "Action Items", "Next Steps", etc.
	 * - Colon headers: "Action Items:", "Follow-ups:", etc.
	 *
	 * @private
	 * @param {string} markdown - The markdown content to process
	 * @returns {string} Processed markdown with converted tasks
	 */
	/** Regex patterns for detecting action items headers */
	private static readonly ACTION_ITEMS_HEADER_PATTERNS = [
		// Markdown headers with flexible matching
		/^#{1,6}\s+.*\b(action\s*items?|actions?|tasks?|to-?dos?|to\s+dos?|follow-?\s*ups?|next\s+steps?)\b.*$/i,
		// Plain text headers with flexible matching - must be at start of line or after colon
		/^(action\s*items?|actions?|tasks?|to-?dos?|to\s+dos?|follow-?\s*ups?|next\s+steps?)\b.*$/i,
		// Headers with colons like "Action Items:" or "Follow-ups:"
		/^.*:\s*(action\s*items?|actions?|tasks?|to-?dos?|to\s+dos?|follow-?\s*ups?|next\s+steps?)\b.*$/i,
	];

	protected processActionItems(markdown: string): string {
		if (!markdown.trim()) {
			return markdown;
		}

		const lines = markdown.split('\n');
		const processedLines: string[] = [];
		let inActionItemsSection = false;
		let anyTasksConverted = false; // Track if ANY tasks were converted in the document

		this.logger.debug('Processing action items in markdown content');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmedLine = line.trim();

			// Check if this line is an action items header
			const isActionItemsHeader = ProseMirrorConverter.ACTION_ITEMS_HEADER_PATTERNS.some(
				pattern => pattern.test(trimmedLine)
			);

			if (isActionItemsHeader) {
				this.logger.debug(`Found action items header at line ${i + 1}: "${trimmedLine}"`);
				inActionItemsSection = true;
				processedLines.push(line);
				continue;
			}

			// Check if we're leaving the action items section
			if (inActionItemsSection) {
				// We only leave the section if we hit another header (not just any non-bullet content)
				const isAnyHeader = /^#{1,6}\s/.test(trimmedLine);

				// Exit section only on new headers
				if (isAnyHeader) {
					inActionItemsSection = false;
				}
			}

			// Process bullet points in action items sections
			if (
				inActionItemsSection &&
				(trimmedLine.startsWith('- ') || trimmedLine.startsWith('* '))
			) {
				// Convert bullet point to task
				const indent = line.match(/^(\s*)/)?.[1] || '';
				const bulletContent = trimmedLine.substring(2); // Remove '- ' or '* '
				const taskLine = `${indent}- [ ] ${bulletContent}`;

				processedLines.push(taskLine);
				anyTasksConverted = true; // Mark that we converted at least one task

				this.logger.debug(`Converted bullet to task: "${trimmedLine}" → "${taskLine}"`);
				continue;
			}

			// Add the line as-is
			processedLines.push(line);
		}

		// Add tag once at the end if we converted any tasks
		if (anyTasksConverted && this.settings.actionItems.addTaskTag) {
			const tagLine = this.settings.actionItems.taskTagName;
			processedLines.push(''); // Add blank line before tag
			processedLines.push(tagLine);
			this.logger.debug(`Added task tag at end of document: ${tagLine}`);
		}

		const result = processedLines.join('\n');

		if (anyTasksConverted) {
			this.logger.info(
				'Action items processing completed - converted bullet points to tasks'
			);
		} else {
			this.logger.debug('No action items found to convert');
		}

		return result;
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
		// Include more characters that can cause issues: & , ;
		return filename
			.replace(/[<>:"/\\|?*&,;]/g, '-')
			.replace(/\s+/g, ' ')
			.replace(/-+/g, '-') // Collapse multiple dashes
			.replace(/\s-\s/g, ' - ') // Ensure spaces around dashes
			.trim()
			.substring(0, 100); // Limit length to prevent filesystem issues
	}
}
