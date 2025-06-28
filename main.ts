import { Plugin, Notice, TFile } from 'obsidian';
import { GranolaAuth } from './src/auth';
import { GranolaAPI } from './src/api';
import { ProseMirrorConverter } from './src/converter';

export default class GranolaImporterPlugin extends Plugin {
	private auth!: GranolaAuth;
	private api!: GranolaAPI;
	private converter!: ProseMirrorConverter;

	async onload() {
		console.log('Loading Granola Importer Plugin');

		this.auth = new GranolaAuth();
		this.api = new GranolaAPI(this.auth);
		this.converter = new ProseMirrorConverter();

		this.addCommand({
			id: 'import-granola-notes',
			name: 'Import Granola Notes',
			callback: () => {
				this.importGranolaNotes();
			},
		});
	}

	onunload() {
		console.log('Unloading Granola Importer Plugin');
	}

	async importGranolaNotes() {
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
