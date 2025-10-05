import {
	Modal,
	App,
	ButtonComponent,
	TextComponent,
	Notice,
	TFile,
	WorkspaceLeaf,
	MarkdownView,
} from 'obsidian';
import { GranolaDocument, GranolaAPI } from '../api';
import { DuplicateDetector } from '../services/duplicate-detector';
import {
	DocumentMetadataService,
	DocumentDisplayMetadata,
	DocumentFilter,
	DocumentSort,
} from '../services/document-metadata';
import {
	SelectiveImportManager,
	ImportProgress,
	DocumentProgress,
	DocumentImportStatus,
	ImportOptions,
} from '../services/import-manager';
import { ProseMirrorConverter } from '../converter';

/**
 * Modal for selecting and importing Granola documents.
 *
 * This modal provides a comprehensive interface for users to preview,
 * select, and import Granola documents into their Obsidian vault.
 * It integrates all the selective import services to provide real-time
 * status updates, progress tracking, and user control over the import process.
 *
 * @class DocumentSelectionModal
 * @extends Modal
 * @since 1.1.0
 */
export class DocumentSelectionModal extends Modal {
	private api: GranolaAPI;
	private duplicateDetector: DuplicateDetector;
	private metadataService: DocumentMetadataService;
	private importManager: SelectiveImportManager;
	private converter: ProseMirrorConverter;

	// Data state
	private granolaDocuments: GranolaDocument[] = [];
	private documentMetadata: DocumentDisplayMetadata[] = [];
	private isLoading: boolean = false;
	private isImporting: boolean = false;

	// Filter and sort state
	private currentFilter: DocumentFilter = {};
	private currentSort: DocumentSort = { field: 'updated', direction: 'desc' };

	// UI elements
	private modalContentEl!: HTMLElement;
	private headerEl!: HTMLElement;
	private controlsEl!: HTMLElement;
	private searchEl!: HTMLElement;
	private documentListEl!: HTMLElement;
	private footerEl!: HTMLElement;
	private progressEl!: HTMLElement;

	// Interactive elements
	private searchInput!: TextComponent;
	private selectAllButton!: ButtonComponent;
	private selectNoneButton!: ButtonComponent;
	private refreshButton!: ButtonComponent;
	private importButton!: ButtonComponent;
	private cancelButton!: ButtonComponent;

	private eventListenersToCleanup: Array<{
		element: HTMLElement;
		type: string;
		handler: EventListener;
	}> = [];
	private timersToCleanup: Set<ReturnType<typeof setTimeout>> = new Set();

	/**
	 * Creates a new document selection modal.
	 *
	 * @param {App} app - The Obsidian app instance
	 * @param {GranolaAPI} api - API client for fetching documents
	 * @param {DuplicateDetector} duplicateDetector - Service for detecting duplicates
	 * @param {DocumentMetadataService} metadataService - Service for document metadata
	 * @param {SelectiveImportManager} importManager - Service for managing imports
	 * @param {ProseMirrorConverter} converter - Document converter
	 */
	constructor(
		app: App,
		api: GranolaAPI,
		duplicateDetector: DuplicateDetector,
		metadataService: DocumentMetadataService,
		importManager: SelectiveImportManager,
		converter: ProseMirrorConverter
	) {
		super(app);
		this.api = api;
		this.duplicateDetector = duplicateDetector;
		this.metadataService = metadataService;
		this.importManager = importManager;
		this.converter = converter;
	}

	/**
	 * Called when the modal is opened.
	 * Initializes the UI and loads documents.
	 *
	 * @returns {Promise<void>} Resolves when modal initialization is complete
	 */
	async onOpen(): Promise<void> {
		this.modalContentEl = this.contentEl;
		this.setupUI();
		await this.loadDocuments();
	}

	/**
	 * Called when the modal is closed.
	 * Cleans up resources and cancels any running imports.
	 */
	onClose(): void {
		if (this.isImporting) {
			this.importManager.cancel();
		}

		// Clean up all event listeners
		this.eventListenersToCleanup.forEach(({ element, type, handler }) => {
			element.removeEventListener(type, handler);
		});
		this.eventListenersToCleanup = [];

		// Clear all timers
		this.timersToCleanup.forEach(timerId => {
			clearTimeout(timerId);
			clearInterval(timerId);
		});
		this.timersToCleanup.clear();

		this.cleanup();
	}

	/**
	 * Sets up the modal UI structure.
	 *
	 * @private
	 */
	private setupUI(): void {
		this.modalContentEl.empty();
		this.modalContentEl.addClass('granola-import-modal');

		// Header
		this.headerEl = this.modalContentEl.createDiv('modal-header');
		this.headerEl.createEl('h2', { text: 'Import Granola notes' });

		// Controls section
		this.controlsEl = this.modalContentEl.createDiv('modal-controls');
		this.setupControls();

		// Search section
		this.searchEl = this.modalContentEl.createDiv('modal-search');
		this.setupSearch();

		// Document list
		this.documentListEl = this.modalContentEl.createDiv('modal-document-list');

		// Progress section (hidden initially)
		this.progressEl = this.modalContentEl.createDiv('modal-progress');
		this.progressEl.addClass('granola-progress-hidden');

		// Footer
		this.footerEl = this.modalContentEl.createDiv('modal-footer');
		this.setupFooter();

		// Apply CSS class
		this.applyStyles();
	}

	/**
	 * Sets up the control buttons section.
	 *
	 * @private
	 */
	private setupControls(): void {
		const buttonContainer = this.controlsEl.createDiv('button-group');

		// Select All button
		this.selectAllButton = new ButtonComponent(buttonContainer)
			.setButtonText('Select all')
			.onClick(() => this.selectAll());

		// Select None button
		this.selectNoneButton = new ButtonComponent(buttonContainer)
			.setButtonText('Select none')
			.onClick(() => this.selectNone());

		// Refresh button
		this.refreshButton = new ButtonComponent(buttonContainer)
			.setButtonText('Refresh')
			.onClick(() => this.refreshDocuments());

		// Status filter dropdown
		const filterContainer = this.controlsEl.createDiv('filter-group');
		filterContainer.createEl('label', { text: 'Filter by status:' });

		const statusSelect = filterContainer.createEl('select');
		statusSelect.createEl('option', { value: '', text: 'All status' });
		statusSelect.createEl('option', { value: 'NEW', text: 'New documents' });
		statusSelect.createEl('option', { value: 'UPDATED', text: 'Updated documents' });
		statusSelect.createEl('option', { value: 'CONFLICT', text: 'Conflicts' });
		statusSelect.createEl('option', { value: 'EXISTS', text: 'Already exists' });

		statusSelect.addEventListener('change', e => {
			const target = e.target as HTMLSelectElement;
			this.applyStatusFilter(target.value);
		});
	}

	/**
	 * Sets up the search input section.
	 *
	 * @private
	 */
	private setupSearch(): void {
		const searchContainer = this.searchEl.createDiv('search-container');
		searchContainer.createEl('label', { text: 'Search documents:' });

		this.searchInput = new TextComponent(searchContainer)
			.setPlaceholder('Search titles and content...')
			.onChange(value => {
				this.currentFilter.searchText = value;
				this.renderDocumentList();
			});
	}

	/**
	 * Sets up the footer buttons.
	 *
	 * @private
	 */
	private setupFooter(): void {
		const buttonContainer = this.footerEl.createDiv('footer-buttons');

		// Cancel button
		this.cancelButton = new ButtonComponent(buttonContainer)
			.setButtonText('Cancel')
			.onClick(() => this.close());

		// Import button
		this.importButton = new ButtonComponent(buttonContainer)
			.setButtonText('Import selected')
			.setCta()
			.onClick(() => this.startImport());

		// Update button states
		this.updateFooterButtons();
	}

	/**
	 * Loads documents from the API and processes them.
	 *
	 * @private
	 * @async
	 * @returns {Promise<void>} Resolves when document loading is complete
	 */
	private async loadDocuments(): Promise<void> {
		if (this.isLoading) return;

		try {
			this.setLoading(true);
			this.showMessage('Loading Granola credentials...');

			// Load credentials first (required for API access)
			await this.api.loadCredentials();

			this.showMessage('Scanning vault for existing imports...');
			// Initialize duplicate detector
			await this.duplicateDetector.initialize();

			this.showMessage('Fetching documents from Granola...');
			// Fetch documents from API
			this.granolaDocuments = await this.api.getAllDocuments();

			if (this.granolaDocuments.length === 0) {
				this.showMessage('No documents found in your Granola account.');
				return;
			}

			// Check for duplicates
			const statusMap = await this.duplicateDetector.checkDocuments(this.granolaDocuments);

			// Extract metadata for display
			this.documentMetadata = this.metadataService.extractBulkMetadata(
				this.granolaDocuments,
				statusMap
			);

			// Apply default sorting
			this.documentMetadata = this.metadataService.applySorting(
				this.documentMetadata,
				this.currentSort
			);

			this.renderDocumentList();
			this.updateFooterButtons();
		} catch (error) {
			console.error('[Granola Importer] Failed to load documents:', error);
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.showError(`Failed to load documents: ${message}`);
		} finally {
			this.setLoading(false);
		}
	}

	/**
	 * Refreshes the document list.
	 *
	 * @private
	 * @async
	 * @returns {Promise<void>} Resolves when document refresh is complete
	 */
	private async refreshDocuments(): Promise<void> {
		this.showMainView(); // Ensure main view is visible when refreshing
		await this.duplicateDetector.refresh();
		await this.loadDocuments();
	}

	/**
	 * Renders the document list with current filtering and sorting.
	 *
	 * @private
	 */
	private renderDocumentList(): void {
		this.documentListEl.empty();

		if (this.documentMetadata.length === 0) {
			this.showMessage('No documents to display.');
			return;
		}

		// Apply current filters
		const filteredMetadata = this.metadataService.applyFilter(
			this.documentMetadata,
			this.currentFilter
		);

		const visibleDocuments = filteredMetadata.filter(doc => doc.visible);

		if (visibleDocuments.length === 0) {
			this.showMessage('No documents match the current filter.');
			return;
		}

		// Create document list
		const listContainer = this.documentListEl.createDiv('document-list-container');

		// Stats header
		const stats = this.metadataService.getCollectionStats(filteredMetadata);
		const statsEl = listContainer.createDiv('document-stats');
		statsEl.textContent = `Showing ${visibleDocuments.length} of ${stats.total} documents (${stats.selected} selected)`;

		// Document items
		visibleDocuments.forEach(doc => {
			this.renderDocumentItem(listContainer, doc);
		});
	}

	/**
	 * Renders a single document item in the list.
	 *
	 * @private
	 * @param {HTMLElement} container - Container element
	 * @param {DocumentDisplayMetadata} doc - Document metadata
	 */
	private renderDocumentItem(container: HTMLElement, doc: DocumentDisplayMetadata): void {
		const item = container.createDiv('document-item');
		item.addClass(`status-${doc.importStatus.status.toLowerCase()}`);
		item.setAttribute('data-document-id', doc.id);

		// Checkbox
		const checkbox = item.createEl('input', {
			type: 'checkbox',
			cls: 'document-checkbox',
		}) as HTMLInputElement;
		checkbox.checked = doc.selected;
		checkbox.addEventListener('change', () => {
			doc.selected = checkbox.checked;
			this.updateFooterButtons();
		});

		// Content area
		const content = item.createDiv('document-content');

		// Title and status
		const titleRow = content.createDiv('document-title-row');
		const titleEl = titleRow.createEl('h3', {
			cls: 'document-title',
		});
		titleEl.textContent = doc.title;

		titleRow.createEl('span', {
			text: this.getStatusText(doc.importStatus.status),
			cls: `status-badge status-${doc.importStatus.status.toLowerCase()}`,
		});

		// Metadata row
		const metaRow = content.createDiv('document-meta');
		metaRow.createEl('span', {
			text: `Created: ${doc.createdAgo}`,
			cls: 'meta-item',
		});
		metaRow.createEl('span', {
			text: `Updated: ${doc.updatedAgo}`,
			cls: 'meta-item',
		});
		metaRow.createEl('span', {
			text: `${doc.wordCount} words`,
			cls: 'meta-item',
		});
		metaRow.createEl('span', {
			text: `${doc.readingTime} min read`,
			cls: 'meta-item',
		});

		// Preview
		if (doc.preview) {
			const preview = content.createDiv('document-preview');
			preview.textContent = doc.preview;
		}

		// Status explanation
		if (doc.importStatus.reason) {
			const reason = content.createDiv('document-reason');
			reason.textContent = doc.importStatus.reason;
		}

		// Import progress indicator (initially hidden)
		const progressIndicator = content.createDiv('document-progress-indicator');
		progressIndicator.addClass('granola-progress-hidden');

		const progressIcon = progressIndicator.createSpan('progress-icon');
		progressIcon.textContent = '⏳';

		const progressText = progressIndicator.createSpan('progress-text');
		progressText.textContent = 'Pending...';

		const progressBar = progressIndicator.createDiv('progress-bar');
		const progressFill = progressBar.createDiv('progress-fill');
		progressFill.addClass('progress-width-0');
	}

	/**
	 * Starts the import process for selected documents.
	 *
	 * @private
	 * @async
	 * @returns {Promise<void>} Resolves when import process is complete
	 */
	private async startImport(): Promise<void> {
		const selectedDocs = this.documentMetadata.filter(doc => doc.selected);

		if (selectedDocs.length === 0) {
			this.showError('No documents selected for import.');
			return;
		}

		try {
			this.setImporting(true);
			this.showProgressView();

			const importOptions: ImportOptions = {
				strategy: 'skip', // Default strategy: skip existing files to prevent accidental overwrites
				stopOnError: false,
				onProgress: progress => this.updateProgress(progress),
				onDocumentProgress: docProgress => this.updateDocumentProgress(docProgress),
			};

			const result = await this.importManager.importDocuments(
				selectedDocs,
				this.granolaDocuments,
				importOptions
			);

			this.showImportComplete(result);
		} catch (error) {
			console.error('[Granola Importer] Import failed:', error);
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.showMainView(); // Restore main view on error
			this.showError(`Import failed: ${message}`);
		} finally {
			this.setImporting(false);
		}
	}

	/**
	 * Restores the main document selection view.
	 *
	 * @private
	 */
	private showMainView(): void {
		this.controlsEl.removeClass('granola-controls-hidden');
		this.controlsEl.addClass('granola-controls-visible');
		this.searchEl.removeClass('granola-controls-hidden');
		this.searchEl.addClass('granola-controls-visible');
		this.documentListEl.removeClass('granola-controls-hidden');
		this.documentListEl.addClass('granola-controls-visible');
		this.footerEl.removeClass('granola-controls-hidden');
		this.footerEl.addClass('granola-controls-visible');
		this.progressEl.addClass('granola-progress-hidden');
	}

	/**
	 * Shows the progress view during import.
	 *
	 * @private
	 */
	private showProgressView(): void {
		this.controlsEl.removeClass('granola-controls-visible');
		this.controlsEl.addClass('granola-controls-hidden');
		this.searchEl.removeClass('granola-controls-visible');
		this.searchEl.addClass('granola-controls-hidden');
		this.documentListEl.removeClass('granola-controls-visible');
		this.documentListEl.addClass('granola-controls-hidden');
		this.footerEl.removeClass('granola-controls-visible');
		this.footerEl.addClass('granola-controls-hidden');
		this.progressEl.removeClass('granola-progress-hidden');
		this.progressEl.addClass('granola-progress-visible');

		this.progressEl.empty();
		this.progressEl.createEl('h3', { text: 'Importing documents...' });

		// Progress bar
		const progressContainer = this.progressEl.createDiv('progress-container');
		const progressBar = progressContainer.createDiv('progress-bar');
		progressBar.createDiv('progress-fill');
		progressContainer.createDiv('progress-text');

		// Document progress list
		this.progressEl.createDiv('document-progress-list');

		// Cancel button
		new ButtonComponent(this.progressEl).setButtonText('Cancel import').onClick(() => {
			this.importManager.cancel();
		});
	}

	/**
	 * Updates the overall progress display.
	 *
	 * @private
	 * @param {ImportProgress} progress - Progress information
	 */
	private updateProgress(progress: ImportProgress): void {
		const progressFill = this.progressEl.querySelector('.progress-fill') as HTMLElement;
		const progressText = this.progressEl.querySelector('.progress-text') as HTMLElement;

		if (progressFill) {
			// Remove all progress width classes individually
			progressFill.removeClass('progress-width-0');
			progressFill.removeClass('progress-width-25');
			progressFill.removeClass('progress-width-50');
			progressFill.removeClass('progress-width-75');
			progressFill.removeClass('progress-width-100');

			if (progress.percentage <= 0) {
				progressFill.addClass('progress-width-0');
			} else if (progress.percentage <= 25) {
				progressFill.addClass('progress-width-25');
			} else if (progress.percentage <= 50) {
				progressFill.addClass('progress-width-50');
			} else if (progress.percentage <= 75) {
				progressFill.addClass('progress-width-75');
			} else {
				progressFill.addClass('progress-width-100');
			}
		}

		if (progressText) {
			progressText.textContent = progress.message;
		}
	}

	/**
	 * Updates individual document progress.
	 *
	 * @private
	 * @param {DocumentProgress} docProgress - Document progress
	 */
	private updateDocumentProgress(docProgress: DocumentProgress): void {
		const documentItem = this.modalContentEl.querySelector(
			`[data-document-id="${docProgress.id}"]`
		) as HTMLElement;

		if (!documentItem) {
			return; // Document not visible or not found
		}

		const progressIndicator = documentItem.querySelector(
			'.document-progress-indicator'
		) as HTMLElement;
		const progressIcon = documentItem.querySelector('.progress-icon') as HTMLElement;
		const progressText = documentItem.querySelector('.progress-text') as HTMLElement;
		const progressFill = documentItem.querySelector('.progress-fill') as HTMLElement;

		if (!progressIndicator || !progressIcon || !progressText || !progressFill) {
			return; // Progress elements not found
		}

		// Show progress indicator during import
		if (
			docProgress.status === 'importing' ||
			docProgress.status === 'completed' ||
			docProgress.status === 'failed'
		) {
			progressIndicator.removeClass('granola-progress-hidden');
			progressIndicator.addClass('granola-progress-visible-flex');
		}

		// Update icon and text based on status
		const statusConfig = this.getProgressStatusConfig(docProgress.status);
		progressIcon.textContent = statusConfig.icon;
		progressText.textContent = docProgress.message || statusConfig.defaultMessage;

		// Update progress bar
		// Remove all progress width classes individually
		progressFill.removeClass('progress-width-0');
		progressFill.removeClass('progress-width-25');
		progressFill.removeClass('progress-width-50');
		progressFill.removeClass('progress-width-75');
		progressFill.removeClass('progress-width-100');

		if (docProgress.progress <= 0) {
			progressFill.addClass('progress-width-0');
		} else if (docProgress.progress <= 25) {
			progressFill.addClass('progress-width-25');
		} else if (docProgress.progress <= 50) {
			progressFill.addClass('progress-width-50');
		} else if (docProgress.progress <= 75) {
			progressFill.addClass('progress-width-75');
		} else {
			progressFill.addClass('progress-width-100');
		}

		// Update item styling
		documentItem.className = documentItem.className.replace(/\bimport-\w+\b/g, '');
		documentItem.addClass(`import-${docProgress.status}`);

		// Auto-scroll to currently importing document
		if (docProgress.status === 'importing') {
			this.scrollToDocument(docProgress.id);
		}

		// Show error details if failed
		if (docProgress.status === 'failed' && docProgress.error) {
			progressText.textContent = `❌ Failed: ${docProgress.error}`;
		}
	}

	/**
	 * Gets the configuration for progress status display.
	 *
	 * @private
	 * @param {DocumentImportStatus} status - Import status
	 * @returns {object} Status configuration with icon and default message
	 */
	private getProgressStatusConfig(status: DocumentImportStatus): {
		icon: string;
		defaultMessage: string;
	} {
		switch (status) {
			case 'pending':
				return { icon: '⏳', defaultMessage: 'Pending...' };
			case 'importing':
				return { icon: '📥', defaultMessage: 'Importing...' };
			case 'completed':
				return { icon: '✅', defaultMessage: 'Completed' };
			case 'failed':
				return { icon: '❌', defaultMessage: 'Failed' };
			case 'skipped':
				return { icon: '⏭️', defaultMessage: 'Skipped' };
			default:
				return { icon: '⏳', defaultMessage: 'Unknown status' };
		}
	}

	/**
	 * Scrolls to the document item currently being imported.
	 *
	 * @private
	 * @param {string} documentId - ID of the document to scroll to
	 */
	private scrollToDocument(documentId: string): void {
		const documentItem = this.modalContentEl.querySelector(
			`[data-document-id="${documentId}"]`
		) as HTMLElement;

		if (!documentItem) {
			return; // Document not found
		}

		// Smooth scroll to the document item
		documentItem.scrollIntoView({
			behavior: 'smooth',
			block: 'center',
			inline: 'nearest',
		});

		// Add attention-grabbing highlight animation
		documentItem.addClass('importing-active');

		// Remove the highlight after animation
		setTimeout(() => {
			documentItem.removeClass('importing-active');
		}, 2000);
	}

	/**
	 * Shows import completion summary with enhanced categorization and details.
	 *
	 * @private
	 * @param {ImportProgress} result - Final import results
	 */
	private showImportComplete(result: ImportProgress): void {
		// Reset importing state to re-enable buttons
		this.setImporting(false);

		// Hide footer buttons since they're no longer relevant
		this.footerEl.removeClass('granola-controls-visible');
		this.footerEl.addClass('granola-controls-hidden');

		this.progressEl.empty();

		const summary = this.progressEl.createDiv('import-summary');
		summary.createEl('h3', { text: 'Import complete!' });

		// Get all document progress for detailed reporting
		const allDocProgress = this.importManager.getAllDocumentProgress();

		// Create overview statistics
		this.createOverviewStats(summary, result);

		// Create detailed sections for different outcomes
		if (result.completed > 0) {
			this.createSuccessSection(summary, allDocProgress);
		}

		if (result.failed > 0) {
			this.createFailureSection(summary, allDocProgress);
		}

		if (result.skipped > 0) {
			this.createSkippedSection(summary, allDocProgress);
		}

		if (result.empty > 0) {
			this.createEmptySection(summary, allDocProgress);
		}

		// Add actionable recommendations
		this.createRecommendationsSection(summary, result, allDocProgress);

		// Get successfully imported files for opening
		const importedFiles = allDocProgress
			.filter(progress => progress.status === 'completed' && progress.file)
			.map(progress => progress.file!)
			.filter(file => file !== undefined);

		// Add buttons for next actions
		const buttonsDiv = summary.createDiv('import-complete-buttons');

		// If there are imported files, show "Open Imported Notes" button
		if (importedFiles.length > 0) {
			new ButtonComponent(buttonsDiv)
				.setButtonText(`Open imported notes (${importedFiles.length})`)
				.setCta()
				.onClick(() => {
					this.openImportedFiles(importedFiles);
					this.close();
				});
		}

		// Always show close button
		new ButtonComponent(buttonsDiv).setButtonText('Close').onClick(() => this.close());
	}

	/**
	 * Creates overview statistics section.
	 *
	 * @private
	 * @param {HTMLElement} container - Container element
	 * @param {ImportProgress} result - Import results
	 */
	private createOverviewStats(container: HTMLElement, result: ImportProgress): void {
		const stats = container.createDiv('import-stats-overview');

		const statsGrid = stats.createDiv('stats-grid');

		// Successful imports
		if (result.completed > 0) {
			const successStat = statsGrid.createDiv('stat-item stat-success');
			successStat.createEl('div', { text: result.completed.toString(), cls: 'stat-number' });
			successStat.createEl('div', { text: 'Imported successfully', cls: 'stat-label' });
		}

		// Failed imports
		if (result.failed > 0) {
			const failedStat = statsGrid.createDiv('stat-item stat-failed');
			failedStat.createEl('div', { text: result.failed.toString(), cls: 'stat-number' });
			failedStat.createEl('div', { text: 'Failed', cls: 'stat-label' });
		}

		// Skipped imports
		if (result.skipped > 0) {
			const skippedStat = statsGrid.createDiv('stat-item stat-skipped');
			skippedStat.createEl('div', { text: result.skipped.toString(), cls: 'stat-number' });
			skippedStat.createEl('div', { text: 'Skipped', cls: 'stat-label' });
		}

		// Empty documents
		if (result.empty > 0) {
			const emptyStat = statsGrid.createDiv('stat-item stat-empty');
			emptyStat.createEl('div', { text: result.empty.toString(), cls: 'stat-number' });
			emptyStat.createEl('div', { text: 'Empty documents', cls: 'stat-label' });
		}
	}

	/**
	 * Creates success section showing imported documents.
	 *
	 * @private
	 * @param {HTMLElement} container - Container element
	 * @param {DocumentProgress[]} allDocProgress - All document progress data
	 */
	private createSuccessSection(container: HTMLElement, allDocProgress: DocumentProgress[]): void {
		const successDocs = allDocProgress.filter(progress => progress.status === 'completed');
		if (successDocs.length === 0) return;

		const section = container.createDiv('import-section success-section');
		const header = section.createDiv('section-header');
		header.createEl('h4', { text: `✅ Successfully imported (${successDocs.length})` });

		const toggle = header.createEl('button', { cls: 'section-toggle', text: '▼' });
		const content = section.createDiv('section-content');

		const list = content.createEl('ul', { cls: 'success-documents-list' });
		successDocs.forEach(doc => {
			const docMeta = this.documentMetadata.find(d => d.id === doc.id);
			const title = docMeta?.title || 'Unknown Document';
			const listItem = list.createEl('li');
			const titleSpan = listItem.createEl('span', { cls: 'success-doc-title' });
			titleSpan.textContent = title;

			if (doc.file) {
				const openButton = listItem.createEl('button', {
					text: 'Open',
					cls: 'open-doc-button',
				});
				openButton.addEventListener('click', async () => {
					const leaf = this.app.workspace.getLeaf('tab');
					await leaf.openFile(doc.file!);
				});
			}
		});

		this.setupSectionToggle(toggle, content);
	}

	/**
	 * Creates failure section with categorized errors.
	 *
	 * @private
	 * @param {HTMLElement} container - Container element
	 * @param {DocumentProgress[]} allDocProgress - All document progress data
	 */
	private createFailureSection(container: HTMLElement, allDocProgress: DocumentProgress[]): void {
		const failedDocs = allDocProgress.filter(progress => progress.status === 'failed');
		if (failedDocs.length === 0) return;

		const section = container.createDiv('import-section failure-section');
		const header = section.createDiv('section-header');
		header.createEl('h4', { text: `❌ Failed documents (${failedDocs.length})` });

		const toggle = header.createEl('button', { cls: 'section-toggle', text: '▼' });
		const content = section.createDiv('section-content');

		// Group by error category
		const errorCategories = this.groupDocumentsByErrorCategory(failedDocs);

		Object.entries(errorCategories).forEach(([category, docs]) => {
			if (docs.length === 0) return;

			const categorySection = content.createDiv('error-category');
			const categoryTitle = this.getErrorCategoryTitle(category);
			const categoryDescription = this.getErrorCategoryDescription(category);

			categorySection.createEl('h5', { text: `${categoryTitle} (${docs.length})` });
			categorySection.createEl('p', {
				text: categoryDescription,
				cls: 'category-description',
			});

			const errorList = categorySection.createEl('ul', { cls: 'error-documents-list' });
			docs.forEach(doc => {
				const docMeta = this.documentMetadata.find(d => d.id === doc.id);
				const title = docMeta?.title || 'Unknown Document';
				const errorMsg = doc.error || 'Unknown error';

				const listItem = errorList.createEl('li');
				const titleSpan = listItem.createEl('span', { cls: 'failed-doc-title' });
				titleSpan.textContent = title;
				listItem.createEl('span', { text: errorMsg, cls: 'failed-doc-error' });
			});
		});

		this.setupSectionToggle(toggle, content);
	}

	/**
	 * Creates skipped section with categorized reasons.
	 *
	 * @private
	 * @param {HTMLElement} container - Container element
	 * @param {DocumentProgress[]} allDocProgress - All document progress data
	 */
	private createSkippedSection(container: HTMLElement, allDocProgress: DocumentProgress[]): void {
		const skippedDocs = allDocProgress.filter(progress => progress.status === 'skipped');
		if (skippedDocs.length === 0) return;

		const section = container.createDiv('import-section skipped-section');
		const header = section.createDiv('section-header');
		header.createEl('h4', { text: `⏭️ Skipped documents (${skippedDocs.length})` });

		const toggle = header.createEl('button', { cls: 'section-toggle', text: '▼' });
		const content = section.createDiv('section-content');

		// Group by skip reason
		const skipReasons = this.groupDocumentsBySkipReason(skippedDocs);

		Object.entries(skipReasons).forEach(([reason, docs]) => {
			if (docs.length === 0) return;

			const reasonSection = content.createDiv('skip-reason-category');
			const reasonTitle = this.getSkipReasonTitle(reason);
			const reasonDescription = this.getSkipReasonDescription(reason);

			reasonSection.createEl('h5', { text: `${reasonTitle} (${docs.length})` });
			reasonSection.createEl('p', { text: reasonDescription, cls: 'category-description' });

			const skipList = reasonSection.createEl('ul', { cls: 'skipped-documents-list' });
			docs.forEach(doc => {
				const docMeta = this.documentMetadata.find(d => d.id === doc.id);
				const title = docMeta?.title || 'Unknown Document';

				const listItem = skipList.createEl('li');
				const titleSpan = listItem.createEl('span', { cls: 'skipped-doc-title' });
				titleSpan.textContent = title;
				listItem.createEl('span', { text: doc.message, cls: 'skip-reason' });
			});
		});

		this.setupSectionToggle(toggle, content);
	}

	/**
	 * Creates empty documents section.
	 *
	 * @private
	 * @param {HTMLElement} container - Container element
	 * @param {DocumentProgress[]} allDocProgress - All document progress data
	 */
	private createEmptySection(container: HTMLElement, allDocProgress: DocumentProgress[]): void {
		const emptyDocs = allDocProgress.filter(progress => progress.status === 'empty');
		if (emptyDocs.length === 0) return;

		const section = container.createDiv('import-section empty-section');
		const header = section.createDiv('section-header');
		header.createEl('h4', { text: `📄 Empty documents (${emptyDocs.length})` });

		const toggle = header.createEl('button', { cls: 'section-toggle', text: '▼' });
		const content = section.createDiv('section-content');

		content.createEl('p', {
			text: 'These documents were created but never edited in Granola, so they contain no content to import.',
			cls: 'category-description',
		});

		const emptyList = content.createEl('ul', { cls: 'empty-documents-list' });
		emptyDocs.forEach(doc => {
			const docMeta = this.documentMetadata.find(d => d.id === doc.id);
			const title = docMeta?.title || 'Unknown Document';

			const listItem = emptyList.createEl('li');
			const titleSpan = listItem.createEl('span', { cls: 'empty-doc-title' });
			titleSpan.textContent = title;
		});

		this.setupSectionToggle(toggle, content);
	}

	/**
	 * Creates recommendations section based on import results.
	 *
	 * @private
	 * @param {HTMLElement} container - Container element
	 * @param {ImportProgress} result - Import results
	 * @param {DocumentProgress[]} allDocProgress - All document progress data
	 */
	private createRecommendationsSection(
		container: HTMLElement,
		result: ImportProgress,
		allDocProgress: DocumentProgress[]
	): void {
		const recommendations: string[] = [];

		// Analyze results and generate recommendations
		const failedDocs = allDocProgress.filter(progress => progress.status === 'failed');
		const skippedDocs = allDocProgress.filter(progress => progress.status === 'skipped');

		if (failedDocs.length > 0) {
			const errorCategories = this.groupDocumentsByErrorCategory(failedDocs);

			if (errorCategories.filesystem?.length > 0) {
				recommendations.push(
					'Check your vault permissions and available disk space for filesystem errors.'
				);
			}
			if (errorCategories.network?.length > 0) {
				recommendations.push(
					'Check your internet connection and try importing failed documents again.'
				);
			}
			if (errorCategories.conversion?.length > 0) {
				recommendations.push(
					'Some documents may have unsupported content formats. Check these documents in Granola.'
				);
			}
		}

		if (skippedDocs.length > 0) {
			const alreadyExists = skippedDocs.filter(doc => doc.message.includes('already exists'));
			if (alreadyExists.length > 0) {
				recommendations.push(
					'Use "Import Granola Notes" again with update strategy to import existing documents.'
				);
			}
		}

		if (result.empty > 0) {
			recommendations.push(
				'Empty documents can be safely ignored as they contain no content.'
			);
		}

		if (recommendations.length > 0) {
			const section = container.createDiv('import-section recommendations-section');
			section.createEl('h4', { text: '💡 Recommendations' });

			const list = section.createEl('ul', { cls: 'recommendations-list' });
			recommendations.forEach(rec => {
				list.createEl('li', { text: rec });
			});
		}
	}

	/**
	 * Sets up toggle functionality for collapsible sections.
	 *
	 * @private
	 * @param {HTMLElement} toggle - Toggle button element
	 * @param {HTMLElement} content - Content element to toggle
	 */
	private setupSectionToggle(toggle: HTMLElement, content: HTMLElement): void {
		let isExpanded = true;

		toggle.addEventListener('click', () => {
			isExpanded = !isExpanded;
			if (isExpanded) {
				content.removeClass('granola-controls-hidden');
				content.addClass('granola-controls-visible');
			} else {
				content.removeClass('granola-controls-visible');
				content.addClass('granola-controls-hidden');
			}
			toggle.textContent = isExpanded ? '▼' : '▶';
		});
	}

	/**
	 * Groups documents by error category.
	 *
	 * @private
	 * @param {DocumentProgress[]} failedDocs - Failed documents
	 * @returns {Record<string, DocumentProgress[]>} Grouped documents
	 */
	private groupDocumentsByErrorCategory(
		failedDocs: DocumentProgress[]
	): Record<string, DocumentProgress[]> {
		const categories: Record<string, DocumentProgress[]> = {
			validation: [],
			conversion: [],
			filesystem: [],
			permission: [],
			network: [],
			unknown: [],
		};

		failedDocs.forEach(doc => {
			const category = doc.errorCategory || 'unknown';
			if (categories[category]) {
				categories[category].push(doc);
			} else {
				categories.unknown.push(doc);
			}
		});

		return categories;
	}

	/**
	 * Groups documents by skip reason.
	 *
	 * @private
	 * @param {DocumentProgress[]} skippedDocs - Skipped documents
	 * @returns {Record<string, DocumentProgress[]>} Grouped documents
	 */
	private groupDocumentsBySkipReason(
		skippedDocs: DocumentProgress[]
	): Record<string, DocumentProgress[]> {
		const reasons: Record<string, DocumentProgress[]> = {
			already_exists: [],
			user_cancelled: [],
			empty_document: [],
			filename_collision: [],
			other: [],
		};

		skippedDocs.forEach(doc => {
			const message = doc.message.toLowerCase();
			if (message.includes('already exists')) {
				reasons.already_exists.push(doc);
			} else if (message.includes('cancelled')) {
				reasons.user_cancelled.push(doc);
			} else if (message.includes('empty')) {
				reasons.empty_document.push(doc);
			} else if (message.includes('filename collision')) {
				reasons.filename_collision.push(doc);
			} else {
				reasons.other.push(doc);
			}
		});

		return reasons;
	}

	/**
	 * Gets user-friendly title for error category.
	 *
	 * @private
	 * @param {string} category - Error category
	 * @returns {string} User-friendly title
	 */
	private getErrorCategoryTitle(category: string): string {
		switch (category) {
			case 'validation':
				return '🔍 Document Validation Errors';
			case 'conversion':
				return '🔄 Content Conversion Errors';
			case 'filesystem':
				return '💾 File System Errors';
			case 'permission':
				return '🔒 Permission Errors';
			case 'network':
				return '🌐 Network Errors';
			default:
				return '❓ Unknown Errors';
		}
	}

	/**
	 * Gets description for error category.
	 *
	 * @private
	 * @param {string} category - Error category
	 * @returns {string} Category description
	 */
	private getErrorCategoryDescription(category: string): string {
		switch (category) {
			case 'validation':
				return 'Documents with invalid or corrupted structure.';
			case 'conversion':
				return 'Documents that could not be converted to Markdown format.';
			case 'filesystem':
				return 'Errors related to file creation or disk space.';
			case 'permission':
				return 'Access denied errors due to insufficient permissions.';
			case 'network':
				return 'Connection issues while fetching document data.';
			default:
				return 'Unrecognized error types.';
		}
	}

	/**
	 * Gets user-friendly title for skip reason.
	 *
	 * @private
	 * @param {string} reason - Skip reason category
	 * @returns {string} User-friendly title
	 */
	private getSkipReasonTitle(reason: string): string {
		switch (reason) {
			case 'already_exists':
				return '📁 Already Exists';
			case 'user_cancelled':
				return '🚫 User Cancelled';
			case 'empty_document':
				return '📄 Empty Content';
			case 'filename_collision':
				return '🏷️ Filename Collision';
			default:
				return '🔀 Other Reasons';
		}
	}

	/**
	 * Gets description for skip reason.
	 *
	 * @private
	 * @param {string} reason - Skip reason category
	 * @returns {string} Reason description
	 */
	private getSkipReasonDescription(reason: string): string {
		switch (reason) {
			case 'already_exists':
				return 'Documents that already exist in your vault and were skipped per import strategy.';
			case 'user_cancelled':
				return 'Documents skipped due to user cancellation during conflict resolution.';
			case 'empty_document':
				return 'Documents detected as empty and filtered out.';
			case 'filename_collision':
				return 'Documents with filename conflicts that could not be resolved.';
			default:
				return 'Documents skipped for various other reasons.';
		}
	}

	/**
	 * Opens multiple imported files in new tabs with auto-scroll functionality.
	 *
	 * Opens each imported file in a new tab and automatically scrolls to the top
	 * of the document to ensure the user can immediately see the content. This
	 * provides a smooth user experience when reviewing newly imported documents.
	 *
	 * @private
	 * @param {TFile[]} files - Array of imported files to open
	 * @returns {Promise<void>} Resolves when files are opened and positioned
	 */
	private async openImportedFiles(files: TFile[]): Promise<void> {
		try {
			// Open each file in a new tab
			for (const file of files) {
				// Create a new leaf (tab) for each file
				const leaf = this.app.workspace.getLeaf('tab');
				await leaf.openFile(file);

				// Auto-scroll to top of the document for better UX
				await this.autoScrollToTop(leaf);
			}

			// Focus the first opened file if available
			if (files.length > 0) {
				const firstFileLeaf = this.app.workspace
					.getLeavesOfType('markdown')
					.find(leaf => (leaf.view as MarkdownView)?.file === files[0]);
				if (firstFileLeaf) {
					this.app.workspace.setActiveLeaf(firstFileLeaf);
					// Ensure the focused file is also scrolled to top
					await this.autoScrollToTop(firstFileLeaf);
				}
			}
		} catch (error) {
			console.error('Error opening imported files:', error);
			// Show a user-friendly notice
			new Notice('Error opening imported files. Please check the console for details.', 5000);
		}
	}

	/**
	 * Auto-scrolls a leaf (tab) to the top of the document with smooth animation.
	 *
	 * This method provides enhanced user experience by ensuring that newly opened
	 * imported files are positioned at the top, making the content immediately
	 * visible and readable. Uses smooth scrolling animation when supported.
	 *
	 * @private
	 * @param {WorkspaceLeaf} leaf - The Obsidian workspace leaf to scroll
	 * @returns {Promise<void>} Resolves after auto-scroll attempts complete
	 */
	private async autoScrollToTop(leaf: WorkspaceLeaf): Promise<void> {
		try {
			// Small delay to ensure the view is fully loaded
			await new Promise(resolve => setTimeout(resolve, 100));

			// Get the editor or content element
			const view = leaf.view;
			if (!view) {
				return;
			}

			// Try multiple methods to scroll to top based on different view types
			const markdownView = view as MarkdownView;
			if (markdownView.editor?.scrollTo) {
				// CodeMirror editor (source mode)
				markdownView.editor.scrollTo(null, 0);
				return; // Successfully scrolled, no need to continue
			}

			// Check for views with contentEl (reading mode, etc.)
			const viewWithContentEl = view as unknown as { contentEl?: HTMLElement };
			if (viewWithContentEl.contentEl) {
				const scrollElement =
					viewWithContentEl.contentEl.querySelector('.markdown-reading-view') ||
					viewWithContentEl.contentEl.querySelector('.markdown-source-view') ||
					viewWithContentEl.contentEl.querySelector('.view-content') ||
					viewWithContentEl.contentEl;

				if (
					(scrollElement as { scrollTo?: (options: ScrollToOptions) => void })?.scrollTo
				) {
					(scrollElement as { scrollTo: (options: ScrollToOptions) => void }).scrollTo({
						top: 0,
						behavior: 'smooth',
					});
					return; // Successfully scrolled, no need for fallback
				}
			}

			// Fallback: try to find any scrollable element in the leaf
			const leafWithContainer = leaf as { containerEl?: HTMLElement };
			if (leafWithContainer.containerEl) {
				const scrollableElements = leafWithContainer.containerEl.querySelectorAll(
					'.cm-scroller, .markdown-reading-view, .view-content, .workspace-leaf-content'
				);

				for (const element of scrollableElements) {
					const scrollableElement = element as {
						scrollTo?: (options: ScrollToOptions) => void;
						scrollTop?: number;
					};

					// Try modern scrollTo method first, fallback to scrollTop
					if (scrollableElement.scrollTo) {
						scrollableElement.scrollTo({
							top: 0,
							behavior: 'smooth',
						});
						return; // Successfully scrolled
					} else if (typeof scrollableElement.scrollTop === 'number') {
						scrollableElement.scrollTop = 0;
						return; // Successfully scrolled
					}
				}
			}
		} catch (error) {
			// Silently handle errors in auto-scroll to avoid disrupting file opening
			console.debug('Auto-scroll failed (non-critical):', error);
		}
	}

	/**
	 * Applies status filter.
	 *
	 * @private
	 * @param {string} status - Status to filter by
	 */
	private applyStatusFilter(status: string): void {
		this.currentFilter.statusFilter = status
			? [status as 'NEW' | 'EXISTS' | 'UPDATED' | 'CONFLICT']
			: undefined;
		this.renderDocumentList();
	}

	/**
	 * Selects all visible documents.
	 *
	 * @private
	 */
	private selectAll(): void {
		this.documentMetadata.forEach(doc => {
			if (doc.visible) {
				doc.selected = true;
			}
		});
		this.renderDocumentList();
		this.updateFooterButtons();
	}

	/**
	 * Deselects all documents.
	 *
	 * @private
	 */
	private selectNone(): void {
		this.documentMetadata.forEach(doc => {
			doc.selected = false;
		});
		this.renderDocumentList();
		this.updateFooterButtons();
	}

	/**
	 * Updates the state of footer buttons.
	 *
	 * @private
	 */
	private updateFooterButtons(): void {
		const selectedCount = this.documentMetadata.filter(doc => doc.selected).length;
		this.importButton.setButtonText(`Import Selected (${selectedCount})`);
		this.importButton.setDisabled(selectedCount === 0 || this.isImporting);
	}

	/**
	 * Sets loading state.
	 *
	 * @private
	 * @param {boolean} loading - Whether loading
	 */
	private setLoading(loading: boolean): void {
		this.isLoading = loading;
		this.refreshButton?.setDisabled(loading);
	}

	/**
	 * Sets importing state.
	 *
	 * @private
	 * @param {boolean} importing - Whether importing
	 */
	private setImporting(importing: boolean): void {
		this.isImporting = importing;
		this.updateFooterButtons();
	}

	/**
	 * Shows an informational message.
	 *
	 * @private
	 * @param {string} message - Message to show
	 */
	private showMessage(message: string): void {
		this.documentListEl.empty();
		const messageEl = this.documentListEl.createDiv('message');
		messageEl.textContent = message;
	}

	/**
	 * Shows an error message.
	 *
	 * @private
	 * @param {string} message - Error message to show
	 */
	private showError(message: string): void {
		// Log error to console for debugging
		console.error('[Granola Importer] DocumentSelectionModal error:', message);

		this.documentListEl.empty();
		const errorEl = this.documentListEl.createDiv('error-message');
		errorEl.textContent = message;
	}

	/**
	 * Gets display text for import status.
	 *
	 * @private
	 * @param {string} status - Import status
	 * @returns {string} Display text
	 */
	private getStatusText(status: string): string {
		switch (status) {
			case 'NEW':
				return 'New';
			case 'EXISTS':
				return 'Exists';
			case 'UPDATED':
				return 'Updated';
			case 'CONFLICT':
				return 'Conflict';
			default:
				return status;
		}
	}

	/**
	 * Adds CSS class to the modal for styling.
	 *
	 * @private
	 */
	private applyStyles(): void {
		// Add modal CSS class for styling from styles.css
		this.modalEl.addClass('granola-import-modal');
	}

	/**
	 * Safely adds an event listener with automatic cleanup tracking.
	 *
	 * @private
	 * @param element - The element to attach the listener to
	 * @param type - The event type
	 * @param handler - The event handler function
	 */
	private addEventListenerWithCleanup(
		element: HTMLElement,
		type: string,
		handler: EventListener
	): void {
		element.addEventListener(type, handler);
		this.eventListenersToCleanup.push({ element, type, handler });
	}

	/**
	 * Safely creates a timer with automatic cleanup tracking.
	 *
	 * @private
	 * @param callback - The callback function
	 * @param delay - The delay in milliseconds
	 * @param isInterval - Whether this is an interval (repeating) timer
	 * @returns The timer ID
	 */
	private createTimerWithCleanup(
		callback: () => void,
		delay: number,
		isInterval: boolean = false
	): ReturnType<typeof setTimeout> {
		const timerId = isInterval ? setInterval(callback, delay) : setTimeout(callback, delay);
		this.timersToCleanup.add(timerId as ReturnType<typeof setTimeout>);

		return timerId as ReturnType<typeof setTimeout>;
	}

	/**
	 * Cleans up resources when modal is closed.
	 *
	 * @private
	 */
	private cleanup(): void {
		// Cleanup if needed (styles are now in styles.css)
	}
}
