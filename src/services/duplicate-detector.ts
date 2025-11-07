import { TFile, Vault } from 'obsidian';
import { GranolaDocument } from '../api';
import { decodeHtmlEntities } from '../utils/html';

/**
 * Import status classification for documents.
 *
 * - NEW: Document doesn't exist in vault
 * - EXISTS: Exact match found (same content)
 * - UPDATED: Document exists but Granola version is newer
 * - CONFLICT: Local modifications detected
 */
export type ImportStatus = 'NEW' | 'EXISTS' | 'UPDATED' | 'CONFLICT';

/**
 * Information about an existing document in the vault.
 */
export interface ExistingDocument {
	/** File reference in the vault */
	file: TFile;

	/** Granola document ID from frontmatter */
	granolaId: string;

	/** Last updated timestamp from frontmatter */
	lastUpdated: string;

	/** Whether the file appears to have local modifications */
	hasLocalModifications: boolean;
}

/**
 * Result of duplicate detection analysis.
 */
export interface DuplicateCheckResult {
	/** Import status classification */
	status: ImportStatus;

	/** Existing file reference if found */
	existingFile?: TFile;

	/** Reason for the status classification */
	reason: string;

	/** Whether user action is recommended */
	requiresUserChoice: boolean;
}

/**
 * Service for detecting duplicate documents and determining import status.
 *
 * This class scans the Obsidian vault to identify existing Granola imports
 * and provides intelligent status classification for new documents. It uses
 * multiple detection strategies including Granola ID matching and filename
 * comparison to prevent duplicates and conflicts.
 *
 * @class DuplicateDetector
 * @since 1.1.0
 */
export class DuplicateDetector {
	private vault: Vault;
	private existingDocuments: Map<string, ExistingDocument> = new Map();
	private filenameToGranolaId: Map<string, string> = new Map();
	private isInitialized: boolean = false;

	/**
	 * Creates a new duplicate detector instance.
	 *
	 * @param {Vault} vault - The Obsidian vault to scan
	 */
	constructor(vault: Vault) {
		this.vault = vault;
	}

	/**
	 * Initializes the detector by scanning the vault for existing Granola imports.
	 * This method should be called before using other detection methods.
	 *
	 * @async
	 * @returns {Promise<void>}
	 * @throws {Error} If vault scanning fails
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			await this.scanVaultForGranolaDocuments();
			this.isInitialized = true;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to initialize duplicate detector: ${message}`);
		}
	}

	/**
	 * Refreshes the detector's cache by re-scanning the vault.
	 * Useful when documents may have been added or modified externally.
	 *
	 * @async
	 * @returns {Promise<void>}
	 */
	async refresh(): Promise<void> {
		this.existingDocuments.clear();
		this.filenameToGranolaId.clear();
		this.isInitialized = false;
		await this.initialize();
	}

	/**
	 * Checks the import status for a single Granola document.
	 *
	 * @async
	 * @param {GranolaDocument} document - The document to check
	 * @returns {Promise<DuplicateCheckResult>} Analysis result with import status
	 */
	async checkDocument(document: GranolaDocument): Promise<DuplicateCheckResult> {
		if (!this.isInitialized) {
			await this.initialize();
		}

		// Primary check: Look for existing document by Granola ID
		const existingDoc = this.existingDocuments.get(document.id);
		if (existingDoc) {
			return this.analyzeExistingDocument(document, existingDoc);
		}

		// Secondary check: Look for potential filename conflicts
		// Check both old format (title only) and new format (date-prefixed)
		const potentialFilenames = this.generatePossibleFilenames(document);

		for (const filename of potentialFilenames) {
			// Check for conflicts with existing Granola documents
			if (this.filenameToGranolaId.has(filename)) {
				const conflictingId = this.filenameToGranolaId.get(filename)!;
				const conflictingDoc = this.existingDocuments.get(conflictingId)!;

				return {
					status: 'CONFLICT',
					existingFile: conflictingDoc.file,
					reason: `Filename conflict: Another Granola document uses this filename`,
					requiresUserChoice: true,
				};
			}

			// Check if a file with this exact filename exists (non-Granola) in any folder
			const existingFile = this.findFileByBasename(filename);
			if (existingFile) {
				return {
					status: 'CONFLICT',
					existingFile,
					reason: `File already exists: ${existingFile.path}`,
					requiresUserChoice: true,
				};
			}
		}

		// No conflicts found - safe to import
		return {
			status: 'NEW',
			reason: 'Document not found in vault',
			requiresUserChoice: false,
		};
	}

	/**
	 * Checks import status for multiple documents efficiently.
	 *
	 * @async
	 * @param {GranolaDocument[]} documents - Array of documents to check
	 * @returns {Promise<Map<string, DuplicateCheckResult>>} Map of document ID to check result
	 */
	async checkDocuments(documents: GranolaDocument[]): Promise<Map<string, DuplicateCheckResult>> {
		if (!this.isInitialized) {
			await this.initialize();
		}

		const results = new Map<string, DuplicateCheckResult>();

		for (const document of documents) {
			const result = await this.checkDocument(document);
			results.set(document.id, result);
		}

		return results;
	}

	/**
	 * Gets statistics about existing Granola documents in the vault.
	 *
	 * @returns {object} Statistics object with counts and metadata
	 */
	getStatistics(): {
		totalGranolaDocuments: number;
		oldestDocument: string | null;
		newestDocument: string | null;
		documentsWithConflicts: number;
	} {
		const documents = Array.from(this.existingDocuments.values());

		if (documents.length === 0) {
			return {
				totalGranolaDocuments: 0,
				oldestDocument: null,
				newestDocument: null,
				documentsWithConflicts: 0,
			};
		}

		const sorted = documents.sort(
			(a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
		);

		return {
			totalGranolaDocuments: documents.length,
			oldestDocument: sorted[0]?.lastUpdated || null,
			newestDocument: sorted[sorted.length - 1]?.lastUpdated || null,
			documentsWithConflicts: documents.filter(d => d.hasLocalModifications).length,
		};
	}

	/**
	 * Scans the vault for existing Granola documents and builds internal cache.
	 *
	 * @private
	 * @async
	 * @returns {Promise<void>}
	 */
	private async scanVaultForGranolaDocuments(): Promise<void> {
		const markdownFiles = this.vault.getMarkdownFiles();

		for (const file of markdownFiles) {
			try {
				const content = await this.vault.read(file);
				const granolaInfo = this.extractGranolaMetadata(content);

				if (granolaInfo) {
					const existingDoc: ExistingDocument = {
						file,
						granolaId: granolaInfo.id,
						lastUpdated: granolaInfo.updated,
						hasLocalModifications: this.detectLocalModifications(content, granolaInfo),
					};

					this.existingDocuments.set(granolaInfo.id, existingDoc);
					this.filenameToGranolaId.set(file.name, granolaInfo.id);
				}
			} catch (error) {
				// Skip files that can't be read or parsed
				console.warn(`Failed to scan file ${file.path}:`, error);
				continue;
			}
		}
	}

	/**
	 * Extracts Granola metadata from file content frontmatter.
	 *
	 * @private
	 * @param {string} content - File content to analyze
	 * @returns {object | null} Granola metadata or null if not a Granola document
	 */
	private extractGranolaMetadata(
		content: string
	): { id: string; updated: string; title: string } | null {
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!frontmatterMatch) {
			return null;
		}

		const frontmatter = frontmatterMatch[1];

		// Check if this is a Granola document
		if (!frontmatter.includes('source: Granola')) {
			return null;
		}

		// Extract required fields
		const idMatch = frontmatter.match(/^id:\s*(.+)$/m);
		const updatedMatch = frontmatter.match(/^updated:\s*(.+)$/m);
		const titleMatch = frontmatter.match(/^title:\s*"?([^"]+)"?$/m);

		if (!idMatch || !updatedMatch || !titleMatch) {
			return null;
		}

		return {
			id: idMatch[1].trim(),
			updated: updatedMatch[1].trim(),
			title: titleMatch[1].trim(),
		};
	}

	/**
	 * Analyzes an existing document to determine import status.
	 *
	 * @private
	 * @param {GranolaDocument} newDocument - The incoming document
	 * @param {ExistingDocument} existingDoc - The existing document in vault
	 * @returns {DuplicateCheckResult} Analysis result
	 */
	private analyzeExistingDocument(
		newDocument: GranolaDocument,
		existingDoc: ExistingDocument
	): DuplicateCheckResult {
		const existingDate = new Date(existingDoc.lastUpdated);
		const newDate = new Date(newDocument.updated_at);

		// Check if local modifications exist
		if (existingDoc.hasLocalModifications) {
			return {
				status: 'CONFLICT',
				existingFile: existingDoc.file,
				reason: 'Local modifications detected - requires user choice',
				requiresUserChoice: true,
			};
		}

		// Check if new version is available
		if (newDate > existingDate) {
			return {
				status: 'UPDATED',
				existingFile: existingDoc.file,
				reason: `Granola version is newer (${newDocument.updated_at} vs ${existingDoc.lastUpdated})`,
				requiresUserChoice: false,
			};
		}

		// Same or older version
		return {
			status: 'EXISTS',
			existingFile: existingDoc.file,
			reason: `Document already exists with same or newer content`,
			requiresUserChoice: false,
		};
	}

	/**
	 * Detects if a document has local modifications beyond the original import.
	 *
	 * @private
	 * @param {string} content - Current file content
	 * @param {object} metadata - Original Granola metadata
	 * @returns {boolean} True if local modifications detected
	 */
	private detectLocalModifications(
		content: string,
		metadata: { id: string; updated: string }
	): boolean {
		// Extract the content after frontmatter
		const contentAfterFrontmatter = this.extractContentAfterFrontmatter(content);

		// Check if file has been modified in ways that suggest user edits:

		// 1. Check for content that doesn't look like typical Granola imports
		const hasNonGranolaPatterns = this.hasNonGranolaPatterns(contentAfterFrontmatter);

		// 2. Check for significant content additions (more than 20% increase)
		const hasSignificantAdditions =
			this.hasSignificantContentAdditions(contentAfterFrontmatter);

		// 3. Check for manual structure changes (custom headers, links, etc.)
		const hasStructuralChanges = this.hasStructuralChanges(contentAfterFrontmatter);

		return hasNonGranolaPatterns || hasSignificantAdditions || hasStructuralChanges;
	}

	/**
	 * Extracts content after frontmatter delimiter.
	 *
	 * @private
	 * @param {string} content - Full file content
	 * @returns {string} Content without frontmatter
	 */
	private extractContentAfterFrontmatter(content: string): string {
		const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n(.*)$/s);
		return frontmatterMatch ? frontmatterMatch[1] : content;
	}

	/**
	 * Checks for patterns that don't typically appear in Granola imports.
	 *
	 * @private
	 * @param {string} content - Content to analyze
	 * @returns {boolean} True if non-Granola patterns found
	 */
	private hasNonGranolaPatterns(content: string): boolean {
		const patterns = [
			/\[\[.*?\]\]/, // Obsidian links
			/!\[\[.*?\]\]/, // Obsidian embeds
			/#[a-zA-Z]\w*/, // Hashtags
			/%%.*?%%/, // Obsidian comments
			/```dataview/, // Dataview queries
			/\^[a-zA-Z0-9]+/, // Block references
		];

		return patterns.some(pattern => pattern.test(content));
	}

	/**
	 * Checks if content has grown significantly beyond typical import size.
	 *
	 * @private
	 * @param {string} content - Content to analyze
	 * @returns {boolean} True if significant additions detected
	 */
	private hasSignificantContentAdditions(content: string): boolean {
		// If content is very long, it might have user additions
		// This is a heuristic - typical Granola notes are shorter
		const wordCount = content.trim().split(/\s+/).length;
		return wordCount > 2000; // Threshold for "unusually long" content
	}

	/**
	 * Checks for structural changes that suggest manual editing.
	 *
	 * @private
	 * @param {string} content - Content to analyze
	 * @returns {boolean} True if structural changes detected
	 */
	private hasStructuralChanges(content: string): boolean {
		const structuralPatterns = [
			/#{2,}\s+Notes?$/m, // Custom "Notes" sections
			/#{2,}\s+TODO/i, // TODO sections
			/#{2,}\s+Summary$/m, // Summary sections
			/---\s*$/, // Horizontal rules (often added manually)
			/>\s*\[!.*?\]/, // Obsidian callouts
		];

		return structuralPatterns.some(pattern => pattern.test(content));
	}

	/**
	 * Generates all possible filenames for a document (old and new formats).
	 *
	 * This supports backward compatibility by checking both:
	 * - Old format: "Title.md"
	 * - New format: "YYYY-MM-DD - Title.md"
	 *
	 * @private
	 * @param {GranolaDocument} document - The document to generate filenames for
	 * @returns {string[]} Array of possible filenames to check for conflicts
	 */
	private generatePossibleFilenames(document: GranolaDocument): string[] {
		const filenames: string[] = [];

		// Old format: just sanitized title (with HTML entities decoded)
		const decodedTitle = decodeHtmlEntities(document.title || `Untitled-${document.id}`);
		const sanitizedTitle = this.sanitizeFilename(decodedTitle);
		const oldFormatFilename = `${sanitizedTitle}.md`;
		filenames.push(oldFormatFilename);

		// New format: date-prefixed
		const newFormatFilename = this.generateDatePrefixedFilename(document);
		filenames.push(newFormatFilename);

		console.debug(`[Duplicate Detector] Checking filenames for ${document.id}:`, filenames);

		return filenames;
	}

	/**
	 * Generates a date-prefixed filename matching the converter's logic.
	 *
	 * @private
	 * @param {GranolaDocument} document - The document to generate filename for
	 * @returns {string} Date-prefixed filename with .md extension
	 */
	private generateDatePrefixedFilename(document: GranolaDocument): string {
		// Extract date from created_at timestamp
		let datePrefix = '';
		try {
			const createdDate = new Date(document.created_at);
			if (isNaN(createdDate.getTime())) {
				console.warn(
					`[Duplicate Detector] Invalid created_at date: ${document.created_at}`
				);
				datePrefix = 'INVALID-DATE';
			} else {
				// Format as YYYY-MM-DD
				const year = createdDate.getFullYear();
				const month = (createdDate.getMonth() + 1).toString().padStart(2, '0');
				const day = createdDate.getDate().toString().padStart(2, '0');
				datePrefix = `${year}-${month}-${day}`;
			}
		} catch (error) {
			console.error(`[Duplicate Detector] Error parsing date: ${error}`);
			datePrefix = 'INVALID-DATE';
		}

		// Get sanitized title (with HTML entities decoded)
		const title = decodeHtmlEntities(document.title || `Untitled-${document.id}`);
		const sanitizedTitle = this.sanitizeFilename(title);

		// Combine date prefix with title and add extension
		return `${datePrefix} - ${sanitizedTitle}.md`;
	}

	/**
	 * Finds a file by its basename anywhere in the vault.
	 *
	 * @private
	 * @param {string} filename - The filename to search for (with extension)
	 * @returns {TFile | null} The file if found, null otherwise
	 */
	private findFileByBasename(filename: string): TFile | null {
		const allFiles = this.vault.getMarkdownFiles();
		return allFiles.find(file => file.name === filename) || null;
	}

	/**
	 * Sanitizes a filename to match the converter's sanitization logic.
	 *
	 * @private
	 * @param {string} filename - Raw filename to sanitize
	 * @returns {string} Sanitized filename
	 */
	private sanitizeFilename(filename: string): string {
		return filename
			.replace(/[<>:"/\\|?*]/g, '-')
			.replace(/\s+/g, ' ')
			.trim()
			.substring(0, 100); // Match MAX_FILENAME_LENGTH from converter
	}
}
