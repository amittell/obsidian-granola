import { GranolaDocument } from '../api';
import { DuplicateCheckResult } from './duplicate-detector';

/**
 * Display metadata extracted from a Granola document for UI presentation.
 */
export interface DocumentDisplayMetadata {
	/** Document ID */
	id: string;
	
	/** Document title (sanitized for display) */
	title: string;
	
	/** Formatted creation date */
	createdDate: string;
	
	/** Formatted last updated date */
	updatedDate: string;
	
	/** Time ago format for creation (e.g., "2 days ago") */
	createdAgo: string;
	
	/** Time ago format for update (e.g., "1 hour ago") */
	updatedAgo: string;
	
	/** Preview text (first few sentences) */
	preview: string;
	
	/** Estimated word count */
	wordCount: number;
	
	/** Estimated reading time in minutes */
	readingTime: number;
	
	/** Import status from duplicate detection */
	importStatus: DuplicateCheckResult;
	
	/** Whether document matches current search/filter criteria */
	visible: boolean;
	
	/** Whether document is selected for import */
	selected: boolean;
}

/**
 * Filter criteria for document selection.
 */
export interface DocumentFilter {
	/** Text search in title and content */
	searchText?: string;
	
	/** Filter by import status */
	statusFilter?: Array<'NEW' | 'EXISTS' | 'UPDATED' | 'CONFLICT'>;
	
	/** Date range filter */
	dateRange?: {
		start?: Date;
		end?: Date;
	};
	
	/** Minimum word count */
	minWordCount?: number;
	
	/** Maximum word count */
	maxWordCount?: number;
}

/**
 * Sorting options for document display.
 */
export interface DocumentSort {
	/** Field to sort by */
	field: 'title' | 'created' | 'updated' | 'wordCount' | 'status';
	
	/** Sort direction */
	direction: 'asc' | 'desc';
}

/**
 * Service for extracting and managing document metadata for UI display.
 * 
 * This class provides utilities for extracting display-friendly metadata
 * from Granola documents, including formatted dates, content previews,
 * and search/filter functionality. It maintains an internal cache for
 * performance when working with large document collections.
 * 
 * @class DocumentMetadataService
 * @since 1.1.0
 */
export class DocumentMetadataService {
	private metadataCache: Map<string, DocumentDisplayMetadata> = new Map();
	private readonly PREVIEW_LENGTH = 150;
	private readonly WORDS_PER_MINUTE = 200; // Average reading speed

	/**
	 * Extracts display metadata from a Granola document.
	 * 
	 * @param {GranolaDocument} document - The source document
	 * @param {DuplicateCheckResult} importStatus - Import status from duplicate detection
	 * @returns {DocumentDisplayMetadata} Formatted metadata for display
	 */
	extractMetadata(document: GranolaDocument, importStatus: DuplicateCheckResult): DocumentDisplayMetadata {
		// Check cache first
		const cacheKey = `${document.id}-${document.updated_at}`;
		if (this.metadataCache.has(cacheKey)) {
			const cached = this.metadataCache.get(cacheKey)!;
			// Update status and selection state (these can change)
			cached.importStatus = importStatus;
			return cached;
		}

		const metadata: DocumentDisplayMetadata = {
			id: document.id,
			title: this.sanitizeTitle(document.title),
			createdDate: this.formatDate(document.created_at),
			updatedDate: this.formatDate(document.updated_at),
			createdAgo: this.formatTimeAgo(document.created_at),
			updatedAgo: this.formatTimeAgo(document.updated_at),
			preview: this.generatePreview(document),
			wordCount: this.estimateWordCount(document),
			readingTime: 0, // Will be calculated after word count
			importStatus,
			visible: true,
			selected: importStatus.status === 'NEW' || importStatus.status === 'UPDATED'
		};

		// Calculate reading time
		metadata.readingTime = Math.max(1, Math.ceil(metadata.wordCount / this.WORDS_PER_MINUTE));

		// Cache the result
		this.metadataCache.set(cacheKey, metadata);

		return metadata;
	}

	/**
	 * Extracts metadata for multiple documents efficiently.
	 * 
	 * @param {GranolaDocument[]} documents - Array of documents to process
	 * @param {Map<string, DuplicateCheckResult>} statusMap - Map of document ID to import status
	 * @returns {DocumentDisplayMetadata[]} Array of display metadata
	 */
	extractBulkMetadata(
		documents: GranolaDocument[],
		statusMap: Map<string, DuplicateCheckResult>
	): DocumentDisplayMetadata[] {
		return documents.map(doc => {
			const status = statusMap.get(doc.id) || {
				status: 'NEW' as const,
				reason: 'Status not determined',
				requiresUserChoice: false
			};
			return this.extractMetadata(doc, status);
		});
	}

	/**
	 * Applies search and filter criteria to a list of document metadata.
	 * 
	 * @param {DocumentDisplayMetadata[]} documents - Documents to filter
	 * @param {DocumentFilter} filter - Filter criteria
	 * @returns {DocumentDisplayMetadata[]} Filtered documents with visibility updated
	 */
	applyFilter(documents: DocumentDisplayMetadata[], filter: DocumentFilter): DocumentDisplayMetadata[] {
		return documents.map(doc => {
			doc.visible = this.matchesFilter(doc, filter);
			return doc;
		});
	}

	/**
	 * Sorts document metadata by specified criteria.
	 * 
	 * @param {DocumentDisplayMetadata[]} documents - Documents to sort
	 * @param {DocumentSort} sort - Sort criteria
	 * @returns {DocumentDisplayMetadata[]} Sorted documents
	 */
	applySorting(documents: DocumentDisplayMetadata[], sort: DocumentSort): DocumentDisplayMetadata[] {
		return documents.sort((a, b) => {
			let comparison = 0;

			switch (sort.field) {
				case 'title':
					comparison = a.title.localeCompare(b.title);
					break;
				case 'created':
					comparison = new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
					break;
				case 'updated':
					comparison = new Date(a.updatedDate).getTime() - new Date(b.updatedDate).getTime();
					break;
				case 'wordCount':
					comparison = a.wordCount - b.wordCount;
					break;
				case 'status':
					comparison = this.compareStatus(a.importStatus.status, b.importStatus.status);
					break;
			}

			return sort.direction === 'desc' ? -comparison : comparison;
		});
	}

	/**
	 * Gets statistics about a collection of documents.
	 * 
	 * @param {DocumentDisplayMetadata[]} documents - Documents to analyze
	 * @returns {object} Statistics summary
	 */
	getCollectionStats(documents: DocumentDisplayMetadata[]): {
		total: number;
		visible: number;
		selected: number;
		byStatus: Record<string, number>;
		totalWordCount: number;
		averageWordCount: number;
		totalReadingTime: number;
	} {
		const visible = documents.filter(d => d.visible);
		const selected = documents.filter(d => d.selected && d.visible);
		
		const byStatus = documents.reduce((acc, doc) => {
			const status = doc.importStatus.status;
			acc[status] = (acc[status] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);

		const totalWordCount = documents.reduce((sum, doc) => sum + doc.wordCount, 0);
		const totalReadingTime = documents.reduce((sum, doc) => sum + doc.readingTime, 0);

		return {
			total: documents.length,
			visible: visible.length,
			selected: selected.length,
			byStatus,
			totalWordCount,
			averageWordCount: documents.length > 0 ? Math.round(totalWordCount / documents.length) : 0,
			totalReadingTime
		};
	}

	/**
	 * Updates selection state for multiple documents.
	 * 
	 * @param {DocumentDisplayMetadata[]} documents - Documents to update
	 * @param {string[]} selectedIds - IDs of documents to select
	 * @returns {DocumentDisplayMetadata[]} Updated documents
	 */
	updateSelection(documents: DocumentDisplayMetadata[], selectedIds: string[]): DocumentDisplayMetadata[] {
		const selectedSet = new Set(selectedIds);
		return documents.map(doc => {
			doc.selected = selectedSet.has(doc.id);
			return doc;
		});
	}

	/**
	 * Clears the metadata cache.
	 * Useful when documents have been modified externally.
	 */
	clearCache(): void {
		this.metadataCache.clear();
	}

	/**
	 * Sanitizes and formats a document title for display.
	 * 
	 * @private
	 * @param {string} title - Raw document title
	 * @returns {string} Formatted title
	 */
	private sanitizeTitle(title: string): string {
		if (!title || title.trim() === '') {
			return 'Untitled Document';
		}

		return title
			.trim()
			.replace(/\s+/g, ' ') // Normalize whitespace
			.substring(0, 100); // Limit length for display
	}

	/**
	 * Formats a date string for display.
	 * 
	 * @private
	 * @param {string} dateString - ISO date string
	 * @returns {string} Formatted date
	 */
	private formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return 'Invalid Date';
		}
	}

	/**
	 * Formats a date as "time ago" (e.g., "2 hours ago").
	 * 
	 * @private
	 * @param {string} dateString - ISO date string
	 * @returns {string} Time ago format
	 */
	private formatTimeAgo(dateString: string): string {
		try {
			const date = new Date(dateString);
			const now = new Date();
			const diffMs = now.getTime() - date.getTime();
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
			const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
			const diffMinutes = Math.floor(diffMs / (1000 * 60));

			if (diffDays > 0) {
				return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
			} else if (diffHours > 0) {
				return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
			} else if (diffMinutes > 0) {
				return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
			} else {
				return 'Just now';
			}
		} catch {
			return 'Unknown';
		}
	}

	/**
	 * Generates a preview text from document content.
	 * 
	 * @private
	 * @param {GranolaDocument} document - Document to generate preview for
	 * @returns {string} Preview text
	 */
	private generatePreview(document: GranolaDocument): string {
		// Try to get plain text preview first
		if (document.notes_plain && document.notes_plain.trim()) {
			const preview = document.notes_plain
				.trim()
				.replace(/\s+/g, ' ') // Normalize whitespace
				.substring(0, this.PREVIEW_LENGTH);
			
			return preview.length === this.PREVIEW_LENGTH ? preview + '...' : preview;
		}

		// Fallback to markdown if available
		if (document.notes_markdown && document.notes_markdown.trim()) {
			const preview = document.notes_markdown
				.replace(/[#*`]/g, '') // Remove basic markdown formatting
				.trim()
				.replace(/\s+/g, ' ')
				.substring(0, this.PREVIEW_LENGTH);
			
			return preview.length === this.PREVIEW_LENGTH ? preview + '...' : preview;
		}

		// Last resort: try to extract from ProseMirror structure
		return this.extractTextFromProseMirror(document.notes);
	}

	/**
	 * Extracts plain text from ProseMirror document structure.
	 * 
	 * @private
	 * @param {any} proseMirrorDoc - ProseMirror document
	 * @returns {string} Extracted text
	 */
	private extractTextFromProseMirror(proseMirrorDoc: any): string {
		if (!proseMirrorDoc || !proseMirrorDoc.content) {
			return 'No content available';
		}

		const extractText = (node: any): string => {
			if (node.text) {
				return node.text;
			}
			if (node.content && Array.isArray(node.content)) {
				return node.content.map(extractText).join(' ');
			}
			return '';
		};

		const text = proseMirrorDoc.content
			.map(extractText)
			.join(' ')
			.trim()
			.replace(/\s+/g, ' ')
			.substring(0, this.PREVIEW_LENGTH);

		return text.length === this.PREVIEW_LENGTH ? text + '...' : text || 'No content available';
	}

	/**
	 * Estimates word count from document content.
	 * 
	 * @private
	 * @param {GranolaDocument} document - Document to analyze
	 * @returns {number} Estimated word count
	 */
	private estimateWordCount(document: GranolaDocument): number {
		// Use plain text if available (most accurate)
		if (document.notes_plain && document.notes_plain.trim()) {
			return document.notes_plain
				.trim()
				.split(/\s+/)
				.filter(word => word.length > 0)
				.length;
		}

		// Fallback to markdown
		if (document.notes_markdown && document.notes_markdown.trim()) {
			return document.notes_markdown
				.replace(/[#*`\[\]()]/g, '') // Remove basic markdown
				.trim()
				.split(/\s+/)
				.filter(word => word.length > 0)
				.length;
		}

		// Last resort: estimate from ProseMirror
		const text = this.extractTextFromProseMirror(document.notes);
		return text
			.split(/\s+/)
			.filter(word => word.length > 0)
			.length;
	}

	/**
	 * Checks if a document matches the given filter criteria.
	 * 
	 * @private
	 * @param {DocumentDisplayMetadata} doc - Document to check
	 * @param {DocumentFilter} filter - Filter criteria
	 * @returns {boolean} True if document matches filter
	 */
	private matchesFilter(doc: DocumentDisplayMetadata, filter: DocumentFilter): boolean {
		// Text search
		if (filter.searchText && filter.searchText.trim()) {
			const searchText = filter.searchText.toLowerCase();
			const searchableText = `${doc.title} ${doc.preview}`.toLowerCase();
			if (!searchableText.includes(searchText)) {
				return false;
			}
		}

		// Status filter
		if (filter.statusFilter && filter.statusFilter.length > 0) {
			if (!filter.statusFilter.includes(doc.importStatus.status)) {
				return false;
			}
		}

		// Date range filter
		if (filter.dateRange) {
			const docDate = new Date(doc.updatedDate);
			if (filter.dateRange.start && docDate < filter.dateRange.start) {
				return false;
			}
			if (filter.dateRange.end && docDate > filter.dateRange.end) {
				return false;
			}
		}

		// Word count filter
		if (filter.minWordCount && doc.wordCount < filter.minWordCount) {
			return false;
		}
		if (filter.maxWordCount && doc.wordCount > filter.maxWordCount) {
			return false;
		}

		return true;
	}

	/**
	 * Compares import status for sorting.
	 * 
	 * @private
	 * @param {string} a - First status
	 * @param {string} b - Second status
	 * @returns {number} Comparison result
	 */
	private compareStatus(a: string, b: string): number {
		const statusOrder = { 'NEW': 0, 'UPDATED': 1, 'CONFLICT': 2, 'EXISTS': 3 };
		return (statusOrder[a as keyof typeof statusOrder] || 99) - 
		       (statusOrder[b as keyof typeof statusOrder] || 99);
	}
}