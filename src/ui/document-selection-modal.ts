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
		this.headerEl.createEl('h2', { text: 'Import Granola Notes' });

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
		this.progressEl.style.display = 'none';

		// Footer
		this.footerEl = this.modalContentEl.createDiv('modal-footer');
		this.setupFooter();

		// Apply CSS
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
			.setButtonText('Select All')
			.onClick(() => this.selectAll());

		// Select None button
		this.selectNoneButton = new ButtonComponent(buttonContainer)
			.setButtonText('Select None')
			.onClick(() => this.selectNone());

		// Refresh button
		this.refreshButton = new ButtonComponent(buttonContainer)
			.setButtonText('Refresh')
			.onClick(() => this.refreshDocuments());

		// Status filter dropdown
		const filterContainer = this.controlsEl.createDiv('filter-group');
		filterContainer.createEl('label', { text: 'Filter by status:' });

		const statusSelect = filterContainer.createEl('select');
		statusSelect.createEl('option', { value: '', text: 'All Status' });
		statusSelect.createEl('option', { value: 'NEW', text: 'New Documents' });
		statusSelect.createEl('option', { value: 'UPDATED', text: 'Updated Documents' });
		statusSelect.createEl('option', { value: 'CONFLICT', text: 'Conflicts' });
		statusSelect.createEl('option', { value: 'EXISTS', text: 'Already Exists' });

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
			.onChange(value => this.applyTextFilter(value));
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
			.setButtonText('Import Selected')
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
		titleRow.createEl('h3', {
			text: doc.title,
			cls: 'document-title',
		});

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
				createBackups: false,
				maxConcurrency: 3,
				delayBetweenImports: 100,
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
		this.controlsEl.style.display = 'block';
		this.searchEl.style.display = 'block';
		this.documentListEl.style.display = 'block';
		this.footerEl.style.display = 'block';
		this.progressEl.style.display = 'none';
	}

	/**
	 * Shows the progress view during import.
	 *
	 * @private
	 */
	private showProgressView(): void {
		this.controlsEl.style.display = 'none';
		this.searchEl.style.display = 'none';
		this.documentListEl.style.display = 'none';
		this.footerEl.style.display = 'none';
		this.progressEl.style.display = 'block';

		this.progressEl.empty();
		this.progressEl.createEl('h3', { text: 'Importing Documents...' });

		// Progress bar
		const progressContainer = this.progressEl.createDiv('progress-container');
		const progressBar = progressContainer.createDiv('progress-bar');
		progressBar.createDiv('progress-fill');
		progressContainer.createDiv('progress-text');

		// Document progress list
		this.progressEl.createDiv('document-progress-list');

		// Cancel button
		new ButtonComponent(this.progressEl).setButtonText('Cancel Import').onClick(() => {
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
			progressFill.style.width = `${progress.percentage}%`;
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
		// TODO: Implement individual document progress display
		// For now, document progress is handled by the overall progress callback
		// Future enhancement: show per-document status in the UI
	}

	/**
	 * Shows import completion summary.
	 *
	 * @private
	 * @param {ImportProgress} result - Final import results
	 */
	private showImportComplete(result: ImportProgress): void {
		// Reset importing state to re-enable buttons
		this.setImporting(false);

		// Hide footer buttons since they're no longer relevant
		this.footerEl.style.display = 'none';

		this.progressEl.empty();

		const summary = this.progressEl.createDiv('import-summary');
		summary.createEl('h3', { text: 'Import Complete!' });

		const stats = summary.createDiv('import-stats');
		stats.createEl('p', { text: `✅ ${result.completed} documents imported successfully` });
		if (result.failed > 0) {
			stats.createEl('p', { text: `❌ ${result.failed} documents failed` });
		}
		if (result.skipped > 0) {
			stats.createEl('p', { text: `⏭️ ${result.skipped} documents skipped` });
		}

		// Get successfully imported files for opening
		const allDocProgress = this.importManager.getAllDocumentProgress();
		const importedFiles = allDocProgress
			.filter(progress => progress.status === 'completed' && progress.file)
			.map(progress => progress.file!)
			.filter(file => file !== undefined);

		// Add buttons for next actions
		const buttonsDiv = summary.createDiv('import-complete-buttons');

		// If there are imported files, show "Open Imported Notes" button
		if (importedFiles.length > 0) {
			new ButtonComponent(buttonsDiv)
				.setButtonText(`Open Imported Notes (${importedFiles.length})`)
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
	 * Applies text search filter.
	 *
	 * @private
	 * @param {string} searchText - Text to search for
	 */
	private applyTextFilter(searchText: string): void {
		this.currentFilter.searchText = searchText;
		this.renderDocumentList();
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
	 * Applies CSS styles to the modal.
	 *
	 * @private
	 */
	private applyStyles(): void {
		// Basic modal styles
		this.modalEl.addClass('granola-import-modal');

		// Add basic CSS
		const style = document.createElement('style');
		style.textContent = `
			.granola-import-modal .modal-content {
				max-width: 800px;
				max-height: 80vh;
				display: flex;
				flex-direction: column;
			}
			.granola-import-modal .modal-header h2 {
				margin: 0 0 1rem 0;
			}
			.granola-import-modal .modal-controls {
				margin-bottom: 1rem;
				padding-bottom: 1rem;
				border-bottom: 1px solid var(--background-modifier-border);
			}
			.granola-import-modal .button-group {
				display: flex;
				gap: 0.5rem;
				margin-bottom: 0.5rem;
			}
			.granola-import-modal .filter-group {
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}
			.granola-import-modal .search-container {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				margin-bottom: 1rem;
				padding-bottom: 1rem;
				border-bottom: 1px solid var(--background-modifier-border);
			}
			.granola-import-modal .modal-document-list {
				flex: 1;
				overflow-y: auto;
				margin-bottom: 1rem;
			}
			.granola-import-modal .document-list-container {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}
			.granola-import-modal .document-stats {
				padding: 0.5rem;
				background: var(--background-secondary);
				border-radius: 4px;
				font-size: 0.9rem;
				margin-bottom: 1rem;
			}
			.granola-import-modal .document-item {
				display: flex;
				gap: 0.75rem;
				padding: 1rem;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				background: var(--background-primary);
			}
			.granola-import-modal .document-item.status-new {
				border-left: 4px solid var(--color-green);
			}
			.granola-import-modal .document-item.status-updated {
				border-left: 4px solid var(--color-orange);
			}
			.granola-import-modal .document-item.status-conflict {
				border-left: 4px solid var(--color-red);
			}
			.granola-import-modal .document-item.status-exists {
				border-left: 4px solid var(--text-muted);
			}
			.granola-import-modal .document-content {
				flex: 1;
			}
			.granola-import-modal .document-title-row {
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
				margin-bottom: 0.5rem;
			}
			.granola-import-modal .document-title {
				margin: 0;
				font-size: 1.1rem;
			}
			.granola-import-modal .status-badge {
				padding: 0.25rem 0.5rem;
				border-radius: 4px;
				font-size: 0.75rem;
				font-weight: bold;
				text-transform: uppercase;
			}
			.granola-import-modal .status-badge.status-new {
				background: var(--color-green);
				color: white;
			}
			.granola-import-modal .status-badge.status-updated {
				background: var(--color-orange);
				color: white;
			}
			.granola-import-modal .status-badge.status-conflict {
				background: var(--color-red);
				color: white;
			}
			.granola-import-modal .status-badge.status-exists {
				background: var(--text-muted);
				color: white;
			}
			.granola-import-modal .document-meta {
				display: flex;
				gap: 1rem;
				margin-bottom: 0.5rem;
				font-size: 0.85rem;
				color: var(--text-muted);
			}
			.granola-import-modal .document-preview {
				margin: 0.5rem 0;
				color: var(--text-muted);
				font-size: 0.9rem;
				line-height: 1.4;
			}
			.granola-import-modal .document-reason {
				font-size: 0.8rem;
				color: var(--text-muted);
				font-style: italic;
			}
			.granola-import-modal .modal-footer {
				border-top: 1px solid var(--background-modifier-border);
				padding-top: 1rem;
			}
			.granola-import-modal .footer-buttons {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
			.granola-import-modal .progress-container {
				margin: 1rem 0;
			}
			.granola-import-modal .progress-bar {
				width: 100%;
				height: 20px;
				background: var(--background-secondary);
				border-radius: 10px;
				overflow: hidden;
			}
			.granola-import-modal .progress-fill {
				height: 100%;
				background: var(--interactive-accent);
				transition: width 0.3s ease;
			}
			.granola-import-modal .progress-text {
				text-align: center;
				margin-top: 0.5rem;
				font-size: 0.9rem;
			}
			.granola-import-modal .message,
			.granola-import-modal .error-message {
				text-align: center;
				padding: 2rem;
				font-size: 1rem;
			}
			.granola-import-modal .error-message {
				color: var(--color-red);
			}
		`;
		document.head.appendChild(style);
	}

	/**
	 * Cleans up resources when modal is closed.
	 *
	 * @private
	 */
	private cleanup(): void {
		// Remove any added styles
		const existingStyles = document.head.querySelectorAll('style');
		existingStyles.forEach(style => {
			if (style.textContent?.includes('.granola-import-modal')) {
				style.remove();
			}
		});
	}
}
