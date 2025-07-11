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
 * Content priority for document extraction.
 */
export enum ContentPriority {
	/** Try panel content first, fallback to notes */
	PANEL_FIRST = 'panel_first',
	/** Try notes first, fallback to panel */
	NOTES_FIRST = 'notes_first',
	/** Only use panel content */
	PANEL_ONLY = 'panel_only',
	/** Only use notes content */
	NOTES_ONLY = 'notes_only',
}

/**
 * Plugin settings interface with simplified configuration options.
 */
export interface GranolaSettings {
	/** Debug and logging settings */
	debug: {
		/** Enable debug logging */
		enabled: boolean;
		/** Log level threshold */
		logLevel: LogLevel;
	};

	/** Import behavior settings */
	import: {
		/** Default strategy for handling duplicates */
		strategy: ImportStrategy;
		/** Default vault folder for imports */
		defaultFolder: string;
		/** Skip empty documents during import */
		skipEmptyDocuments: boolean;
		/** Maximum filename length */
		maxFilenameLength: number;
	};

	/** Filename and content settings */
	content: {
		/** Date prefix format for filenames */
		datePrefixFormat: DatePrefixFormat;
		/** Include enhanced frontmatter fields (id, title, updated) */
		includeEnhancedFrontmatter: boolean;
		/** Content extraction priority */
		contentPriority: ContentPriority;
	};

	/** Action items conversion settings */
	actionItems: {
		/** Convert action items bullet points to markdown task format */
		convertToTasks: boolean;
		/** Add a tag to notes containing converted tasks */
		addTaskTag: boolean;
		/** Tag name to add (including #) */
		taskTagName: string;
	};

	/** UI settings */
	ui: {
		/** Show import progress notifications */
		showProgressNotifications: boolean;
	};

	/** Internal connection state (not user-facing) */
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
	},
	import: {
		strategy: ImportStrategy.ALWAYS_PROMPT,
		defaultFolder: '',
		skipEmptyDocuments: true,
		maxFilenameLength: 100,
	},
	content: {
		datePrefixFormat: DatePrefixFormat.ISO_DATE,
		includeEnhancedFrontmatter: false,
		contentPriority: ContentPriority.PANEL_FIRST,
	},
	actionItems: {
		convertToTasks: false,
		addTaskTag: false,
		taskTagName: '#tasks',
	},
	ui: {
		showProgressNotifications: true,
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
