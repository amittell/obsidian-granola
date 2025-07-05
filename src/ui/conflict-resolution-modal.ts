import type { App, TFile } from 'obsidian';
import { Modal, ButtonComponent } from 'obsidian';
import type { GranolaDocument } from '../api';
import type { DocumentDisplayMetadata } from '../services/document-metadata';
import type { Logger } from '../types';
import { PerformanceMonitor, trackMemoryLeaks } from '../performance/performance-monitor';

/**
 * User's choice for resolving a document conflict.
 */
export type ConflictResolution =
	| { action: 'skip'; reason: string }
	| { action: 'overwrite'; createBackup: boolean }
	| { action: 'merge'; strategy: 'append' | 'prepend' }
	| { action: 'rename'; newFilename: string }
	| { action: 'view-diff' }; // For future implementation

/**
 * Modal for resolving import conflicts when documents already exist.
 *
 * This modal provides users with clear options for handling conflicts,
 * showing them what will happen and letting them make informed decisions
 * about their data.
 *
 * Enhanced with memory leak detection and performance optimization.
 */
@trackMemoryLeaks('ConflictResolutionModal')
export class ConflictResolutionModal extends Modal {
	private document: GranolaDocument;
	private metadata: DocumentDisplayMetadata;
	private existingFile: TFile | undefined;
	private existingContent: string = '';
	private logger: Logger;
	private resolve!: (resolution: ConflictResolution) => void;
	private reject!: (error: Error) => void;

	// Performance monitoring
	private performanceMonitor: PerformanceMonitor;
	private memoryTrackingId: string = '';
	private eventListenersToCleanup: Array<{
		element: HTMLElement;
		type: string;
		handler: EventListener;
	}> = [];
	private timersToCleanup: Set<number> = new Set();

	constructor(
		app: App,
		document: GranolaDocument,
		metadata: DocumentDisplayMetadata,
		existingFile: TFile | undefined,
		logger: Logger
	) {
		super(app);
		this.document = document;
		this.metadata = metadata;
		this.existingFile = existingFile;
		this.logger = logger;

		// Initialize performance monitoring
		this.performanceMonitor = PerformanceMonitor.getInstance();

		// Debug: Modal initialization
		this.logger.debug(`ConflictResolutionModal initialized for document: ${document.title || 'Untitled'} (${document.id})`);
		this.logger.debug(`Conflict reason: ${metadata.importStatus.reason}`);
	}

	/**
	 * Shows the conflict resolution modal and returns a promise with the user's choice.
	 */
	showConflictResolution(): Promise<ConflictResolution> {
		return new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
			this.open();
		});
	}

	async onOpen(): Promise<void> {
		// Load existing file content if available
		if (this.existingFile) {
			this.logger.debug(`Loading existing file content from: ${this.existingFile.path}`);
			try {
				this.existingContent = await this.app.vault.read(this.existingFile);
				this.logger.debug(`Existing file content loaded: ${this.existingContent.length} characters`);
			} catch (error) {
				this.logger.debug('Failed to read existing file:', error);
				console.warn('Failed to read existing file:', error);
			}
		} else {
			this.logger.debug('No existing file to load');
		}

		this.setupUI();
	}

	onClose(): void {
		// If modal was closed without resolution, default to skip
		if (this.resolve) {
			this.resolve({
				action: 'skip',
				reason: 'User cancelled conflict resolution',
			});
		}
	}

	private setupUI(): void {
		this.contentEl.empty();
		this.contentEl.addClass('granola-conflict-modal');

		// Header
		const header = this.contentEl.createDiv('conflict-header');
		header.createEl('h2', { text: 'Import Conflict Detected' });

		const status = header.createEl('div', { cls: 'conflict-status' });
		status.innerHTML = this.getStatusMessage();

		// Document info
		const docInfo = this.contentEl.createDiv('conflict-document-info');
		this.createDocumentInfo(docInfo);

		// Conflict details
		const conflictDetails = this.contentEl.createDiv('conflict-details');
		this.createConflictDetails(conflictDetails);

		// Resolution options
		const resolutionOptions = this.contentEl.createDiv('resolution-options');
		this.createResolutionOptions(resolutionOptions);

		// Apply styles
		this.applyStyles();
	}

	private getStatusMessage(): string {
		const status = this.metadata.importStatus.status;
		const reason = this.metadata.importStatus.reason;

		switch (status) {
			case 'CONFLICT':
				return `<span class="status-conflict">⚠️ Conflict:</span> ${reason}`;
			case 'EXISTS':
				return `<span class="status-exists">📄 Exists:</span> ${reason}`;
			case 'UPDATED':
				return `<span class="status-updated">🔄 Updated:</span> ${reason}`;
			default:
				return `<span class="status-unknown">❓ Unknown:</span> ${reason}`;
		}
	}

	private createDocumentInfo(container: HTMLElement): void {
		container.createEl('h3', { text: 'Document Information' });

		const table = container.createEl('table', { cls: 'document-info-table' });

		// Title
		const titleRow = table.createEl('tr');
		titleRow.createEl('td', { text: 'Title:', cls: 'info-label' });
		titleRow.createEl('td', { text: this.document.title || 'Untitled' });

		// Granola ID
		const idRow = table.createEl('tr');
		idRow.createEl('td', { text: 'Granola ID:', cls: 'info-label' });
		idRow.createEl('td', { text: this.document.id, cls: 'monospace' });

		// Last updated
		const updatedRow = table.createEl('tr');
		updatedRow.createEl('td', { text: 'Last Updated:', cls: 'info-label' });
		updatedRow.createEl('td', { text: this.metadata.updatedDate });

		// Word count
		const wordsRow = table.createEl('tr');
		wordsRow.createEl('td', { text: 'Word Count:', cls: 'info-label' });
		wordsRow.createEl('td', { text: `${this.metadata.wordCount} words` });

		// Existing file info
		if (this.existingFile) {
			const existingRow = table.createEl('tr');
			existingRow.createEl('td', { text: 'Existing File:', cls: 'info-label' });
			existingRow.createEl('td', { text: this.existingFile.path, cls: 'monospace' });
		}
	}

	private createConflictDetails(container: HTMLElement): void {
		container.createEl('h3', { text: 'Conflict Details' });

		const detailsBox = container.createDiv('conflict-details-box');

		// Show preview of both versions
		const comparison = detailsBox.createDiv('content-comparison');

		// Granola version preview
		const granolaPreview = comparison.createDiv('version-preview granola-version');
		granolaPreview.createEl('h4', { text: '📥 Granola Version (Incoming)' });
		const granolaContent = granolaPreview.createEl('div', { cls: 'content-preview' });
		granolaContent.textContent = this.getGranolaPreview();

		// Existing version preview
		if (this.existingFile && this.existingContent) {
			const existingPreview = comparison.createDiv('version-preview existing-version');
			existingPreview.createEl('h4', { text: '📄 Current Version (In Vault)' });
			const existingContentEl = existingPreview.createEl('div', { cls: 'content-preview' });
			existingContentEl.textContent = this.getExistingPreview();
		}
	}

	private createResolutionOptions(container: HTMLElement): void {
		container.createEl('h3', { text: 'Choose Resolution' });

		const optionsGrid = container.createDiv('resolution-grid');

		// Skip option
		this.createResolutionOption(optionsGrid, {
			title: '⏭️ Skip This Document',
			description: "Leave existing file unchanged, don't import this document",
			action: () => this.resolveWith({ action: 'skip', reason: 'User chose to skip' }),
			buttonText: 'Skip',
			buttonClass: 'skip-button',
		});

		// Overwrite option
		this.createResolutionOption(optionsGrid, {
			title: '🔄 Replace Existing File',
			description: 'Overwrite the existing file with the Granola version',
			action: () => this.showOverwriteOptions(),
			buttonText: 'Replace',
			buttonClass: 'overwrite-button',
		});

		// Merge option
		if (this.existingFile) {
			this.createResolutionOption(optionsGrid, {
				title: '🔗 Merge Content',
				description: 'Combine the existing content with the Granola version',
				action: () => this.showMergeOptions(),
				buttonText: 'Merge',
				buttonClass: 'merge-button',
			});
		}

		// Rename option
		this.createResolutionOption(optionsGrid, {
			title: '📝 Import with New Name',
			description: 'Import the Granola document with a different filename',
			action: () => this.showRenameOptions(),
			buttonText: 'Rename',
			buttonClass: 'rename-button',
		});

		// Cancel option
		const cancelDiv = container.createDiv('cancel-option');
		new ButtonComponent(cancelDiv).setButtonText('Cancel Import').onClick(() => this.close());
	}

	private createResolutionOption(
		container: HTMLElement,
		options: {
			title: string;
			description: string;
			action: () => void;
			buttonText: string;
			buttonClass: string;
		}
	): void {
		const optionDiv = container.createDiv('resolution-option');

		const content = optionDiv.createDiv('option-content');
		content.createEl('h4', { text: options.title });
		content.createEl('p', { text: options.description });

		const buttonDiv = optionDiv.createDiv('option-button');
		new ButtonComponent(buttonDiv)
			.setButtonText(options.buttonText)
			.setClass(options.buttonClass)
			.onClick(options.action);
	}

	private showOverwriteOptions(): void {
		this.logger.debug('Showing overwrite confirmation dialog');
		// Clear any existing dialogs first
		this.clearExistingDialogs();

		const confirmDiv = this.contentEl.createDiv('confirmation-dialog');
		confirmDiv.createEl('h4', { text: '⚠️ Confirm Replacement' });
		confirmDiv.createEl('p', {
			text: 'This will permanently replace the existing file. This action cannot be undone.',
		});

		const backupOption = confirmDiv.createDiv('backup-option');
		const backupCheckbox = backupOption.createEl('input', {
			type: 'checkbox',
		}) as HTMLInputElement;
		backupCheckbox.checked = true;
		backupOption.createEl('label', {
			text: ' Create backup of existing file before replacing',
			attr: { for: backupCheckbox.id },
		});

		const buttons = confirmDiv.createDiv('confirmation-buttons');

		new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => {
			confirmDiv.remove();
		});

		new ButtonComponent(buttons)
			.setButtonText('Replace File')
			.setClass('mod-warning')
			.onClick(() => {
				this.resolveWith({
					action: 'overwrite',
					createBackup: backupCheckbox.checked,
				});
			});

		// Scroll the dialog into view for better UX (if available)
		confirmDiv.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
	}

	private showMergeOptions(): void {
		this.logger.debug('Showing merge strategy dialog');
		// Clear any existing dialogs first
		this.clearExistingDialogs();

		const mergeDiv = this.contentEl.createDiv('merge-dialog');
		mergeDiv.createEl('h4', { text: '🔗 Choose Merge Strategy' });

		const appendOption = mergeDiv.createDiv('merge-option');
		new ButtonComponent(appendOption).setButtonText('Append Granola Content').onClick(() => {
			this.resolveWith({ action: 'merge', strategy: 'append' });
		});
		appendOption.createEl('p', {
			text: 'Add the Granola content to the end of the existing file',
			cls: 'merge-description',
		});

		const prependOption = mergeDiv.createDiv('merge-option');
		new ButtonComponent(prependOption).setButtonText('Prepend Granola Content').onClick(() => {
			this.resolveWith({ action: 'merge', strategy: 'prepend' });
		});
		prependOption.createEl('p', {
			text: 'Add the Granola content to the beginning of the existing file',
			cls: 'merge-description',
		});

		const cancelButton = mergeDiv.createDiv('merge-cancel');
		new ButtonComponent(cancelButton).setButtonText('Cancel').onClick(() => {
			mergeDiv.remove();
		});

		// Scroll the dialog into view for better UX (if available)
		mergeDiv.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
	}

	private showRenameOptions(): void {
		this.logger.debug('Showing rename options dialog');
		// Clear any existing dialogs first
		this.clearExistingDialogs();

		const renameDiv = this.contentEl.createDiv('rename-dialog');
		renameDiv.createEl('h4', { text: '📝 Enter New Filename' });

		const inputContainer = renameDiv.createDiv('filename-input-container');
		const input = inputContainer.createEl('input', {
			type: 'text',
			value: this.generateAlternativeFilename(),
			cls: 'filename-input',
		}) as HTMLInputElement;

		inputContainer.createEl('span', { text: '.md', cls: 'filename-extension' });

		const buttons = renameDiv.createDiv('rename-buttons');

		new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => {
			renameDiv.remove();
		});

		new ButtonComponent(buttons)
			.setButtonText('Import with New Name')
			.setCta()
			.onClick(() => {
				const newFilename = input.value.trim();
				if (newFilename) {
					this.resolveWith({
						action: 'rename',
						newFilename: `${newFilename}.md`,
					});
				}
			});

		// Scroll the dialog into view for better UX (if available)
		renameDiv.scrollIntoView?.({ behavior: 'smooth', block: 'center' });

		// Focus the input and select text for easy editing
		input.focus();
		input.select();
	}

	private getGranolaPreview(): string {
		// Try to extract content from ProseMirror using same logic as converter
		let content = '';
		let contentSource = '';

		// Try last_viewed_panel.content first (most reliable)
		if (this.document.last_viewed_panel?.content) {
			this.logger.debug('Trying last_viewed_panel.content for preview...');
			content = this.extractTextFromProseMirror(
				this.document.last_viewed_panel.content as unknown as Record<string, unknown>
			);
			if (content) contentSource = 'last_viewed_panel.content';
		}

		// Fallback to notes field
		if (!content && this.document.notes) {
			this.logger.debug('Fallback: trying notes.content for preview...');
			content = this.extractTextFromProseMirror(
				this.document.notes as unknown as Record<string, unknown>
			);
			if (content) contentSource = 'notes.content';
		}

		// Fallback to notes_plain
		if (!content && this.document.notes_plain) {
			this.logger.debug('Fallback: trying notes_plain for preview...');
			content = this.document.notes_plain;
			if (content) contentSource = 'notes_plain';
		}

		// Fallback to notes_markdown
		if (!content && this.document.notes_markdown) {
			this.logger.debug('Fallback: trying notes_markdown for preview...');
			content = this.document.notes_markdown;
			if (content) contentSource = 'notes_markdown';
		}

		// Final fallback to metadata preview
		if (!content) {
			this.logger.debug('Final fallback: using metadata.preview');
			content = this.metadata.preview || 'No content available';
			contentSource = content === 'No content available' ? 'none' : 'metadata.preview';
		}

		// Log final result
		const preview = content.trim().substring(0, 300);
		this.logger.debug(`Content preview generated from ${contentSource}: ${preview.length} characters (original: ${content.length})`);

		return preview.length === 300 ? preview + '...' : preview;
	}

	private getExistingPreview(): string {
		if (!this.existingContent) return 'Could not load existing content';

		// Remove frontmatter for preview
		const contentAfterFrontmatter = this.existingContent.replace(/^---\n[\s\S]*?\n---\n/, '');
		return contentAfterFrontmatter.substring(0, 300) + '...';
	}

	private generateAlternativeFilename(): string {
		const baseTitle = this.document.title || 'Untitled';
		const sanitized = baseTitle
			.replace(/[<>:"/\\|?*]/g, '-')
			.replace(/\s+/g, ' ')
			.trim();
		const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
		return `${sanitized} (Granola ${timestamp})`;
	}

	/**
	 * Extracts plain text from ProseMirror document structure.
	 * Similar to the logic in document-metadata.ts but simplified for preview.
	 */
	private extractTextFromProseMirror(proseMirrorDoc: Record<string, unknown>): string {
		if (!proseMirrorDoc || !proseMirrorDoc.content) {
			return '';
		}

		const extractText = (node: Record<string, unknown>): string => {
			if (node && typeof node === 'object') {
				// Direct text node
				if (node.text && typeof node.text === 'string') {
					return node.text;
				}
				// Node with children - recurse
				if (node.content && Array.isArray(node.content)) {
					return node.content.map(extractText).join(' ');
				}
			}
			return '';
		};

		const content = proseMirrorDoc.content;
		if (!Array.isArray(content)) {
			return '';
		}

		const text = content
			.map(node => extractText(node as Record<string, unknown>))
			.join(' ')
			.trim()
			.replace(/\s+/g, ' ');

		return text || '';
	}

	private clearExistingDialogs(): void {
		// Remove any existing dialog elements to prevent UI conflicts
		const existingDialogs = this.contentEl.querySelectorAll(
			'.confirmation-dialog, .merge-dialog, .rename-dialog'
		);
		if (existingDialogs.length > 0) {
			this.logger.debug(`Clearing ${existingDialogs.length} existing dialog(s)`);
		}
		existingDialogs.forEach(dialog => dialog.remove());
	}

	private resolveWith(resolution: ConflictResolution): void {
		this.logger.debug(`User selected resolution: ${resolution.action}`, resolution);
		this.resolve(resolution);
		this.close();
	}

	private applyStyles(): void {
		const style = document.createElement('style');
		style.textContent = `
			.granola-conflict-modal .modal-content {
				max-width: 900px;
				max-height: 80vh;
			}
			.granola-conflict-modal .conflict-header h2 {
				margin: 0 0 0.5rem 0;
				color: var(--text-accent);
			}
			.granola-conflict-modal .conflict-status {
				padding: 0.75rem;
				border-radius: 6px;
				background: var(--background-secondary);
				margin-bottom: 1.5rem;
			}
			.granola-conflict-modal .status-conflict {
				color: var(--color-red);
				font-weight: bold;
			}
			.granola-conflict-modal .status-exists {
				color: var(--text-muted);
				font-weight: bold;
			}
			.granola-conflict-modal .status-updated {
				color: var(--color-orange);
				font-weight: bold;
			}
			.granola-conflict-modal .document-info-table {
				width: 100%;
				border-collapse: collapse;
				margin-bottom: 1rem;
			}
			.granola-conflict-modal .document-info-table td {
				padding: 0.5rem;
				border-bottom: 1px solid var(--background-modifier-border);
			}
			.granola-conflict-modal .info-label {
				font-weight: bold;
				width: 120px;
			}
			.granola-conflict-modal .monospace {
				font-family: var(--font-monospace);
				font-size: 0.9em;
			}
			.granola-conflict-modal .content-comparison {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 1rem;
				margin: 1rem 0;
			}
			.granola-conflict-modal .version-preview {
				border: 1px solid var(--background-modifier-border);
				border-radius: 6px;
				padding: 1rem;
			}
			.granola-conflict-modal .version-preview h4 {
				margin: 0 0 0.5rem 0;
				font-size: 0.9rem;
			}
			.granola-conflict-modal .content-preview {
				background: var(--background-primary-alt);
				border-radius: 4px;
				padding: 0.75rem;
				font-size: 0.85rem;
				line-height: 1.4;
				max-height: 150px;
				overflow-y: auto;
				white-space: pre-wrap;
			}
			.granola-conflict-modal .resolution-grid {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 1rem;
				margin: 1rem 0;
			}
			.granola-conflict-modal .resolution-option {
				border: 1px solid var(--background-modifier-border);
				border-radius: 6px;
				padding: 1rem;
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}
			.granola-conflict-modal .resolution-option h4 {
				margin: 0;
				font-size: 1rem;
			}
			.granola-conflict-modal .resolution-option p {
				margin: 0;
				font-size: 0.9rem;
				color: var(--text-muted);
				flex-grow: 1;
			}
			.granola-conflict-modal .option-button {
				margin-top: auto;
			}
			.granola-conflict-modal .skip-button {
				background: var(--interactive-normal);
			}
			.granola-conflict-modal .overwrite-button {
				background: var(--color-orange);
				color: white;
			}
			.granola-conflict-modal .merge-button {
				background: var(--color-blue);
				color: white;
			}
			.granola-conflict-modal .rename-button {
				background: var(--color-green);
				color: white;
			}
			.granola-conflict-modal .confirmation-dialog,
			.granola-conflict-modal .merge-dialog,
			.granola-conflict-modal .rename-dialog {
				background: var(--background-secondary);
				border: 1px solid var(--background-modifier-border);
				border-radius: 8px;
				padding: 1.5rem;
				margin: 1rem 0;
			}
			.granola-conflict-modal .confirmation-buttons,
			.granola-conflict-modal .rename-buttons {
				display: flex;
				gap: 0.5rem;
				justify-content: flex-end;
				margin-top: 1rem;
			}
			.granola-conflict-modal .backup-option {
				margin: 1rem 0;
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}
			.granola-conflict-modal .merge-option {
				margin: 0.5rem 0;
				padding: 0.75rem;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
			}
			.granola-conflict-modal .merge-description {
				margin: 0.5rem 0 0 0;
				font-size: 0.85rem;
			}
			.granola-conflict-modal .filename-input-container {
				display: flex;
				align-items: center;
				margin: 1rem 0;
			}
			.granola-conflict-modal .filename-input {
				flex: 1;
				padding: 0.5rem;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				background: var(--background-primary);
			}
			.granola-conflict-modal .filename-extension {
				margin-left: 0.25rem;
				color: var(--text-muted);
			}
			.granola-conflict-modal .cancel-option {
				text-align: center;
				margin-top: 1.5rem;
				padding-top: 1rem;
				border-top: 1px solid var(--background-modifier-border);
			}
		`;
		document.head.appendChild(style);
	}
}
