import { jest } from '@jest/globals';
import {
	AutoImportScheduler,
	AUTO_IMPORT_ENABLED_KEY,
	AUTO_IMPORT_LAST_RUN_KEY,
} from '../../src/services/auto-import-scheduler';
import { DuplicateCheckResult } from '../../src/services/duplicate-detector';
import { DocumentMetadataService } from '../../src/services/document-metadata';
import { DEFAULT_SETTINGS, GranolaSettings, Logger } from '../../src/types';
import type { GranolaDocument } from '../../src/api';
import type { DocumentProgress, ImportProgress } from '../../src/services/import-manager';

const mockNoticeMessages: string[] = [];
jest.mock('obsidian', () => {
	const actual = jest.requireActual('../__mocks__/obsidian') as Record<string, unknown>;
	return {
		...actual,
		Notice: class {
			constructor(message: string, _timeout?: number) {
				mockNoticeMessages.push(message);
			}
		},
	};
});

function makeDocument(overrides: Partial<GranolaDocument> = {}): GranolaDocument {
	const id = overrides.id ?? 'doc-1';
	return {
		id,
		title: `Title ${id}`,
		notes: {
			type: 'doc',
			content: [
				{ type: 'paragraph', content: [{ type: 'text', text: `Content for ${id}` }] },
			],
		},
		notes_plain: `Content for ${id}`,
		notes_markdown: `Content for ${id}`,
		created_at: '2026-08-09T15:00:00.000Z',
		updated_at: '2026-08-09T16:00:00.000Z',
		user_id: 'user-1',
		...overrides,
	} as GranolaDocument;
}

function makeEmptyDocument(id: string): GranolaDocument {
	return makeDocument({
		id,
		notes: { type: 'doc', content: [] },
		notes_plain: '',
		notes_markdown: '',
	});
}

function status(
	s: DuplicateCheckResult['status'],
	requiresUserChoice = false
): DuplicateCheckResult {
	return { status: s, reason: 'test', requiresUserChoice };
}

function makeProgress(overrides: Partial<ImportProgress> = {}): ImportProgress {
	return {
		total: 0,
		completed: 0,
		failed: 0,
		skipped: 0,
		empty: 0,
		percentage: 100,
		message: '',
		isRunning: false,
		isCancelled: false,
		startTime: 0,
		...overrides,
	};
}

interface Harness {
	scheduler: AutoImportScheduler;
	localStore: Map<string, unknown>;
	api: { loadCredentials: jest.Mock; getAllDocuments: jest.Mock };
	detector: { refresh: jest.Mock; checkDocuments: jest.Mock };
	importManager: {
		importDocuments: jest.Mock;
		getProgress: jest.Mock;
		getAllDocumentProgress: jest.Mock;
		getFailedDocuments: jest.Mock;
	};
	importLog: { append: jest.Mock };
	setNow: (isoLocal: string) => void;
	settings: GranolaSettings;
}

function createHarness(options?: {
	documents?: GranolaDocument[];
	statuses?: Map<string, DuplicateCheckResult>;
	settings?: GranolaSettings;
}): Harness {
	const localStore = new Map<string, unknown>();
	const app = {
		loadLocalStorage: (key: string) => (localStore.has(key) ? localStore.get(key) : null),
		saveLocalStorage: jest.fn((key: string, value: unknown) => {
			if (value === null) {
				localStore.delete(key);
			} else {
				localStore.set(key, value);
			}
		}),
	};

	const documents = options?.documents ?? [];
	const statuses = options?.statuses ?? new Map<string, DuplicateCheckResult>();
	const settings: GranolaSettings = options?.settings ?? {
		...DEFAULT_SETTINGS,
		import: { ...DEFAULT_SETTINGS.import },
	};

	const api = {
		loadCredentials: jest.fn(async () => undefined),
		getAllDocuments: jest.fn(async () => documents),
	};
	const detector = {
		refresh: jest.fn(async () => undefined),
		checkDocuments: jest.fn(async () => statuses),
	};
	const importManager = {
		importDocuments: jest.fn(async (meta: { id: string }[]) => {
			currentDocumentProgress = meta.map(m => ({
				id: m.id,
				status: 'completed' as const,
				progress: 100,
				message: 'done',
			}));
			return makeProgress({ total: meta.length, completed: meta.length });
		}),
		getProgress: jest.fn(() => makeProgress()),
		getAllDocumentProgress: jest.fn((): DocumentProgress[] => currentDocumentProgress),
		getFailedDocuments: jest.fn(() => []),
	};
	let currentDocumentProgress: DocumentProgress[] = [];
	const importLog = { append: jest.fn(async () => undefined) };

	let now = new Date('2026-08-10T10:00:00');
	const scheduler = new AutoImportScheduler({
		app: app as never,
		api: api as never,
		duplicateDetector: detector as never,
		metadataService: new DocumentMetadataService(settings),
		importManager: importManager as never,
		importLog: importLog as never,
		logger: new Logger(settings),
		settings,
		now: () => now,
	});

	return {
		scheduler,
		localStore,
		api,
		detector,
		importManager,
		importLog,
		setNow: (isoLocal: string) => {
			now = new Date(isoLocal);
		},
		settings,
	};
}

beforeEach(() => {
	mockNoticeMessages.length = 0;
});

describe('AutoImportScheduler enable switch', () => {
	it('is disabled by default', () => {
		const h = createHarness();
		expect(h.scheduler.isEnabled()).toBe(false);
	});

	it('persists the enable flag device-locally', () => {
		const h = createHarness();
		h.scheduler.setEnabled(true);
		expect(h.localStore.get(AUTO_IMPORT_ENABLED_KEY)).toBe(true);
		expect(h.scheduler.isEnabled()).toBe(true);

		h.scheduler.setEnabled(false);
		expect(h.scheduler.isEnabled()).toBe(false);
	});
});

describe('AutoImportScheduler tick gating', () => {
	it('does nothing when disabled', async () => {
		const h = createHarness({ documents: [makeDocument()] });
		await h.scheduler.tick();
		expect(h.api.getAllDocuments).not.toHaveBeenCalled();
	});

	it('does not run before 8am local time', async () => {
		const h = createHarness({ documents: [makeDocument()] });
		h.scheduler.setEnabled(true);
		h.setNow('2026-08-10T07:59:00');
		await h.scheduler.tick();
		expect(h.api.getAllDocuments).not.toHaveBeenCalled();
	});

	it('does not run at or after 7pm local time', async () => {
		const h = createHarness({ documents: [makeDocument()] });
		h.scheduler.setEnabled(true);
		h.setNow('2026-08-10T19:00:00');
		await h.scheduler.tick();
		expect(h.api.getAllDocuments).not.toHaveBeenCalled();
	});

	it('runs on the first tick inside the window (startup catch-up)', async () => {
		const h = createHarness({
			documents: [makeDocument()],
			statuses: new Map([['doc-1', status('NEW')]]),
		});
		h.scheduler.setEnabled(true);
		h.setNow('2026-08-10T10:00:00');
		await h.scheduler.tick();
		expect(h.importManager.importDocuments).toHaveBeenCalledTimes(1);
	});

	it('does not run again until an hour has passed', async () => {
		const h = createHarness({
			documents: [makeDocument()],
			statuses: new Map([['doc-1', status('NEW')]]),
		});
		h.scheduler.setEnabled(true);
		h.setNow('2026-08-10T10:00:00');
		await h.scheduler.tick();
		h.setNow('2026-08-10T10:30:00');
		await h.scheduler.tick();
		expect(h.importManager.importDocuments).toHaveBeenCalledTimes(1);

		h.setNow('2026-08-10T11:01:00');
		await h.scheduler.tick();
		expect(h.importManager.importDocuments).toHaveBeenCalledTimes(2);
	});

	it('persists the last run time device-locally', async () => {
		const h = createHarness({
			documents: [makeDocument()],
			statuses: new Map([['doc-1', status('NEW')]]),
		});
		h.scheduler.setEnabled(true);
		h.setNow('2026-08-10T10:00:00');
		await h.scheduler.tick();
		expect(h.localStore.get(AUTO_IMPORT_LAST_RUN_KEY)).toBe(
			new Date('2026-08-10T10:00:00').getTime()
		);
	});

	it('respects a last run time persisted by an earlier session', async () => {
		const h = createHarness({
			documents: [makeDocument()],
			statuses: new Map([['doc-1', status('NEW')]]),
		});
		h.scheduler.setEnabled(true);
		h.localStore.set(AUTO_IMPORT_LAST_RUN_KEY, new Date('2026-08-10T09:30:00').getTime());
		h.setNow('2026-08-10T10:00:00');
		await h.scheduler.tick();
		expect(h.importManager.importDocuments).not.toHaveBeenCalled();
	});

	it('skips quietly while a manual import is running, without consuming the slot', async () => {
		const h = createHarness({
			documents: [makeDocument()],
			statuses: new Map([['doc-1', status('NEW')]]),
		});
		h.scheduler.setEnabled(true);
		h.importManager.getProgress.mockReturnValueOnce(makeProgress({ isRunning: true }));
		h.setNow('2026-08-10T10:00:00');
		await h.scheduler.tick();
		expect(h.importManager.importDocuments).not.toHaveBeenCalled();
		expect(h.localStore.has(AUTO_IMPORT_LAST_RUN_KEY)).toBe(false);
		expect(mockNoticeMessages).toHaveLength(0);

		await h.scheduler.tick();
		expect(h.importManager.importDocuments).toHaveBeenCalledTimes(1);
	});
});

describe('AutoImportScheduler configurable window', () => {
	function windowSettings(startHour: number, endHour: number): GranolaSettings {
		return {
			...DEFAULT_SETTINGS,
			import: { ...DEFAULT_SETTINGS.import },
			autoImport: { startHour, endHour },
		};
	}

	it('honors a custom daytime window from settings', async () => {
		const h = createHarness({
			documents: [makeDocument({ id: 'new-1' })],
			statuses: new Map([['new-1', status('NEW')]]),
			settings: windowSettings(6, 22),
		});
		h.scheduler.setEnabled(true);

		h.setNow('2026-08-10T06:30:00');
		await h.scheduler.tick();
		expect(h.importManager.importDocuments).toHaveBeenCalledTimes(1);

		h.setNow('2026-08-10T22:00:00');
		await h.scheduler.tick();
		expect(h.importManager.importDocuments).toHaveBeenCalledTimes(1);
	});

	it('falls back to the default window when configured hours are invalid', async () => {
		const h = createHarness({
			documents: [makeDocument({ id: 'new-1' })],
			statuses: new Map([['new-1', status('NEW')]]),
			settings: windowSettings(20, 8),
		});
		h.scheduler.setEnabled(true);

		h.setNow('2026-08-10T20:30:00');
		await h.scheduler.tick();
		expect(h.importManager.importDocuments).not.toHaveBeenCalled();

		h.setNow('2026-08-11T10:00:00');
		await h.scheduler.tick();
		expect(h.importManager.importDocuments).toHaveBeenCalledTimes(1);
	});

	it('applies updated settings without recreating the scheduler', async () => {
		const h = createHarness({
			documents: [makeDocument({ id: 'new-1' })],
			statuses: new Map([['new-1', status('NEW')]]),
		});
		h.scheduler.setEnabled(true);

		h.setNow('2026-08-10T07:00:00');
		await h.scheduler.tick();
		expect(h.importManager.importDocuments).not.toHaveBeenCalled();

		h.scheduler.updateSettings(windowSettings(6, 19));
		await h.scheduler.tick();
		expect(h.importManager.importDocuments).toHaveBeenCalledTimes(1);
	});
});

describe('AutoImportScheduler document selection', () => {
	async function runWith(
		documents: GranolaDocument[],
		statuses: Map<string, DuplicateCheckResult>,
		settings?: GranolaSettings
	): Promise<Harness> {
		const h = createHarness({ documents, statuses, settings });
		h.scheduler.setEnabled(true);
		h.setNow('2026-08-10T10:00:00');
		await h.scheduler.tick();
		return h;
	}

	it('imports only NEW documents, never EXISTS, UPDATED, or CONFLICT', async () => {
		const docs = [
			makeDocument({ id: 'new-1' }),
			makeDocument({ id: 'exists-1' }),
			makeDocument({ id: 'updated-1' }),
			makeDocument({ id: 'conflict-1' }),
		];
		const h = await runWith(
			docs,
			new Map([
				['new-1', status('NEW')],
				['exists-1', status('EXISTS')],
				['updated-1', status('UPDATED')],
				['conflict-1', status('CONFLICT', true)],
			])
		);

		expect(h.importManager.importDocuments).toHaveBeenCalledTimes(1);
		const [meta, granolaDocs] = h.importManager.importDocuments.mock.calls[0] as [
			{ id: string }[],
			GranolaDocument[],
		];
		expect(granolaDocs.map(d => d.id)).toEqual(['new-1']);
		expect(meta.map(m => m.id)).toEqual(['new-1']);
	});

	it('runs the import headlessly with the skip strategy', async () => {
		const h = await runWith(
			[makeDocument({ id: 'new-1' })],
			new Map([['new-1', status('NEW')]])
		);
		const [, , options] = h.importManager.importDocuments.mock.calls[0] as [
			unknown,
			unknown,
			{ strategy: string; stopOnError: boolean },
		];
		expect(options.strategy).toBe('skip');
		expect(options.stopOnError).toBe(false);
	});

	it('never imports empty documents, even when skipEmptyDocuments is off', async () => {
		const settings: GranolaSettings = {
			...DEFAULT_SETTINGS,
			import: { ...DEFAULT_SETTINGS.import, skipEmptyDocuments: false },
		};
		const h = await runWith(
			[makeEmptyDocument('empty-1'), makeDocument({ id: 'new-1' })],
			new Map([
				['empty-1', status('NEW')],
				['new-1', status('NEW')],
			]),
			settings
		);

		const [, granolaDocs] = h.importManager.importDocuments.mock.calls[0] as [
			unknown,
			GranolaDocument[],
		];
		expect(granolaDocs.map(d => d.id)).toEqual(['new-1']);
	});

	function importedIds(h: Harness): string[] {
		if (h.importManager.importDocuments.mock.calls.length === 0) {
			return [];
		}
		const [, granolaDocs] = h.importManager.importDocuments.mock.calls[0] as [
			unknown,
			GranolaDocument[],
		];
		return granolaDocs.map(d => d.id);
	}

	function meetingAt(id: string, localTime: string, hasSummary: boolean): GranolaDocument {
		const iso = new Date(localTime).toISOString();
		return makeDocument({ id, created_at: iso, updated_at: iso, has_summary: hasSummary });
	}

	it('waits for the summary of a meeting from the last three hours', async () => {
		const h = await runWith(
			[meetingAt('in-progress', '2026-08-10T09:45:00', false)],
			new Map([['in-progress', status('NEW')]])
		);
		expect(importedIds(h)).toEqual([]);
	});

	it('imports a recent meeting once Granola has written its summary', async () => {
		const h = await runWith(
			[meetingAt('summarized', '2026-08-10T09:45:00', true)],
			new Map([['summarized', status('NEW')]])
		);
		expect(importedIds(h)).toEqual(['summarized']);
	});

	it('imports a meeting without a summary once it is three hours old', async () => {
		const h = await runWith(
			[
				meetingAt('three-hours', '2026-08-10T07:00:00', false),
				meetingAt('two-and-a-half', '2026-08-10T07:30:00', false),
			],
			new Map([
				['three-hours', status('NEW')],
				['two-and-a-half', status('NEW')],
			])
		);
		expect(importedIds(h)).toEqual(['three-hours']);
	});

	it('imports a summarized meeting whose date did not parse', async () => {
		// parseGranolaDate falls back to the current time for dates like "... BST"
		const h = await runWith(
			[meetingAt('unparsed-date', '2026-08-10T10:00:00', true)],
			new Map([['unparsed-date', status('NEW')]])
		);
		expect(importedIds(h)).toEqual(['unparsed-date']);
	});

	it('refreshes the duplicate detector before checking documents', async () => {
		const h = await runWith(
			[makeDocument({ id: 'new-1' })],
			new Map([['new-1', status('NEW')]])
		);
		expect(h.detector.refresh).toHaveBeenCalledTimes(1);
		const refreshOrder = h.detector.refresh.mock.invocationCallOrder[0];
		const checkOrder = h.detector.checkDocuments.mock.invocationCallOrder[0];
		expect(refreshOrder).toBeLessThan(checkOrder);
	});

	it('does not call the import manager when nothing is new', async () => {
		const h = await runWith(
			[makeDocument({ id: 'exists-1' })],
			new Map([['exists-1', status('EXISTS')]])
		);
		expect(h.importManager.importDocuments).not.toHaveBeenCalled();
		expect(h.importLog.append).not.toHaveBeenCalled();
		expect(mockNoticeMessages).toHaveLength(0);
	});
});

describe('AutoImportScheduler logging and notifications', () => {
	it('logs imported notes to the import log and shows no success notice', async () => {
		const h = createHarness({
			documents: [makeDocument({ id: 'new-1', title: 'Weekly sync' })],
			statuses: new Map([['new-1', status('NEW')]]),
		});
		h.scheduler.setEnabled(true);
		h.setNow('2026-08-10T10:00:00');
		await h.scheduler.tick();

		expect(h.importLog.append).toHaveBeenCalledTimes(1);
		const [lines] = h.importLog.append.mock.calls[0] as [string[]];
		expect(lines.join('\n')).toContain('Weekly sync');
		expect(mockNoticeMessages).toHaveLength(0);
	});

	it('shows an error notice and logs when the run fails', async () => {
		const h = createHarness({ documents: [makeDocument()] });
		h.scheduler.setEnabled(true);
		h.api.getAllDocuments.mockRejectedValueOnce(new Error('Granola API unreachable'));
		h.setNow('2026-08-10T10:00:00');
		await h.scheduler.tick();

		expect(mockNoticeMessages).toHaveLength(1);
		expect(mockNoticeMessages[0]).toMatch(/auto-import/i);
		expect(mockNoticeMessages[0]).toContain('Granola API unreachable');
		expect(h.importLog.append).toHaveBeenCalled();
		const [lines] = h.importLog.append.mock.calls[0] as [string[]];
		expect(lines.join('\n')).toContain('Granola API unreachable');
	});

	it('does not repeat the notice on consecutive failures', async () => {
		const h = createHarness({ documents: [makeDocument()] });
		h.scheduler.setEnabled(true);
		h.api.getAllDocuments.mockRejectedValue(new Error('still broken'));

		h.setNow('2026-08-10T10:00:00');
		await h.scheduler.tick();
		h.setNow('2026-08-10T11:01:00');
		await h.scheduler.tick();
		h.setNow('2026-08-10T12:02:00');
		await h.scheduler.tick();

		expect(mockNoticeMessages).toHaveLength(1);
		expect(h.importLog.append).toHaveBeenCalledTimes(3);
	});

	it('notices again after a success resets the failure streak', async () => {
		const h = createHarness({
			documents: [makeDocument({ id: 'new-1' })],
			statuses: new Map([['new-1', status('NEW')]]),
		});
		h.scheduler.setEnabled(true);

		h.api.getAllDocuments.mockRejectedValueOnce(new Error('first failure'));
		h.setNow('2026-08-10T10:00:00');
		await h.scheduler.tick();

		h.setNow('2026-08-10T11:01:00');
		await h.scheduler.tick();

		h.api.getAllDocuments.mockRejectedValueOnce(new Error('second failure'));
		h.setNow('2026-08-10T12:02:00');
		await h.scheduler.tick();

		expect(mockNoticeMessages).toHaveLength(2);
	});

	it('treats per-document failures as errors: notices once and logs details', async () => {
		const failingDoc = makeDocument({ id: 'new-1', title: 'Board meeting' });
		const h = createHarness({
			documents: [failingDoc],
			statuses: new Map([['new-1', status('NEW')]]),
		});
		h.importManager.importDocuments.mockImplementation(async () =>
			makeProgress({ total: 1, failed: 1 })
		);
		h.importManager.getAllDocumentProgress.mockReturnValue([]);
		h.importManager.getFailedDocuments.mockReturnValue([
			{
				document: failingDoc,
				error: 'disk full',
				message: 'File system error',
				timestamp: 0,
			},
		]);
		h.scheduler.setEnabled(true);
		h.setNow('2026-08-10T10:00:00');
		await h.scheduler.tick();

		expect(mockNoticeMessages).toHaveLength(1);
		const [lines] = h.importLog.append.mock.calls[0] as [string[]];
		expect(lines.join('\n')).toContain('Board meeting');
		expect(lines.join('\n')).toContain('File system error');
	});
});
