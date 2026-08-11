import { App, Notice } from 'obsidian';
import { GranolaAPI, GranolaDocument } from '../api';
import { DEFAULT_SETTINGS, GranolaSettings, Logger } from '../types';
import { isEmptyDocument } from '../utils/prosemirror';
import { DuplicateDetector, DuplicateCheckResult } from './duplicate-detector';
import { DocumentMetadataService } from './document-metadata';
import { SelectiveImportManager } from './import-manager';
import { ImportLogWriter, IMPORT_LOG_FILENAME } from './import-log';

/**
 * Device-local storage key for the auto-import enable switch.
 *
 * Stored via Obsidian's localStorage helpers instead of plugin settings on
 * purpose: settings live in data.json inside the vault, which syncs across
 * devices (e.g. via iCloud). A synced enable flag would make two machines
 * poll and import concurrently.
 */
export const AUTO_IMPORT_ENABLED_KEY = 'granola-importer:auto-import-enabled';

/** Device-local storage key for the timestamp of the last auto-import run. */
export const AUTO_IMPORT_LAST_RUN_KEY = 'granola-importer:auto-import-last-run';

/** Minimum time between auto-import runs. */
export const AUTO_IMPORT_INTERVAL_MS = 60 * 60 * 1000;

/** How often the scheduler heartbeat checks whether a run is due. */
export const AUTO_IMPORT_TICK_MS = 60 * 1000;

/**
 * Documents updated more recently than this are deferred to a later poll.
 * Granola fills notes in after a meeting ends, so a very fresh update may
 * still be half-written.
 */
export const RECENT_EDIT_BUFFER_MS = 10 * 60 * 1000;

/**
 * Dependencies for the auto-import scheduler, narrowed to what it uses so
 * tests can provide lightweight fakes.
 */
export interface AutoImportSchedulerDeps {
	app: Pick<App, 'loadLocalStorage' | 'saveLocalStorage'>;
	api: Pick<GranolaAPI, 'loadCredentials' | 'getAllDocuments'>;
	duplicateDetector: Pick<DuplicateDetector, 'refresh' | 'checkDocuments'>;
	metadataService: Pick<DocumentMetadataService, 'extractBulkMetadata'>;
	importManager: Pick<
		SelectiveImportManager,
		'importDocuments' | 'getProgress' | 'getAllDocumentProgress' | 'getFailedDocuments'
	>;
	importLog: Pick<ImportLogWriter, 'append'>;
	logger: Logger;
	/** Plugin settings; the polling window hours are read from here. */
	settings: GranolaSettings;
	/** Clock override for tests; defaults to the system clock. */
	now?: () => Date;
}

/**
 * Opt-in scheduler that imports new Granola notes without user interaction.
 *
 * Design constraints (all deliberate):
 * - Runs hourly inside a configurable local-time window (default
 *   8:00-19:00), while Obsidian is open.
 * - Imports documents classified NEW only; anything that would need a
 *   choice (EXISTS/UPDATED/CONFLICT) is left for a manual import. No
 *   modals are ever opened from a scheduled run.
 * - Empty documents are never imported and are re-evaluated on later polls.
 * - Notifications on errors only, at most once per failure streak; every
 *   run that imports something or fails is appended to the log note.
 * - The enable switch and last-run timestamp are device-local.
 */
export class AutoImportScheduler {
	private deps: AutoImportSchedulerDeps;
	private settings: GranolaSettings;
	private runInFlight = false;
	private failureStreak = 0;

	constructor(deps: AutoImportSchedulerDeps) {
		this.deps = deps;
		this.settings = deps.settings;
	}

	/** Applies updated plugin settings (window hours take effect next tick). */
	updateSettings(settings: GranolaSettings): void {
		this.settings = settings;
	}

	/** Whether auto-import is enabled on this device. */
	isEnabled(): boolean {
		return this.deps.app.loadLocalStorage(AUTO_IMPORT_ENABLED_KEY) === true;
	}

	/** Enables or disables auto-import on this device only. */
	setEnabled(value: boolean): void {
		this.deps.app.saveLocalStorage(AUTO_IMPORT_ENABLED_KEY, value);
	}

	/** Timestamp (ms) of the last run on this device, or 0 if never run. */
	getLastRunTime(): number {
		const raw = this.deps.app.loadLocalStorage(AUTO_IMPORT_LAST_RUN_KEY) as unknown;
		const value = typeof raw === 'number' ? raw : Number(raw);
		return Number.isFinite(value) ? value : 0;
	}

	/**
	 * Heartbeat entry point. Cheap when no run is due; called every minute
	 * and once at startup so a missed slot (laptop asleep, Obsidian closed)
	 * is caught up as soon as possible within the window.
	 */
	async tick(): Promise<void> {
		if (this.runInFlight || !this.isEnabled()) {
			return;
		}

		// A manual import owns the pipeline right now; try again next tick
		// without consuming this hour's slot.
		if (this.deps.importManager.getProgress().isRunning) {
			return;
		}

		const now = this.now();
		if (!this.isWithinWindow(now)) {
			return;
		}

		if (now.getTime() - this.getLastRunTime() < AUTO_IMPORT_INTERVAL_MS) {
			return;
		}

		this.runInFlight = true;
		// Claim the slot before running so a hung or failing run cannot
		// retry more often than the schedule allows.
		this.deps.app.saveLocalStorage(AUTO_IMPORT_LAST_RUN_KEY, now.getTime());

		try {
			const failureSummary = await this.runOnce(now);
			if (failureSummary) {
				this.registerFailure(failureSummary);
			} else {
				this.failureStreak = 0;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			await this.logSafely([`- ${formatTimestamp(now)} ERROR: ${message}`]);
			this.registerFailure(message);
		} finally {
			this.runInFlight = false;
		}
	}

	/**
	 * Executes one headless import run.
	 *
	 * @returns {Promise<string | null>} A failure summary when some documents
	 *   failed to import, or null on full success.
	 */
	private async runOnce(now: Date): Promise<string | null> {
		const deps = this.deps;

		await deps.api.loadCredentials();
		const documents = await deps.api.getAllDocuments();

		// Re-scan the vault immediately before importing: another device may
		// have imported since the last poll (vault syncs, e.g. via iCloud),
		// and fresh duplicate detection is the guard against double imports.
		await deps.duplicateDetector.refresh();
		const statusMap = await deps.duplicateDetector.checkDocuments(documents);

		const candidates = documents.filter(doc =>
			this.isAutoImportable(doc, statusMap.get(doc.id), now)
		);
		if (candidates.length === 0) {
			deps.logger.debug('Auto-import: nothing new to import');
			return null;
		}

		const metadata = deps.metadataService.extractBulkMetadata(candidates, statusMap);
		metadata.forEach(meta => {
			meta.selected = true;
		});

		const progress = await deps.importManager.importDocuments(metadata, candidates, {
			strategy: 'skip',
			stopOnError: false,
		});

		const timestamp = formatTimestamp(now);
		const titleById = new Map(candidates.map(doc => [doc.id, doc.title]));
		const lines: string[] = [];

		for (const docProgress of deps.importManager.getAllDocumentProgress()) {
			if (docProgress.status === 'completed') {
				const title = titleById.get(docProgress.id) ?? docProgress.id;
				lines.push(`- ${timestamp} imported "${title}"`);
			}
		}
		for (const failed of deps.importManager.getFailedDocuments()) {
			lines.push(`- ${timestamp} FAILED "${failed.document.title}": ${failed.message}`);
		}
		await this.logSafely(lines);

		return progress.failed > 0 ? `${progress.failed} document(s) failed to import` : null;
	}

	/** Whether a document qualifies for unattended import. */
	private isAutoImportable(
		doc: GranolaDocument,
		status: DuplicateCheckResult | undefined,
		now: Date
	): boolean {
		if (!status || status.status !== 'NEW' || status.requiresUserChoice) {
			return false;
		}

		if (isEmptyDocument(doc)) {
			return false;
		}

		const updatedAt = new Date(doc.updated_at).getTime();
		if (!isNaN(updatedAt) && now.getTime() - updatedAt < RECENT_EDIT_BUFFER_MS) {
			return false;
		}

		return true;
	}

	private isWithinWindow(now: Date): boolean {
		const { startHour, endHour } = this.getWindow();
		const hour = now.getHours();
		return hour >= startHour && hour < endHour;
	}

	/**
	 * Returns the configured polling window, falling back to the defaults
	 * when the stored values are unusable (e.g. a hand-edited data.json
	 * with start at or after end). Falling back keeps imports flowing
	 * instead of silently never running.
	 */
	private getWindow(): { startHour: number; endHour: number } {
		const configured: Partial<GranolaSettings['autoImport']> = this.settings.autoImport ?? {};
		const { startHour, endHour } = configured;

		if (
			typeof startHour === 'number' &&
			typeof endHour === 'number' &&
			Number.isInteger(startHour) &&
			Number.isInteger(endHour) &&
			startHour >= 0 &&
			startHour <= 23 &&
			endHour >= 1 &&
			endHour <= 24 &&
			startHour < endHour
		) {
			return { startHour, endHour };
		}

		return { ...DEFAULT_SETTINGS.autoImport };
	}

	/**
	 * Records a failed run. The user is notified once per failure streak so
	 * a recurring breakage is visible without an hourly notice storm.
	 */
	private registerFailure(summary: string): void {
		this.failureStreak++;
		this.deps.logger.error(
			`Auto-import failed (${this.failureStreak} run(s) in a row): ${summary}`
		);

		if (this.failureStreak === 1) {
			new Notice(
				`Granola auto-import failed: ${summary}. Retrying hourly; see "${IMPORT_LOG_FILENAME}".`,
				10000
			);
		}
	}

	/** Appends to the log note; a log failure must not abort the run. */
	private async logSafely(lines: string[]): Promise<void> {
		try {
			await this.deps.importLog.append(lines);
		} catch (error) {
			this.deps.logger.error('Auto-import: failed to write import log:', error);
		}
	}

	private now(): Date {
		return this.deps.now ? this.deps.now() : new Date();
	}
}

function formatTimestamp(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
		date.getHours()
	)}:${pad(date.getMinutes())}`;
}
