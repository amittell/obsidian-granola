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

			notice.setMessage(`Converting ${documents.length} documents...`);

			// Convert and save documents
			for (let i = 0; i < documents.length; i++) {
				const doc = documents[i];
				notice.setMessage(`Converting document ${i + 1}/${documents.length}: ${doc.title}`);

				const convertedNote = this.converter.convertDocument(doc);

				// Check if file already exists
				const existingFile = this.app.vault.getAbstractFileByPath(convertedNote.filename);
				if (existingFile instanceof TFile) {
					notice.setMessage(`Updating existing note: ${convertedNote.filename}`);
					await this.app.vault.modify(existingFile, convertedNote.content);
				} else {
					notice.setMessage(`Creating new note: ${convertedNote.filename}`);
					await this.app.vault.create(convertedNote.filename, convertedNote.content);
				}
			}

			notice.hide();
			new Notice(`Successfully imported ${documents.length} notes from Granola!`, 5000);
		} catch (error) {
			notice.hide();
			console.error('Granola import failed:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			new Notice(`Import failed: ${errorMessage}`, 10000);
		}
	}
}
