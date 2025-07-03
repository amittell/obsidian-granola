import { Plugin, Notice } from 'obsidian';
import { GranolaAuth } from './src/auth';
import { GranolaAPI } from './src/api';
import { ProseMirrorConverter } from './src/converter';
import { DuplicateDetector } from './src/services/duplicate-detector';
import { DocumentMetadataService } from './src/services/document-metadata';
import { SelectiveImportManager } from './src/services/import-manager';
import { DocumentSelectionModal } from './src/ui/document-selection-modal';
import { GranolaSettings, DEFAULT_SETTINGS, Logger } from './src/types';
import { GranolaSettingTab } from './src/settings';

// Error Message Constants
const ERROR_MESSAGES = {
	CREDENTIALS: 'Please check your Granola credentials and ensure the app is properly logged in.',
	NETWORK: 'Network error - please check your internet connection and try again.',
	RATE_LIMIT: 'Rate limit exceeded - please wait a moment and try again.',
	FILE_SYSTEM: 'File system error - check vault permissions and available disk space.',
	UNKNOWN: 'Unknown error occurred. Check console for details.',
} as const;

/**
 * Obsidian plugin for importing notes from Granola AI.
 *
 * This plugin enables seamless import of documents from a Granola account into Obsidian,
 * converting ProseMirror JSON content to Markdown format with proper frontmatter.
 *
 * @example
 * ```typescript
 * // Plugin is automatically instantiated by Obsidian
 * // Users can trigger import via Command Palette: "Import Granola Notes"
 * ```
 *
 * @author Alex Mittell
 * @version 1.0.0
 * @since 1.0.0
 */
export default class GranolaImporterPlugin extends Plugin {
	/**
	 * Authentication manager for Granola API credentials.
	 * Handles loading, validation, and token management.
	 * @public
	 */
	auth!: GranolaAuth;

	/**
	 * API client for communicating with Granola's REST API.
	 * Provides methods for fetching documents and handling rate limiting.
	 * @public
	 */
	api!: GranolaAPI;

	/**
	 * Document converter for transforming ProseMirror JSON to Markdown.
	 * Handles complex node types, formatting, and frontmatter generation.
	 * @private
	 */
	private converter!: ProseMirrorConverter;

	/**
	 * Service for detecting duplicate documents in the vault.
	 * Scans existing files and determines import status for new documents.
	 * @private
	 */
	private duplicateDetector!: DuplicateDetector;

	/**
	 * Service for extracting and managing document metadata for UI display.
	 * Provides formatted metadata, search/filter capabilities, and statistics.
	 * @private
	 */
	private metadataService!: DocumentMetadataService;

	/**
	 * Service for managing selective document imports with progress tracking.
	 * Coordinates batch processing, error handling, and user feedback.
	 * @private
	 */
	private importManager!: SelectiveImportManager;

	/**
	 * Plugin settings with default values and persistence.
	 * Contains all configuration options for the plugin.
	 * @public
	 */
	settings!: GranolaSettings;

	/**
	 * Centralized logger that respects debug settings.
	 * Replaces direct console.log calls throughout the plugin.
	 * @public
	 */
	logger!: Logger;

	/**
	 * Plugin lifecycle method called when the plugin is loaded.
	 *
	 * Initializes the authentication, API, and converter components,
	 * then registers the import command in Obsidian's command palette.
	 *
	 * @async
	 * @returns {Promise<void>} Resolves when plugin initialization is complete
	 * @throws {Error} If plugin initialization fails
	 *
	 * @example
	 * ```typescript
	 * // Called automatically by Obsidian when plugin is enabled
	 * await plugin.onload();
	 * ```
	 */
	async onload(): Promise<void> {
		// Load settings and initialize logger
		await this.loadSettings();
		this.logger = new Logger(this.settings);

		// Initialize core components
		this.auth = new GranolaAuth();
		this.api = new GranolaAPI(this.auth);
		this.converter = new ProseMirrorConverter(this.logger, this.settings);

		// Initialize selective import services
		this.duplicateDetector = new DuplicateDetector(this.app.vault);
		this.metadataService = new DocumentMetadataService();
		this.importManager = new SelectiveImportManager(this.app, this.app.vault, this.converter);

		// Register settings tab
		this.addSettingTab(new GranolaSettingTab(this.app, this));

		// Register command in Obsidian's command palette
		this.addCommand({
			id: 'import-granola-notes',
			name: 'Import Granola Notes (Selective)',
			callback: () => {
				this.openImportModal();
			},
		});

		// Debug command for API response inspection (development only)
		// @ts-ignore - esbuild will replace this constant
		if (typeof __DEV__ !== 'undefined' && __DEV__) {
			this.addCommand({
				id: 'debug-granola-api',
				name: 'Debug Granola API Response',
				callback: () => {
					this.debugAPIResponse();
				},
			});
		}
	}

	/**
	 * Plugin lifecycle method called when the plugin is unloaded.
	 *
	 * Performs cleanup operations and logs the unload event.
	 * Currently no specific cleanup is required as all resources
	 * are managed automatically.
	 *
	 * @returns {void}
	 *
	 * @example
	 * ```typescript
	 * // Called automatically by Obsidian when plugin is disabled
	 * plugin.onunload();
	 * ```
	 */
	onunload(): void {
		// Plugin cleanup
	}

	/**
	 * Debug method to inspect API response structure and diagnose content issues.
	 *
	 * This method provides detailed analysis of the Granola API response to help
	 * identify why note content might be empty during import. It checks all
	 * content fields (notes, notes_plain, notes_markdown) and provides statistics.
	 *
	 * @async
	 * @returns {Promise<void>} Resolves when debug analysis is complete
	 */
	async debugAPIResponse(): Promise<void> {
		// @ts-ignore - esbuild will replace this constant
		if (typeof __DEV__ === 'undefined' || !__DEV__) {
			return; // Strip debug functionality in production
		}
		const debugNotice = new Notice('Starting API response debug analysis...', 0);

		try {
			// Load credentials
			await this.api.loadCredentials();
			debugNotice.setMessage('Fetching documents from Granola API...');

			// Fetch documents
			const documents = await this.api.getAllDocuments();
			debugNotice.hide();

			if (documents.length === 0) {
				new Notice('❌ No documents found in Granola account', 5000);
				return;
			}

			// Analyze first few documents
			const samplesToAnalyze = Math.min(3, documents.length);
			let analysisReport = `📊 Granola API Debug Report\n`;
			analysisReport += `Total documents: ${documents.length}\n`;
			analysisReport += `Analyzing first ${samplesToAnalyze} documents:\n\n`;

			let docsWithNotes = 0;
			let docsWithPlain = 0;
			let docsWithMarkdown = 0;
			let docsWithAnyContent = 0;

			// Detailed analysis of sample documents
			for (let i = 0; i < samplesToAnalyze; i++) {
				const doc = documents[i];
				analysisReport += `--- Document ${i + 1}: "${doc.title}" ---\n`;
				analysisReport += `ID: ${doc.id}\n`;
				analysisReport += `Created: ${doc.created_at}\n`;

				// Check content fields
				const hasNotes = doc.notes && doc.notes.content && doc.notes.content.length > 0;
				const hasPlain = doc.notes_plain && doc.notes_plain.trim().length > 0;
				const hasMarkdown = doc.notes_markdown && doc.notes_markdown.trim().length > 0;

				analysisReport += `Notes (ProseMirror): ${hasNotes ? '✅' : '❌'}\n`;
				if (hasNotes && doc.notes?.content) {
					analysisReport += `  - Nodes: ${doc.notes.content.length}\n`;
				}

				analysisReport += `Notes Plain: ${hasPlain ? '✅' : '❌'}\n`;
				if (hasPlain) {
					analysisReport += `  - Length: ${doc.notes_plain.length} chars\n`;
				}

				analysisReport += `Notes Markdown: ${hasMarkdown ? '✅' : '❌'}\n`;
				if (hasMarkdown) {
					analysisReport += `  - Length: ${doc.notes_markdown.length} chars\n`;
				}

				const hasAnyContent = hasNotes || hasPlain || hasMarkdown;
				analysisReport += `Overall Status: ${hasAnyContent ? '✅ HAS CONTENT' : '❌ NO CONTENT'}\n\n`;
			}

			// Overall statistics
			documents.forEach(doc => {
				if (doc.notes && doc.notes.content && doc.notes.content.length > 0) docsWithNotes++;
				if (doc.notes_plain && doc.notes_plain.trim().length > 0) docsWithPlain++;
				if (doc.notes_markdown && doc.notes_markdown.trim().length > 0) docsWithMarkdown++;

				const hasContent =
					(doc.notes && doc.notes.content && doc.notes.content.length > 0) ||
					(doc.notes_plain && doc.notes_plain.trim().length > 0) ||
					(doc.notes_markdown && doc.notes_markdown.trim().length > 0);
				if (hasContent) docsWithAnyContent++;
			});

			analysisReport += `📈 Overall Statistics:\n`;
			analysisReport += `Documents with ProseMirror: ${docsWithNotes}/${documents.length} (${((docsWithNotes / documents.length) * 100).toFixed(1)}%)\n`;
			analysisReport += `Documents with Plain Text: ${docsWithPlain}/${documents.length} (${((docsWithPlain / documents.length) * 100).toFixed(1)}%)\n`;
			analysisReport += `Documents with Markdown: ${docsWithMarkdown}/${documents.length} (${((docsWithMarkdown / documents.length) * 100).toFixed(1)}%)\n`;
			analysisReport += `Documents with ANY content: ${docsWithAnyContent}/${documents.length} (${((docsWithAnyContent / documents.length) * 100).toFixed(1)}%)\n\n`;

			// Diagnosis
			analysisReport += `🎯 Diagnosis:\n`;
			if (docsWithAnyContent === 0) {
				analysisReport += `❗ CRITICAL: No documents have content!\n`;
				analysisReport += `This explains empty imports. Possible causes:\n`;
				analysisReport += `- API credentials lack content access\n`;
				analysisReport += `- Granola API format changed\n`;
				analysisReport += `- Documents genuinely empty\n`;
			} else if (docsWithNotes === 0 && docsWithMarkdown > 0) {
				analysisReport += `💡 ProseMirror missing, markdown available\n`;
				analysisReport += `Issue likely in ProseMirror validation\n`;
			} else if (docsWithNotes > 0) {
				analysisReport += `💡 ProseMirror exists - conversion issue\n`;
			}

			// Test conversion on first document with content
			const testDoc = documents.find(
				doc =>
					(doc.notes && doc.notes.content && doc.notes.content.length > 0) ||
					(doc.notes_plain && doc.notes_plain.trim().length > 0) ||
					(doc.notes_markdown && doc.notes_markdown.trim().length > 0)
			);

			if (testDoc) {
				analysisReport += `\n🧪 Testing Conversion:\n`;
				try {
					const converted = this.converter.convertDocument(testDoc);
					analysisReport += `✅ Conversion successful\n`;
					analysisReport += `Filename: ${converted.filename}\n`;
					analysisReport += `Content length: ${converted.content.length} chars\n`;

					// Check if date-prefix filename is working
					if (converted.filename.match(/^\d{4}-\d{2}-\d{2} - /)) {
						analysisReport += `✅ Date-prefixed filename working\n`;
					} else {
						analysisReport += `⚠️ Date-prefixed filename not applied\n`;
					}
				} catch (conversionError) {
					analysisReport += `❌ Conversion failed: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}\n`;
				}
			}

			this.logger.info('Debug analysis complete');
			console.log(analysisReport);
			new Notice('✅ Debug analysis complete - check console for full report', 5000);
		} catch (error) {
			debugNotice.hide();
			this.logger.error('Debug API Response Error:', error);

			let errorMessage = 'Debug analysis failed: ';
			if (error instanceof Error) {
				const message = error.message.toLowerCase();
				if (message.includes('credentials') || message.includes('unauthorized')) {
					errorMessage += 'Credentials issue - check Granola app login';
				} else if (message.includes('network') || message.includes('fetch')) {
					errorMessage += 'Network issue - check internet connection';
				} else {
					errorMessage += error.message;
				}
			} else {
				errorMessage += 'Unknown error';
			}

			new Notice(errorMessage, 8000);
		}
	}

	/**
	 * Opens the document selection modal for selective import.
	 *
	 * This method replaces the previous immediate import functionality with
	 * a user-friendly modal interface that allows users to:
	 * 1. Preview available Granola documents
	 * 2. See import status (new, existing, updated, conflicts)
	 * 3. Select which documents to import
	 * 4. Monitor import progress in real-time
	 * 5. Handle conflicts and duplicates intelligently
	 *
	 * The modal integrates all selective import services to provide a
	 * comprehensive import experience with full user control.
	 *
	 * @returns {void}
	 *
	 * @example
	 * ```typescript
	 * // Typically called via Command Palette: "Import Granola Notes (Selective)"
	 * plugin.openImportModal();
	 * ```
	 *
	 * @see {@link DocumentSelectionModal} For the modal implementation
	 * @see {@link DuplicateDetector} For duplicate detection logic
	 * @see {@link SelectiveImportManager} For import coordination
	 */
	openImportModal(): void {
		try {
			const modal = new DocumentSelectionModal(
				this.app,
				this.api,
				this.duplicateDetector,
				this.metadataService,
				this.importManager,
				this.converter
			);
			modal.open();
		} catch (error) {
			this.logger.error('Failed to open import modal:', error);

			// Provide user feedback for modal errors
			let userMessage = 'Failed to open import dialog: ';
			if (error instanceof Error) {
				const message = error.message.toLowerCase();
				if (
					message.includes('credentials') ||
					message.includes('unauthorized') ||
					message.includes('invalid token')
				) {
					userMessage += ERROR_MESSAGES.CREDENTIALS;
				} else if (
					message.includes('network') ||
					message.includes('fetch') ||
					message.includes('connection')
				) {
					userMessage += ERROR_MESSAGES.NETWORK;
				} else {
					userMessage += error.message;
				}
			} else {
				userMessage += ERROR_MESSAGES.UNKNOWN;
			}

			new Notice(userMessage, 8000);
		}
	}

	/**
	 * Loads plugin settings from disk, using defaults if none exist.
	 *
	 * @async
	 * @returns {Promise<void>} Resolves when settings are loaded
	 */
	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * Saves current plugin settings to disk.
	 *
	 * @async
	 * @returns {Promise<void>} Resolves when settings are saved
	 */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		// Update converter settings if it exists
		if (this.converter) {
			this.converter.updateSettings(this.settings);
		}
	}
}
