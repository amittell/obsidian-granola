import { jest } from '@jest/globals';
import { TFile, TFolder } from 'obsidian';
import { ImportLogWriter, IMPORT_LOG_FILENAME } from '../../src/services/import-log';

interface FakeVault {
	getAbstractFileByPath: jest.Mock;
	create: jest.Mock;
	append: jest.Mock;
}

function createFakeVault(existingFile: unknown = null): FakeVault {
	return {
		getAbstractFileByPath: jest.fn().mockReturnValue(existingFile),
		create: jest.fn(async () => new TFile(IMPORT_LOG_FILENAME)),
		append: jest.fn(async () => undefined),
	};
}

describe('ImportLogWriter', () => {
	it('uses a static filename', () => {
		expect(IMPORT_LOG_FILENAME).toBe('Granola Import Log.md');
	});

	it('creates the log note with reference frontmatter when it does not exist', async () => {
		const vault = createFakeVault(null);
		const writer = new ImportLogWriter(vault as never);

		await writer.append(['- 2026-08-10 10:00 imported "Standup"']);

		expect(vault.create).toHaveBeenCalledTimes(1);
		const [path, content] = vault.create.mock.calls[0] as [string, string];
		expect(path).toBe(IMPORT_LOG_FILENAME);
		expect(content).toMatch(/^---\ntype: reference\n---\n/);
		expect(content).toContain('- 2026-08-10 10:00 imported "Standup"');
		expect(vault.append).not.toHaveBeenCalled();
	});

	it('appends to the existing note without rewriting it', async () => {
		const existing = new TFile(IMPORT_LOG_FILENAME);
		const vault = createFakeVault(existing);
		const writer = new ImportLogWriter(vault as never);

		await writer.append(['- line one', '- line two']);

		expect(vault.create).not.toHaveBeenCalled();
		expect(vault.append).toHaveBeenCalledTimes(1);
		const [file, data] = vault.append.mock.calls[0] as [TFile, string];
		expect(file).toBe(existing);
		expect(data).toBe('- line one\n- line two\n');
	});

	it('does nothing for an empty entry list', async () => {
		const vault = createFakeVault(null);
		const writer = new ImportLogWriter(vault as never);

		await writer.append([]);

		expect(vault.create).not.toHaveBeenCalled();
		expect(vault.append).not.toHaveBeenCalled();
	});

	it('throws when the log path is occupied by a folder', async () => {
		const vault = createFakeVault(new TFolder(IMPORT_LOG_FILENAME));
		const writer = new ImportLogWriter(vault as never);

		await expect(writer.append(['- line'])).rejects.toThrow(/not a file/i);
	});
});
