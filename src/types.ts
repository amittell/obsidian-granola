/**
 * Log levels for debug output control.
 */
export enum LogLevel {
	ERROR = 0,
	WARN = 1,
	INFO = 2,
	DEBUG = 3,
}

/**
 * Import strategies for handling duplicate documents.
 */
export enum ImportStrategy {
	/** Skip documents that already exist */
	SKIP_EXISTING = 'skip',
	/** Update existing documents with newer content */
	UPDATE_EXISTING = 'update',
	/** Always prompt user for conflict resolution */
	ALWAYS_PROMPT = 'prompt',
}

/**
 * Date prefix formats for filename generation.
 */
export enum DatePrefixFormat {
	/** YYYY-MM-DD format (ISO standard) */
	ISO_DATE = 'YYYY-MM-DD',
	/** MM-DD-YYYY format (US style) */
	US_DATE = 'MM-DD-YYYY',
	/** DD-MM-YYYY format (European style) */
	EU_DATE = 'DD-MM-YYYY',
	/** YYYY.MM.DD format (dot separated) */
	DOT_DATE = 'YYYY.MM.DD',
	/** No date prefix */
	NONE = 'none',
}

/**
 * Content source priority for extraction.
 */
export enum ContentPriority {
	/** Try last_viewed_panel first, then notes, then fallbacks */
	PANEL_FIRST = 'panel_first',
	/** Try notes first, then last_viewed_panel, then fallbacks */
	NOTES_FIRST = 'notes_first',
	/** Only use last_viewed_panel (most reliable) */
	PANEL_ONLY = 'panel_only',
	/** Only use notes field */
	NOTES_ONLY = 'notes_only',
}

/**
 * Plugin settings interface with all configuration options.
 */
export interface GranolaSettings {
	/** Debug and logging settings */
	debug: {
		/** Enable debug logging */
		enabled: boolean;
		/** Log level threshold */
		logLevel: LogLevel;
		/** Save debug logs to file */
		saveToFile: boolean;
	};

	/** Import behavior settings */
	import: {
		/** Default strategy for handling duplicates */
		strategy: ImportStrategy;
		/** Default vault folder for imports */
		defaultFolder: string;
		/** Create folders if they don't exist */
		createFolders: boolean;
		/** Maximum filename length */
		maxFilenameLength: number;
	};

	/** Filename and content settings */
	content: {
		/** Date prefix format for filenames */
		datePrefixFormat: DatePrefixFormat;
		/** Content source priority */
		contentPriority: ContentPriority;
		/** Include document metadata in frontmatter */
		includeMetadata: boolean;
		/** Include enhanced frontmatter fields (id, title, updated) */
		includeEnhancedFrontmatter: boolean;
		/** Custom frontmatter fields */
		customFrontmatter: string[];
	};

	/** UI and experience settings */
	ui: {
		/** Auto-close import modal after successful import */
		autoCloseModal: boolean;
		/** Show import progress notifications */
		showProgressNotifications: boolean;
		/** Default to select all documents for import */
		selectAllByDefault: boolean;
	};

	/** Connection and API settings */
	connection: {
		/** Last successful connection test timestamp */
		lastValidated: number;
		/** Connection status cache */
		isConnected: boolean;
		/** API request timeout in milliseconds */
		timeoutMs: number;
	};
}

/**
 * Default settings with sensible values.
 */
export const DEFAULT_SETTINGS: GranolaSettings = {
	debug: {
		enabled: false,
		logLevel: LogLevel.WARN,
		saveToFile: false,
	},
	import: {
		strategy: ImportStrategy.ALWAYS_PROMPT,
		defaultFolder: '',
		createFolders: true,
		maxFilenameLength: 100,
	},
	content: {
		datePrefixFormat: DatePrefixFormat.ISO_DATE,
		contentPriority: ContentPriority.PANEL_FIRST,
		includeMetadata: true,
		includeEnhancedFrontmatter: false,
		customFrontmatter: [],
	},
	ui: {
		autoCloseModal: false,
		showProgressNotifications: true,
		selectAllByDefault: false,
	},
	connection: {
		lastValidated: 0,
		isConnected: false,
		timeoutMs: 30000,
	},
};

/**
 * Centralized logger that respects debug settings.
 */
export class Logger {
	private settings: GranolaSettings;

	constructor(settings: GranolaSettings) {
		this.settings = settings;
	}

	/**
	 * Updates the logger settings.
	 */
	updateSettings(settings: GranolaSettings): void {
		this.settings = settings;
	}

	/**
	 * Logs an error message.
	 */
	error(message: string, ...args: unknown[]): void {
		if (this.settings.debug.logLevel >= LogLevel.ERROR) {
			console.error(`[Granola Importer] ${message}`, ...args);
		}
	}

	/**
	 * Logs a warning message.
	 */
	warn(message: string, ...args: unknown[]): void {
		if (this.settings.debug.logLevel >= LogLevel.WARN) {
			console.warn(`[Granola Importer] ${message}`, ...args);
		}
	}

	/**
	 * Logs an info message.
	 */
	info(message: string, ...args: unknown[]): void {
		if (this.settings.debug.logLevel >= LogLevel.INFO) {
			console.info(`[Granola Importer] ${message}`, ...args);
		}
	}

	/**
	 * Logs a debug message.
	 */
	debug(message: string, ...args: unknown[]): void {
		// Show debug messages if debug mode is enabled OR if log level is DEBUG
		if (this.settings.debug.enabled || this.settings.debug.logLevel >= LogLevel.DEBUG) {
			console.log(`[Granola Importer Debug] ${message}`, ...args);
		}
	}
}
