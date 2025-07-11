import { TFile, Vault, App } from 'obsidian';
import type { GranolaDocument } from '../api';
import type { ProseMirrorConverter } from '../converter';
import type { DocumentDisplayMetadata } from './document-metadata';
import type { ConflictResolution } from '../ui/conflict-resolution-modal';
import type { Logger, GranolaSettings } from '../types';
import { isEmptyDocument } from '../utils/prosemirror';

/**
 * Status of an individual document import.
 */
export type DocumentImportStatus = 'pending' | 'importing' | 'completed' | 'failed' | 'skipped' | 'empty';

/**
 * Import strategy for handling existing documents.
 */
export type ImportStrategy = 'skip' | 'update' | 'create_new';

/**
 * Categories of import errors for better user feedback.
 */
export type ImportErrorCategory = 
	| 'validation'    // Document structure validation failed
	| 'conversion'    // Content conversion failed
	| 'filesystem'    // File creation/writing failed
	| 'network'       // Network/API related error
	| 'permission'    // Permission denied error
	| 'unknown';      // Uncategorized error

/**
 * Progress information for a single document.
 */
export interface DocumentProgress {
	/** Document ID */
	id: string;

	/** Current import status */
	status: DocumentImportStatus;

	/** Progress percentage (0-100) */
	progress: number;

	/** Status message */
	message: string;

	/** Error information if failed */
	error?: string;

	/** Error category for better user feedback */
	errorCategory?: ImportErrorCategory;

	/** Created file reference if successful */
	file?: TFile;

	/** Start time of import */
	startTime?: number;

	/** Completion time of import */
	endTime?: number;
}

/**
 * Overall import progress information.
 */
export interface ImportProgress {
	/** Total number of documents to import */
	total: number;

	/** Number of completed documents */
	completed: number;

	/** Number of failed documents */
	failed: number;

	/** Number of skipped documents */
	skipped: number;

	/** Number of empty documents */
	empty: number;

	/** Overall progress percentage (0-100) */
	percentage: number;

	/** Current operation message */
	message: string;

	/** Whether import is running */
	isRunning: boolean;

	/** Whether import was cancelled */
	isCancelled: boolean;

	/** Start time of import batch */
	startTime: number;
}

/**
 * Import configuration options.
 */
export interface ImportOptions {
	/** Strategy for handling existing documents */
	strategy: ImportStrategy;

	/** Whether to stop on first error */
	stopOnError: boolean;

	/** Custom progress callback */
	onProgress?: (progress: ImportProgress) => void;

	/** Custom document progress callback */
	onDocumentProgress?: (docProgress: DocumentProgress) => void;
}

/**
 * Default import options.
 */
const DEFAULT_OPTIONS: ImportOptions = {
	strategy: 'skip',
	stopOnError: false,
};

/**
 * Service for managing selective document imports with progress tracking.
 *
 * This class coordinates the batch import process for selected Granola documents,
 * providing real-time progress updates, error handling, and cancellation support.
 * It manages concurrent processing while respecting rate limits and providing
 * detailed feedback about each document's import status.
 *
 * @class SelectiveImportManager
 * @since 1.1.0
 */
export class SelectiveImportManager {
	private app: App;
	private vault: Vault;
	private converter: ProseMirrorConverter;
	private logger: Logger;
	private settings: GranolaSettings;
	private isRunning: boolean = false;
	private isCancelled: boolean = false;
	private documentProgress: Map<string, DocumentProgress> = new Map();
	private overallProgress: ImportProgress;
	private progressCallback?: (progress: ImportProgress) => void;
	private documentProgressCallback?: (docProgress: DocumentProgress) => void;

	/**
	 * Creates a new selective import manager.
	 *
	 * @param {App} app - The Obsidian app instance
	 * @param {Vault} vault - The Obsidian vault to import into
	 * @param {ProseMirrorConverter} converter - Document converter instance
	 * @param {Logger} logger - Logger instance for debug output
	 * @param {GranolaSettings} settings - Plugin settings including import preferences
	 */
	constructor(app: App, vault: Vault, converter: ProseMirrorConverter, logger: Logger, settings: GranolaSettings) {
		this.app = app;
		this.vault = vault;
		this.converter = converter;
		this.logger = logger;
		this.settings = settings;
		this.overallProgress = this.createInitialProgress();
	}

	/**
	 * Imports selected documents with progress tracking.
	 *
	 * @async
	 * @param {DocumentDisplayMetadata[]} selectedDocuments - Documents selected for import
	 * @param {GranolaDocument[]} granolaDocuments - Full document data from API
	 * @param {ImportOptions} options - Import configuration options
	 * @returns {Promise<ImportProgress>} Final import results
	 * @throws {Error} If import is already running or other critical error
	 */
	async importDocuments(
		selectedDocuments: DocumentDisplayMetadata[],
		granolaDocuments: GranolaDocument[],
		options: ImportOptions = DEFAULT_OPTIONS
	): Promise<ImportProgress> {
		if (this.isRunning) {
			throw new Error('Import already in progress');
		}

		try {
			this.startImport(selectedDocuments, options);

			// Data preparation
			const documentMap = new Map(granolaDocuments.map(doc => [doc.id, doc]));
			const importQueue = selectedDocuments
				.filter(meta => meta.selected && documentMap.has(meta.id))
				.map(meta => ({ meta, doc: documentMap.get(meta.id)! }));

			// Update total count based on actual documents to be processed
			this.overallProgress.total = importQueue.length;

			// Document processing
			await this.processDocumentQueue(importQueue, options);

			this.completeImport();

			return this.overallProgress;
		} catch (error) {
			this.handleImportError(error);
			throw error;
		} finally {
			this.isRunning = false;
		}
	}

	/**
	 * Cancels the currently running import.
	 * Documents that are already being processed will complete.
	 */
	cancel(): void {
		if (!this.isRunning) {
			return;
		}

		this.isCancelled = true;
		this.overallProgress.isCancelled = true;
		this.overallProgress.message = 'Cancelling import...';
		this.emitProgress();
	}

	/**
	 * Gets the current import progress.
	 *
	 * @returns {ImportProgress} Current progress information
	 */
	getProgress(): ImportProgress {
		return { ...this.overallProgress };
	}

	/**
	 * Gets progress for a specific document.
	 *
	 * @param {string} documentId - Document ID to get progress for
	 * @returns {DocumentProgress | null} Document progress or null if not found
	 */
	getDocumentProgress(documentId: string): DocumentProgress | null {
		const progress = this.documentProgress.get(documentId);
		return progress ? { ...progress } : null;
	}

	/**
	 * Gets progress for all documents.
	 *
	 * @returns {DocumentProgress[]} Array of all document progress
	 */
	getAllDocumentProgress(): DocumentProgress[] {
		return Array.from(this.documentProgress.values()).map(p => ({ ...p }));
	}

	/**
	 * Resets the import manager state.
	 * Should be called before starting a new import.
	 */
	reset(): void {
		this.isRunning = false;
		this.isCancelled = false;
		this.documentProgress.clear();
		this.overallProgress = this.createInitialProgress();
	}

	/**
	 * Initializes the import process.
	 *
	 * @private
	 * @param {DocumentDisplayMetadata[]} documents - Documents to import
	 * @param {ImportOptions} options - Import options
	 */
	private startImport(documents: DocumentDisplayMetadata[], options: ImportOptions): void {
		this.reset();
		this.isRunning = true;
		this.progressCallback = options.onProgress;
		this.documentProgressCallback = options.onDocumentProgress;

		// Initialize overall progress
		this.overallProgress = {
			total: documents.filter(d => d.selected).length,
			completed: 0,
			failed: 0,
			skipped: 0,
			empty: 0,
			percentage: 0,
			message: 'Starting import...',
			isRunning: true,
			isCancelled: false,
			startTime: Date.now(),
		};

		// Initialize document progress
		documents
			.filter(d => d.selected)
			.forEach(doc => {
				this.documentProgress.set(doc.id, {
					id: doc.id,
					status: 'pending',
					progress: 0,
					message: 'Waiting to start...',
				});
			});

		this.emitProgress();
	}

	/**
	 * Processes the queue of documents to import.
	 *
	 * @private
	 * @async
	 * @param {Array} importQueue - Queue of documents to process
	 * @param {ImportOptions} options - Import options
	 */
	private async processDocumentQueue(
		importQueue: Array<{ meta: DocumentDisplayMetadata; doc: GranolaDocument }>,
		options: ImportOptions
	): Promise<void> {
		for (const item of importQueue) {
			if (this.isCancelled) {
				break;
			}

			await this.importSingleDocument(item.meta, item.doc, options);
		}
	}

	/**
	 * Imports a single document.
	 *
	 * @private
	 * @async
	 * @param {DocumentDisplayMetadata} meta - Document metadata
	 * @param {GranolaDocument} doc - Full document data
	 * @param {ImportOptions} options - Import options
	 */
	private async importSingleDocument(
		meta: DocumentDisplayMetadata,
		doc: GranolaDocument,
		options: ImportOptions
	): Promise<void> {
		if (this.isCancelled) {
			this.updateDocumentProgress(doc.id, {
				status: 'skipped',
				progress: 100,
				message: 'Import cancelled',
			});
			return;
		}

		const startTime = Date.now();

		// First emit pending status
		this.updateDocumentProgress(doc.id, {
			status: 'pending',
			progress: 0,
			message: 'Starting import...',
			startTime,
		});

		this.updateDocumentProgress(doc.id, {
			status: 'importing',
			progress: 10,
			message: 'Converting document...',
			startTime,
		});

		try {
			// Check if empty document filtering is enabled and document is empty
			if (this.settings.import.skipEmptyDocuments && isEmptyDocument(doc)) {
				this.logger.info(`Skipping empty document: ${doc.id} - "${doc.title}"`);
				this.updateDocumentProgress(doc.id, {
					status: 'skipped',
					progress: 100,
					message: 'Skipped empty document',
					endTime: Date.now(),
				});
				this.overallProgress.skipped++;
				this.updateOverallProgress();
				return;
			}
			// Check standard import strategy for non-conflicted documents first
			if (meta.importStatus.status === 'EXISTS' && options.strategy === 'skip') {
				this.updateDocumentProgress(doc.id, {
					status: 'skipped',
					progress: 100,
					message: 'Document already exists',
					endTime: Date.now(),
				});
				this.overallProgress.skipped++;
				this.updateOverallProgress();
				return;
			}

			// Convert document once - reuse for both normal flow and conflict resolution
			this.updateDocumentProgress(doc.id, {
				status: 'importing',
				progress: 30,
				message: 'Converting to Markdown...',
			});

			const convertedNote = this.converter.convertDocument(doc);

			// Check if document is truly empty and should be marked as such
			if (convertedNote.isTrulyEmpty && this.settings.import.skipEmptyDocuments) {
				this.updateDocumentProgress(doc.id, {
					status: 'empty',
					progress: 100,
					message: 'Document is empty (never modified)',
					endTime: Date.now(),
				});
				this.overallProgress.empty++;
				this.updateOverallProgress();
				return;
			}

			// Check if document needs conflict resolution
			if (meta.importStatus.requiresUserChoice || meta.importStatus.status === 'CONFLICT') {
				this.updateDocumentProgress(doc.id, {
					status: 'importing',
					progress: 40,
					message: 'Resolving conflict...',
				});

				const resolution = await this.resolveConflict(meta, doc);

				if (resolution.action === 'skip') {
					this.updateDocumentProgress(doc.id, {
						status: 'skipped',
						progress: 100,
						message: resolution.reason,
						endTime: Date.now(),
					});
					this.overallProgress.skipped++;
					this.updateOverallProgress();
					return;
				}

				// Apply the resolution using the already converted note
				await this.applyConflictResolution(doc, resolution, convertedNote, options);
				return;
			}

			// Handle normal processing (non-conflict documents)
			this.updateDocumentProgress(doc.id, {
				status: 'importing',
				progress: 60,
				message: 'Writing to vault...',
			});

			let file: TFile;
			const existingFile = this.vault.getAbstractFileByPath(convertedNote.filename);

			if (existingFile && existingFile instanceof TFile) {
				if (options.strategy === 'skip') {
					// Skip if file already exists and strategy is skip
					this.updateDocumentProgress(doc.id, {
						status: 'skipped',
						progress: 100,
						message: 'File already exists (filename collision)',
						endTime: Date.now(),
					});
					this.overallProgress.skipped++;
					this.updateOverallProgress();
					return;
				} else if (options.strategy === 'update') {
					await this.vault.modify(existingFile, convertedNote.content);
					file = existingFile;
				} else if (options.strategy === 'create_new') {
					const newFilename = this.generateUniqueFilename(convertedNote.filename);
					file = await this.vault.create(newFilename, convertedNote.content);
				} else {
					throw new Error(`Unhandled strategy for existing file: ${options.strategy}`);
				}
			} else {
				file = await this.vault.create(convertedNote.filename, convertedNote.content);
			}

			// Success
			this.updateDocumentProgress(doc.id, {
				status: 'completed',
				progress: 100,
				message: 'Import completed successfully',
				file,
				endTime: Date.now(),
			});

			this.overallProgress.completed++;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			const errorCategory = this.categorizeError(error);

			this.updateDocumentProgress(doc.id, {
				status: 'failed',
				progress: 100,
				message: this.getErrorMessage(errorCategory, errorMessage),
				error: errorMessage,
				errorCategory,
				endTime: Date.now(),
			});

			this.overallProgress.failed++;

			if (options.stopOnError) {
				this.cancel();
			}
		}

		this.updateOverallProgress();
	}

	/**
	 * Updates progress for a specific document.
	 *
	 * @private
	 * @param {string} documentId - Document ID
	 * @param {Partial<DocumentProgress>} updates - Progress updates
	 */
	private updateDocumentProgress(documentId: string, updates: Partial<DocumentProgress>): void {
		const current = this.documentProgress.get(documentId) || {
			id: documentId,
			status: 'pending' as const,
			progress: 0,
			message: '',
		};

		const updated = { ...current, ...updates };
		this.documentProgress.set(documentId, updated);

		if (this.documentProgressCallback) {
			this.documentProgressCallback({ ...updated });
		}
	}

	/**
	 * Updates overall progress and emits progress event.
	 *
	 * @private
	 */
	private updateOverallProgress(): void {
		const processed =
			this.overallProgress.completed +
			this.overallProgress.failed +
			this.overallProgress.skipped +
			this.overallProgress.empty;
		this.overallProgress.percentage =
			this.overallProgress.total > 0
				? Math.round((processed / this.overallProgress.total) * 100)
				: 100;

		// Update message
		this.overallProgress.message = `Importing ${processed}/${this.overallProgress.total} documents...`;

		this.emitProgress();
	}

	/**
	 * Completes the import process.
	 *
	 * @private
	 */
	private completeImport(): void {
		this.overallProgress.isRunning = false;
		this.overallProgress.percentage = 100;
		this.overallProgress.isCancelled = this.isCancelled; // Preserve cancellation state
		this.overallProgress.message = this.isCancelled
			? 'Import cancelled'
			: `Import completed: ${this.overallProgress.completed} successful, ${this.overallProgress.failed} failed, ${this.overallProgress.skipped} skipped${this.overallProgress.empty > 0 ? `, ${this.overallProgress.empty} empty` : ''}`;

		this.emitProgress();
	}

	/**
	 * Handles import errors.
	 *
	 * @private
	 * @param {unknown} error - Error that occurred
	 */
	private handleImportError(error: unknown): void {
		const message = error instanceof Error ? error.message : 'Unknown error';
		this.overallProgress.isRunning = false;
		this.overallProgress.message = `Import failed: ${message}`;
		this.emitProgress();
	}

	/**
	 * Emits progress event to callback.
	 *
	 * @private
	 */
	private emitProgress(): void {
		if (this.progressCallback) {
			this.progressCallback({ ...this.overallProgress });
		}
	}

	/**
	 * Creates initial progress state.
	 *
	 * @private
	 * @returns {ImportProgress} Initial progress state
	 */
	private createInitialProgress(): ImportProgress {
		return {
			total: 0,
			completed: 0,
			failed: 0,
			skipped: 0,
			empty: 0,
			percentage: 0,
			message: 'Ready to import',
			isRunning: false,
			isCancelled: false,
			startTime: 0,
		};
	}


	/**
	 * Generates a unique filename by adding a suffix.
	 *
	 * @private
	 * @param {string} filename - Original filename
	 * @returns {string} Unique filename
	 */
	private generateUniqueFilename(filename: string): string {
		const baseName = filename.replace(/\.md$/, '');
		let counter = 1;
		let uniqueName = `${baseName}-${counter}.md`;

		while (this.vault.getAbstractFileByPath(uniqueName)) {
			counter++;
			uniqueName = `${baseName}-${counter}.md`;
		}

		return uniqueName;
	}

	/**
	 * Resolves conflicts by showing the user resolution options.
	 * Uses dynamic imports for optimal bundle size - modal is only loaded when needed.
	 *
	 * @private
	 * @async
	 * @param {DocumentDisplayMetadata} meta - Document metadata
	 * @param {GranolaDocument} doc - Full document data
	 * @returns {Promise<ConflictResolution>} User's resolution choice
	 */
	private async resolveConflict(
		meta: DocumentDisplayMetadata,
		doc: GranolaDocument
	): Promise<ConflictResolution> {
		const existingFile = meta.importStatus.existingFile;

		// Dynamic import for code splitting - reduces main bundle size
		const { ConflictResolutionModal } = await import('../ui/conflict-resolution-modal');
		const modal = new ConflictResolutionModal(this.app, doc, meta, existingFile, this.logger);

		return await modal.showConflictResolution();
	}

	/**
	 * Applies the user's conflict resolution choice.
	 *
	 * @private
	 * @async
	 * @param {GranolaDocument} doc - Document to import
	 * @param {ConflictResolution} resolution - User's choice
	 * @param {ImportOptions} options - Import options
	 */
	private async applyConflictResolution(
		doc: GranolaDocument,
		resolution: ConflictResolution,
		convertedNote: { filename: string; content: string },
		options: ImportOptions
	): Promise<void> {
		this.updateDocumentProgress(doc.id, {
			status: 'importing',
			progress: 50,
			message: `Applying resolution: ${resolution.action}...`,
		});

		switch (resolution.action) {
			case 'overwrite':
				await this.handleOverwrite(convertedNote, resolution.createBackup);
				break;

			case 'merge':
				await this.handleMerge(convertedNote, resolution.strategy);
				break;

			case 'rename':
				await this.handleRename(convertedNote, resolution.newFilename);
				break;

			default:
				throw new Error(
					`Unknown resolution action: ${(resolution as { action: string }).action}`
				);
		}

		this.updateDocumentProgress(doc.id, {
			status: 'completed',
			progress: 100,
			message: 'Conflict resolved and imported successfully',
			endTime: Date.now(),
		});

		this.overallProgress.completed++;
	}

	/**
	 * Handles overwrite resolution.
	 *
	 * @private
	 * @async
	 * @param {any} convertedNote - Converted document
	 * @param {boolean} createBackup - Whether to create backup
	 */
	private async handleOverwrite(
		convertedNote: { filename: string; content: string },
		createBackup: boolean
	): Promise<void> {
		const existingFile = this.vault.getAbstractFileByPath(convertedNote.filename);

		if (existingFile && existingFile instanceof TFile) {
			if (createBackup) {
				// Create backup
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
				const backupName = `${existingFile.basename}.backup-${timestamp}.md`;
				const content = await this.vault.read(existingFile);
				await this.vault.create(backupName, content);
			}
			await this.vault.modify(existingFile, convertedNote.content);
		} else {
			// File doesn't exist anymore, just create it
			await this.vault.create(convertedNote.filename, convertedNote.content);
		}
	}

	/**
	 * Handles merge resolution.
	 *
	 * @private
	 * @async
	 * @param {any} convertedNote - Converted document
	 * @param {'append' | 'prepend'} strategy - Merge strategy
	 */
	private async handleMerge(
		convertedNote: { filename: string; content: string },
		strategy: 'append' | 'prepend'
	): Promise<void> {
		const existingFile = this.vault.getAbstractFileByPath(convertedNote.filename);

		if (existingFile && existingFile instanceof TFile) {
			const existingContent = await this.vault.read(existingFile);

			// Extract content after frontmatter from both files
			const existingBody = this.extractContentAfterFrontmatter(existingContent);
			const newBody = this.extractContentAfterFrontmatter(convertedNote.content);

			// Merge according to strategy
			let mergedBody: string;
			if (strategy === 'append') {
				mergedBody = existingBody + '\n\n---\n\n' + newBody;
			} else {
				// prepend
				mergedBody = newBody + '\n\n---\n\n' + existingBody;
			}

			// Keep the existing frontmatter but update the content
			const frontmatterMatch = existingContent.match(/^(---\n[\s\S]*?\n---\n)/);
			const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';

			const mergedContent = frontmatter + mergedBody;
			await this.vault.modify(existingFile, mergedContent);
		} else {
			// File doesn't exist, just create it
			await this.vault.create(convertedNote.filename, convertedNote.content);
		}
	}

	/**
	 * Handles rename resolution.
	 *
	 * @private
	 * @async
	 * @param {any} convertedNote - Converted document
	 * @param {string} newFilename - New filename to use
	 */
	private async handleRename(
		convertedNote: { content: string },
		newFilename: string
	): Promise<void> {
		await this.vault.create(newFilename, convertedNote.content);
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
	 * Categorizes errors for better user feedback.
	 *
	 * @private
	 * @param {unknown} error - Error to categorize
	 * @returns {ImportErrorCategory} Error category
	 */
	private categorizeError(error: unknown): ImportErrorCategory {
		if (!(error instanceof Error)) {
			return 'unknown';
		}

		const message = error.message.toLowerCase();

		// Document validation errors
		if (message.includes('validation failed') || 
			message.includes('document is null') ||
			message.includes('missing required') ||
			message.includes('invalid document structure')) {
			return 'validation';
		}

		// Content conversion errors
		if (message.includes('conversion failed') ||
			message.includes('prosemirror') ||
			message.includes('markdown') ||
			message.includes('cannot convert')) {
			return 'conversion';
		}

		// File system errors
		if (message.includes('eacces') ||
			message.includes('permission denied') ||
			message.includes('access denied') ||
			message.includes('eperm')) {
			return 'permission';
		}

		if (message.includes('enoent') ||
			message.includes('file not found') ||
			message.includes('directory not found') ||
			message.includes('path') ||
			message.includes('vault error') ||
			message.includes('file system')) {
			return 'filesystem';
		}

		// Network errors
		if (message.includes('network') ||
			message.includes('fetch') ||
			message.includes('connection') ||
			message.includes('timeout') ||
			message.includes('api')) {
			return 'network';
		}

		return 'unknown';
	}

	/**
	 * Gets user-friendly error message based on error category.
	 *
	 * @private
	 * @param {ImportErrorCategory} category - Error category
	 * @param {string} originalMessage - Original error message
	 * @returns {string} User-friendly error message
	 */
	private getErrorMessage(category: ImportErrorCategory, originalMessage: string): string {
		switch (category) {
			case 'validation':
				return 'Document structure validation failed - document may be corrupted';

			case 'conversion':
				return 'Content conversion failed - document format may be unsupported';

			case 'filesystem':
				return 'File creation failed - check vault permissions and disk space';

			case 'permission':
				return 'Permission denied - check vault write permissions';

			case 'network':
				return 'Network error during import - check connection and try again';

			case 'unknown':
			default:
				return `Import failed: ${originalMessage}`;
		}
	}

}

