import { TFile, Vault } from 'obsidian';

/**
 * Static filename for the auto-import log note. Kept stable so the note acts
 * as a living document instead of accumulating dated copies.
 */
export const IMPORT_LOG_FILENAME = 'Granola Import Log.md';

const LOG_HEADER = [
	'---',
	'type: reference',
	'---',
	'',
	'# Granola Import Log',
	'',
	'Append-only log of scheduled Granola auto-import runs.',
	'',
].join('\n');

/**
 * Append-only writer for the auto-import log note in the vault.
 *
 * The note is created on first use with minimal frontmatter; afterwards
 * entries are only ever appended so user edits above are preserved.
 */
export class ImportLogWriter {
	private vault: Vault;

	constructor(vault: Vault) {
		this.vault = vault;
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
		const existing = this.vault.getAbstractFileByPath(IMPORT_LOG_FILENAME);

		if (existing instanceof TFile) {
			await this.vault.append(existing, data);
			return;
		}

		if (existing) {
			throw new Error(`${IMPORT_LOG_FILENAME} exists but is not a file`);
		}

		await this.vault.create(IMPORT_LOG_FILENAME, LOG_HEADER + data);
	}
}
