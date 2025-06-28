import { Plugin, Notice, TFile } from 'obsidian';
import { GranolaAuth } from './src/auth';
import { GranolaAPI } from './src/api';
import { ProseMirrorConverter } from './src/converter';

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
 * @author Claude AI Assistant
 * @version 1.0.0
 * @since 1.0.0
 */
export default class GranolaImporterPlugin extends Plugin {
	/**
	 * Authentication manager for Granola API credentials.
	 * Handles loading, validation, and token management.
	 * @private
	 */
	private auth!: GranolaAuth;

	/**
	 * API client for communicating with Granola's REST API.
	 * Provides methods for fetching documents and handling rate limiting.
	 * @private
	 */
	private api!: GranolaAPI;

	/**
	 * Document converter for transforming ProseMirror JSON to Markdown.
	 * Handles complex node types, formatting, and frontmatter generation.
	 * @private
	 */
	private converter!: ProseMirrorConverter;

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
		console.log('Loading Granola Importer Plugin');

		// Initialize core components
		this.auth = new GranolaAuth();
		this.api = new GranolaAPI(this.auth);
		this.converter = new ProseMirrorConverter();

		// Register command in Obsidian's command palette
		this.addCommand({
			id: 'import-granola-notes',
			name: 'Import Granola Notes',
			callback: () => {
				this.importGranolaNotes();
			},
		});
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
		console.log('Unloading Granola Importer Plugin');
	}

	/**
	 * Imports all documents from the user's Granola account into Obsidian.
	 *
	 * This method orchestrates the complete import process:
	 * 1. Loads and validates Granola credentials
	 * 2. Fetches all documents from the Granola API
	 * 3. Converts ProseMirror JSON to Markdown format
	 * 4. Creates or updates files in the Obsidian vault
	 * 5. Provides real-time progress feedback to the user
	 * 6. Handles errors gracefully with categorized error messages
	 *
	 * @async
	 * @returns {Promise<void>} Resolves when import process completes
	 * @throws {Error} Various error types for different failure scenarios:
	 *   - Credential errors: Invalid or expired authentication
	 *   - Network errors: Connection or API failures
	 *   - Rate limit errors: Too many requests to Granola API
	 *   - Vault errors: File system or permission issues
	 *
	 * @example
	 * ```typescript
	 * // Typically called via Command Palette
	 * await plugin.importGranolaNotes();
	 * ```
	 *
	 * @see {@link GranolaAuth.loadCredentials} For credential loading
	 * @see {@link GranolaAPI.getAllDocuments} For document fetching
	 * @see {@link ProseMirrorConverter.convertDocument} For content conversion
	 */
	async importGranolaNotes(): Promise<void> {
		const notice = new Notice('Starting Granola import...', 0);

		try {
			// Load credentials
			notice.setMessage('Loading Granola credentials...');
			await this.auth.loadCredentials();

			// Fetch documents
			notice.setMessage('Fetching documents from Granola...');
			const documents = await this.api.getAllDocuments();

			// Validate documents
			if (!documents || documents.length === 0) {
				notice.hide();
				new Notice('No documents found in Granola account', 5000);
				return;
			}

			notice.setMessage(`Converting ${documents.length} documents...`);

			// Track progress and errors
			let successCount = 0;
			let errorCount = 0;
			const errors: string[] = [];

			// Convert and save documents with enhanced progress reporting
			for (let i = 0; i < documents.length; i++) {
				const doc = documents[i];
				const percentage = Math.round(((i + 1) / documents.length) * 100);
				notice.setMessage(
					`Converting ${i + 1}/${documents.length} (${percentage}%): ${doc.title || 'Untitled'}`
				);

				try {
					const convertedNote = this.converter.convertDocument(doc);

					// Check if file already exists
					const existingFile = this.app.vault.getAbstractFileByPath(
						convertedNote.filename
					);
					if (existingFile instanceof TFile) {
						await this.app.vault.modify(existingFile, convertedNote.content);
					} else {
						await this.app.vault.create(convertedNote.filename, convertedNote.content);
					}

					successCount++;
				} catch (docError) {
					errorCount++;
					const errorMsg = docError instanceof Error ? docError.message : 'Unknown error';
					errors.push(`${doc.title || 'Untitled'}: ${errorMsg}`);
					console.warn(`Failed to convert document ${doc.title}:`, docError);
				}
			}

			notice.hide();

			// Enhanced completion message
			if (errorCount === 0) {
				new Notice(`Successfully imported ${successCount} notes from Granola! 🎉`, 5000);
			} else {
				new Notice(
					`Import complete: ${successCount} succeeded, ${errorCount} failed. Check console for details.`,
					8000
				);
				if (errors.length > 0) {
					console.error('Import errors:', errors);
				}
			}
		} catch (error) {
			notice.hide();
			console.error('Granola import failed:', error);

			// Enhanced error categorization
			let userMessage = 'Import failed: ';
			if (error instanceof Error) {
				const message = error.message.toLowerCase();
				if (
					message.includes('credentials') ||
					message.includes('unauthorized') ||
					message.includes('invalid token')
				) {
					userMessage +=
						'Please check your Granola credentials and ensure the app is properly logged in.';
				} else if (
					message.includes('network') ||
					message.includes('fetch') ||
					message.includes('connection')
				) {
					userMessage +=
						'Network error - please check your internet connection and try again.';
				} else if (message.includes('rate limit') || message.includes('429')) {
					userMessage += 'Rate limit exceeded - please wait a moment and try again.';
				} else if (message.includes('vault') || message.includes('file')) {
					userMessage +=
						'File system error - check vault permissions and available disk space.';
				} else {
					userMessage += error.message;
				}
			} else {
				userMessage += 'Unknown error occurred. Check console for details.';
			}

			new Notice(userMessage, 10000);
		}
	}
}
