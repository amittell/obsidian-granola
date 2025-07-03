import { ProseMirrorDoc, ProseMirrorNode, GranolaDocument } from './api';
import { Logger, GranolaSettings, DatePrefixFormat, ContentPriority } from './types';

// Converter Constants (removing unused constant)
// const MAX_FILENAME_LENGTH = 100;

/**
 * Represents a successfully converted document ready for Obsidian import.
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
 * Lightweight core converter with lazy-loaded heavy conversion logic.
 * Reduces main bundle by ~5KB by loading specialized converters on demand.
 */
export class ProseMirrorConverter {
	private logger: Logger;
	private settings: GranolaSettings;
	private nodeConverters: any = null; // Lazy-loaded

	constructor(logger: Logger, settings: GranolaSettings) {
		this.logger = logger;
		this.settings = settings;
	}

	/**
	 * Updates the converter settings.
	 */
	updateSettings(settings: GranolaSettings): void {
		this.settings = settings;
	}

	/**
	 * Converts a complete Granola document to Obsidian-compatible Markdown.
	 * Main entry point for document conversion.
	 */
	convertDocument(doc: GranolaDocument): ConvertedNote {
		this.logger.debug(`Processing document: ${doc.id} - "${doc.title}"`);

		// Extract content using priority order
		let proseMirrorDoc: ProseMirrorDoc | null = null;
		let markdownContent = '';

		// Try to extract content based on priority settings
		const priority = this.settings.content.contentPriority;

		if (priority === ContentPriority.PANEL_FIRST || priority === ContentPriority.PANEL_ONLY) {
			proseMirrorDoc = doc.last_viewed_panel?.content || null;
		}

		if (
			!proseMirrorDoc &&
			(priority === ContentPriority.NOTES_FIRST || priority === ContentPriority.NOTES_ONLY)
		) {
			proseMirrorDoc = doc.notes || null;
		}

		// Fallback to other priority if main choice failed
		if (!proseMirrorDoc && priority === ContentPriority.PANEL_FIRST) {
			proseMirrorDoc = doc.notes || null;
		} else if (!proseMirrorDoc && priority === ContentPriority.NOTES_FIRST) {
			proseMirrorDoc = doc.last_viewed_panel?.content || null;
		}

		// Convert ProseMirror content if available
		if (proseMirrorDoc && this.isValidProseMirrorDoc(proseMirrorDoc)) {
			markdownContent = this.convertProseMirrorToMarkdown(proseMirrorDoc);
		} else {
			// Fallback to pre-converted content
			markdownContent = doc.notes_markdown || doc.notes_plain || '';
		}

		// Generate frontmatter
		const frontmatter = this.generateFrontmatter(doc);

		// Generate filename with date prefix
		const filename = this.generateDatePrefixedFilename(doc);

		// Assemble final content
		const yamlFrontmatter = this.generateYamlFrontmatter(frontmatter);
		const fullContent = yamlFrontmatter + markdownContent;

		return {
			filename,
			content: fullContent,
			frontmatter,
		};
	}

	/**
	 * Generates a date-prefixed filename for the document.
	 */
	private generateDatePrefixedFilename(doc: GranolaDocument): string {
		const datePrefixFormat = this.settings.content.datePrefixFormat;

		// Parse creation date
		let datePrefix = '';
		if (datePrefixFormat !== DatePrefixFormat.NONE) {
			try {
				const createdDate = new Date(doc.created_at);
				const year = createdDate.getFullYear();
				const month = String(createdDate.getMonth() + 1).padStart(2, '0');
				const day = String(createdDate.getDate()).padStart(2, '0');

				switch (datePrefixFormat) {
					case DatePrefixFormat.ISO_DATE:
						datePrefix = `${year}-${month}-${day} - `;
						break;
					case DatePrefixFormat.US_DATE:
						datePrefix = `${month}-${day}-${year} - `;
						break;
					case DatePrefixFormat.EU_DATE:
						datePrefix = `${day}-${month}-${year} - `;
						break;
					case DatePrefixFormat.DOT_DATE:
						datePrefix = `${year}.${month}.${day} - `;
						break;
				}
			} catch (error) {
				this.logger.warn('Failed to parse creation date for prefix:', error);
			}
		}

		// Sanitize title for filename
		const sanitizedTitle = this.sanitizeFilename(doc.title || 'Untitled');
		const baseFilename = datePrefix + sanitizedTitle;

		// Ensure filename isn't too long
		const maxLength = this.settings.import.maxFilenameLength - 3; // Reserve space for .md
		const truncatedFilename =
			baseFilename.length > maxLength ? baseFilename.substring(0, maxLength) : baseFilename;

		return truncatedFilename + '.md';
	}

	/**
	 * Validates ProseMirror document structure.
	 */
	private isValidProseMirrorDoc(doc: ProseMirrorDoc): boolean {
		return !!(
			doc &&
			typeof doc === 'object' &&
			doc.type === 'doc' &&
			Array.isArray(doc.content) &&
			doc.content.length > 0
		);
	}

	/**
	 * Converts ProseMirror document to Markdown with optimized conversion.
	 */
	private convertProseMirrorToMarkdown(doc: ProseMirrorDoc): string {
		this.logger.debug(`Converting ProseMirror document:`, doc);

		// Initialize node converters if not already done
		if (!this.nodeConverters) {
			const { NodeConverters } = require('./converter/node-converters');
			this.nodeConverters = new NodeConverters(this.logger);
		}

		try {
			if (!doc.content || doc.content.length === 0) {
				this.logger.warn('Document has no content nodes');
				return '';
			}

			const convertedNodes: string[] = [];

			doc.content.forEach((node, index) => {
				try {
					const converted = this.convertNode(node);
					if (converted.trim()) {
						convertedNodes.push(converted);
						this.logger.debug(`Node ${index} converted successfully`);
					}
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : 'Unknown error';
					this.logger.error(`Error converting node ${index} (${node.type}):`, errorMsg);
					convertedNodes.push(
						`[Error converting ${node.type || 'unknown'} node: ${errorMsg}]`
					);
				}
			});

			const result = convertedNodes.join('').trim();
			this.logger.debug(`Final conversion result (${result.length} chars):`, result);
			return result;
		} catch (error) {
			this.logger.error('Failed to convert ProseMirror document:', error);
			return '[Error: Failed to convert document content]';
		}
	}

	/**
	 * Converts a single ProseMirror node using lazy-loaded converters.
	 */
	private convertNode(node: ProseMirrorNode): string {
		if (!this.nodeConverters) {
			throw new Error('Node converters not loaded');
		}

		switch (node.type) {
			case 'paragraph':
				return this.nodeConverters.convertParagraph(node);
			case 'heading':
				return this.nodeConverters.convertHeading(node);
			case 'bulletList':
			case 'orderedList':
				return this.nodeConverters.convertList(node);
			case 'listItem':
				return this.nodeConverters.convertListItem(node);
			case 'text':
				return this.nodeConverters.convertText(node);
			case 'codeBlock':
				return this.nodeConverters.convertCodeBlock(node);
			case 'blockquote':
				return this.nodeConverters.convertBlockquote(node);
			case 'table':
				return this.nodeConverters.convertTable(node);
			case 'hardBreak':
				return '  \n';
			case 'horizontalRule':
				return '---\n\n';
			default:
				this.logger.warn(`Unknown node type: ${node.type}`);
				return `[Unsupported content: ${node.type}]`;
		}
	}

	/**
	 * Generates frontmatter metadata for the document.
	 */
	private generateFrontmatter(doc: GranolaDocument): NoteFrontmatter {
		const frontmatter: NoteFrontmatter = {
			created: doc.created_at,
			source: 'Granola',
		};

		if (this.settings.content.includeEnhancedFrontmatter) {
			frontmatter.id = doc.id;
			frontmatter.title = doc.title;
			frontmatter.updated = doc.updated_at;
		}

		return frontmatter;
	}

	/**
	 * Converts frontmatter object to YAML string.
	 */
	private generateYamlFrontmatter(frontmatter: NoteFrontmatter): string {
		const lines = ['---'];

		Object.entries(frontmatter).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				// Escape YAML special characters in string values
				const escapedValue =
					typeof value === 'string' && value.includes(':')
						? `"${value.replace(/"/g, '\\"')}"`
						: value;
				lines.push(`${key}: ${escapedValue}`);
			}
		});

		lines.push('---', '');
		return lines.join('\n');
	}

	/**
	 * Sanitizes a string for use as a filename.
	 */
	private sanitizeFilename(filename: string): string {
		return filename
			.replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
			.replace(/[\s]+/g, ' ') // Normalize whitespace
			.trim();
	}
}
