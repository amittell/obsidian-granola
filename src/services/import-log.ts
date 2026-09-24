import { TFile, Vault } from 'obsidian';

/**
 * Static filename for the auto-import log note. Kept stable so the note acts
 * as a living document instead of accumulating dated copies.
 */
export const IMPORT_LOG_FILENAME = 'Granola Import Log.md';

const LOG_HEADER = [
	'# Granola Import Log',
	'',
	'Append-only log of scheduled Granola auto-import runs.',
	'',
].join('\n');

/**
 * Append-only writer for the auto-import log note in the vault.
 *
 * The note lives in the import folder and is created on first use;
 * afterwards entries are only ever appended so user edits above are
 * preserved.
 */
export class ImportLogWriter {
	private vault: Vault;
	private getFolder: () => string;

	/**
	 * @param {Vault} vault - The vault to write to
	 * @param {() => string} [getFolder] - Returns the import folder (empty for the vault root)
	 */
	constructor(vault: Vault, getFolder: () => string = () => '') {
		this.vault = vault;
		this.getFolder = getFolder;
	}

	/**
	 * Appends entry lines to the log note, creating it if necessary.
	 *
	 * @param {string[]} lines - Preformatted log lines (without trailing newline)
	 */
	async append(lines: string[]): Promise<void> {
		if (lines.length === 0) {
			return;
		}

		const data = lines.join('\n') + '\n';
		const folder = this.getFolder().trim().replace(/\/+$/, '');
		const path = folder ? `${folder}/${IMPORT_LOG_FILENAME}` : IMPORT_LOG_FILENAME;
		const existing = this.vault.getAbstractFileByPath(path);

		if (existing instanceof TFile) {
			await this.vault.append(existing, data);
			return;
		}

		if (existing) {
			throw new Error(`${path} exists but is not a file`);
		}

		await this.ensureFolder(folder);
		await this.vault.create(path, LOG_HEADER + data);
	}

	private async ensureFolder(folder: string): Promise<void> {
		let current = '';
		for (const part of folder.split('/').filter(Boolean)) {
			current = current ? `${current}/${part}` : part;
			if (!this.vault.getAbstractFileByPath(current)) {
				await this.vault.createFolder(current);
			}
		}
	}
}
