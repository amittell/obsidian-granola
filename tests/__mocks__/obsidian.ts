import { jest } from '@jest/globals';
import { MockHTMLElement } from '../helpers/modal-test-helper';

// Mock stringifyYaml function - converts object to YAML format
export function stringifyYaml(obj: any): string {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(obj)) {
		if (value === null || value === undefined) {
			continue;
		}
		if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) {
				lines.push(`  - ${item}`);
			}
		} else if (typeof value === 'string') {
			// Quote strings that need quoting (URLs, titles, strings with quotes)
			// But don't quote ISO timestamps or simple field values like 'Granola'
			const needsQuotes =
				key === 'title' ||
				value.includes('http') ||
				value.includes('"') ||
				(value.includes(':') && !value.match(/^\d{4}-\d{2}-\d{2}T/));

			if (needsQuotes) {
				// Escape internal quotes
				const escaped = value.replace(/"/g, '\\"');
				lines.push(`${key}: "${escaped}"`);
			} else {
				lines.push(`${key}: ${value}`);
			}
		} else {
			lines.push(`${key}: ${value}`);
		}
	}
	return lines.join('\n');
}

// Mock htmlToMarkdown function
export function htmlToMarkdown(html: string): string {
	return html;
}

// Mock Platform object
export const Platform = {
	isMobile: false,
	isDesktop: true,
	isWin: process.platform === 'win32',
	isMacOS: process.platform === 'darwin',
	isLinux: process.platform === 'linux',
};

export class Plugin {
	app: any;
	manifest: any;

	constructor(app: any, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}

	onload() {}
	onunload() {}
	addCommand(command: any) {}
	addSettingTab(tab: any) {}
	addRibbonIcon(icon: string, title: string, callback: () => void) {
		// Mock implementation - return a mock HTMLElement
		const mockElement = {
			remove: jest.fn(),
		};
		return mockElement;
	}
	loadData() {
		return Promise.resolve({});
	}
	saveData(data: any) {
		return Promise.resolve();
	}
}

export class Modal {
	app: any;
	modalEl: MockHTMLElement;
	contentEl: MockHTMLElement;
	containerEl: MockHTMLElement;

	constructor(app: any) {
		this.app = app;
		this.modalEl = new MockHTMLElement('div');
		this.contentEl = new MockHTMLElement('div');
		this.containerEl = new MockHTMLElement('div');

		// Add modal-specific functionality
		this.modalEl.addClass('modal');
		this.contentEl.addClass('modal-content');
		this.containerEl.addClass('modal-container');
	}

	open() {}
	close() {}
	onOpen() {}
	onClose() {}
}

export class TFile {
	path: string;
	basename: string;
	extension: string;
	name: string;

	constructor(path: string) {
		this.path = path;
		this.name = path.split('/').pop() || '';
		this.basename = this.name.replace(/\.[^/.]+$/, '');
		this.extension = this.name.includes('.') ? this.name.split('.').pop() || '' : '';
	}
}

export class PluginSettingTab {
	app: any;
	plugin: any;
	containerEl: any;

	constructor(app: any, plugin: any) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = {
			empty: jest.fn(),
			createEl: jest.fn(),
			createDiv: jest.fn(),
		};
	}

	display() {}
	hide() {}
}

export class Notice {
	constructor(message: string, timeout?: number) {}
	setMessage(message: string) {}
	hide() {}
}

export class TFolder {
	constructor(public path: string) {}
}

/**
 * Mock file for internal vault operations.
 */
class MockFile {
	path: string;
	content: string;
	stat: { mtime: number; ctime: number; size: number };

	constructor(path: string, content: string = '') {
		this.path = path;
		this.content = content;
		const now = Date.now();
		this.stat = {
			mtime: now,
			ctime: now,
			size: content.length,
		};
	}
}

/**
 * Mock folder for internal vault operations.
 */
class MockFolder {
	path: string;

	constructor(path: string) {
		this.path = path;
	}
}

/**
 * Enhanced vault mock with realistic file operations and state management.
 */
export class MockVault {
	private files: Map<string, MockFile> = new Map();
	private folders: Map<string, MockFolder> = new Map();

	create = jest.fn().mockImplementation(async (path: string, content: string) => {
		const file = new MockFile(path, content);
		this.files.set(path, file);
		return new TFile(path);
	});

	modify = jest.fn().mockImplementation(async (file: TFile, content: string) => {
		const mockFile = this.files.get(file.path);
		if (mockFile) {
			mockFile.content = content;
			mockFile.stat.mtime = Date.now();
		}
	});

	read = jest.fn().mockImplementation(async (file: TFile) => {
		const mockFile = this.files.get(file.path);
		if (!mockFile) {
			throw new Error(`File not found: ${file.path}`);
		}
		return mockFile.content;
	});

	getAbstractFileByPath = jest.fn().mockImplementation((path: string) => {
		if (this.files.has(path)) {
			return new TFile(path);
		}
		if (this.folders.has(path)) {
			return new TFolder(path);
		}
		return null;
	});

	exists = jest.fn().mockImplementation((path: string) => {
		return this.files.has(path) || this.folders.has(path);
	});

	delete = jest.fn().mockImplementation(async (file: TFile) => {
		this.files.delete(file.path);
	});

	rename = jest.fn().mockImplementation(async (file: TFile, newPath: string) => {
		const mockFile = this.files.get(file.path);
		if (mockFile) {
			this.files.delete(file.path);
			mockFile.path = newPath;
			this.files.set(newPath, mockFile);
		}
	});

	getMarkdownFiles = jest.fn().mockImplementation(() => {
		return Array.from(this.files.values())
			.filter(file => file.path.endsWith('.md'))
			.map(file => new TFile(file.path));
	});

	// Test utilities
	addMockFile(path: string, content: string = ''): void {
		this.files.set(path, new MockFile(path, content));
	}

	addMockFolder(path: string): void {
		this.folders.set(path, new MockFolder(path));
	}

	getMockFileContent(path: string): string | undefined {
		return this.files.get(path)?.content;
	}

	getAllMockFiles(): string[] {
		return Array.from(this.files.keys());
	}

	clear(): void {
		this.files.clear();
		this.folders.clear();
	}
}

/**
 * Enhanced workspace mock with realistic tab and leaf management.
 */
export class MockWorkspace {
	private leaves: MockWorkspaceLeaf[] = [];
	private activeLeaf: MockWorkspaceLeaf | null = null;

	getLeaf = jest.fn().mockImplementation((type?: 'tab' | 'split' | 'window') => {
		const leaf = new MockWorkspaceLeaf();
		this.leaves.push(leaf);
		if (!this.activeLeaf) {
			this.activeLeaf = leaf;
		}
		return leaf;
	});

	setActiveLeaf = jest.fn().mockImplementation((leaf: MockWorkspaceLeaf) => {
		this.activeLeaf = leaf;
	});

	getLeavesOfType = jest.fn().mockImplementation((type: string) => {
		return this.leaves.filter(leaf => leaf.view?.getViewType() === type);
	});

	// Test utilities
	addMockLeaf(file?: TFile): MockWorkspaceLeaf {
		const leaf = new MockWorkspaceLeaf();
		if (file) {
			leaf.view = new MockMarkdownView(file);
		}
		this.leaves.push(leaf);
		return leaf;
	}

	getActiveLeaf(): MockWorkspaceLeaf | null {
		return this.activeLeaf;
	}

	getAllLeaves(): MockWorkspaceLeaf[] {
		return [...this.leaves];
	}

	clear(): void {
		this.leaves = [];
		this.activeLeaf = null;
	}
}

/**
 * Mock workspace leaf for testing tab management.
 */
export class MockWorkspaceLeaf {
	view: MockView | null = null;
	containerEl: MockHTMLElement = new MockHTMLElement('div');

	openFile = jest.fn().mockImplementation(async (file: TFile) => {
		this.view = new MockMarkdownView(file);
		return this.view;
	});

	getViewState = jest.fn().mockReturnValue({
		type: 'markdown',
		state: { file: this.view?.file?.path },
	});

	setViewState = jest.fn();
}

/**
 * Mock view base class.
 */
export class MockView {
	file: TFile | null = null;
	containerEl: MockHTMLElement = new MockHTMLElement('div');

	constructor(file?: TFile) {
		this.file = file || null;
	}

	getViewType(): string {
		return 'mock';
	}
}

/**
 * Mock markdown view for testing document operations.
 */
export class MockMarkdownView extends MockView {
	editor: MockEditor | null = null;
	contentEl: MockHTMLElement = new MockHTMLElement('div');

	constructor(file?: TFile) {
		super(file);
		this.editor = new MockEditor();
		this.contentEl.addClass('markdown-reading-view');
	}

	getViewType(): string {
		return 'markdown';
	}

	getMode(): 'source' | 'preview' {
		return 'source';
	}
}

/**
 * Mock editor for testing CodeMirror interactions.
 */
export class MockEditor {
	private content: string = '';
	private cursor: { line: number; ch: number } = { line: 0, ch: 0 };

	scrollTo = jest.fn().mockImplementation((x: number | null, y: number) => {
		// Mock scroll implementation
	});

	getValue = jest.fn().mockImplementation(() => this.content);
	setValue = jest.fn().mockImplementation((value: string) => {
		this.content = value;
	});

	getCursor = jest.fn().mockImplementation(() => ({ ...this.cursor }));
	setCursor = jest.fn().mockImplementation((line: number, ch: number) => {
		this.cursor = { line, ch };
	});

	getLine = jest.fn().mockImplementation((line: number) => {
		const lines = this.content.split('\n');
		return lines[line] || '';
	});

	lineCount = jest.fn().mockImplementation(() => {
		return this.content.split('\n').length;
	});
}

/**
 * Enhanced app mock with comprehensive Obsidian API coverage.
 */
export const mockVault = new MockVault();
export const mockWorkspace = new MockWorkspace();

export const mockApp = {
	vault: mockVault,
	workspace: mockWorkspace,
	keymap: {
		addCommand: jest.fn(),
		removeCommand: jest.fn(),
		pushScope: jest.fn(),
		popScope: jest.fn(),
	},
	scope: {
		register: jest.fn(),
		unregister: jest.fn(),
	},
	metadataCache: {
		getFileCache: jest.fn().mockReturnValue(null),
		getCache: jest.fn().mockReturnValue(null),
		getFirstLinkpathDest: jest.fn().mockReturnValue(null),
		resolvedLinks: {},
		unresolvedLinks: {},
	},
	fileManager: {
		processFrontMatter: jest.fn().mockImplementation((file: TFile, fn: (fm: any) => void) => {
			fn({});
		}),
		generateMarkdownLink: jest.fn().mockImplementation((file: TFile, sourcePath: string) => {
			return `[[${file.basename}]]`;
		}),
		createFolder: jest.fn(),
		renameFile: jest.fn(),
		trashFile: jest.fn(),
	},
	lastEvent: null,
	plugins: {
		enabledPlugins: new Set(),
		plugins: new Map(),
		getPlugin: jest.fn(),
		enablePlugin: jest.fn(),
		disablePlugin: jest.fn(),
	},
	setting: {
		openTabById: jest.fn(),
		openTab: jest.fn(),
	},
	loadLocalStorage: jest.fn().mockReturnValue(null),
	saveLocalStorage: jest.fn(),
};

export const requestUrl = jest.fn();

/**
 * Enhanced ButtonComponent mock with realistic interaction behavior.
 */
export class ButtonComponent {
	buttonEl: MockHTMLElement;
	private clickHandler?: () => void;
	private isDisabled: boolean = false;

	constructor(containerEl: MockHTMLElement | HTMLElement) {
		this.buttonEl = new MockHTMLElement('button');

		// If containerEl is our MockHTMLElement, append to it
		if (containerEl instanceof MockHTMLElement) {
			containerEl.appendChild(this.buttonEl);
		}
	}

	setButtonText(text: string): this {
		this.buttonEl.textContent = text;
		return this;
	}

	setClass(className: string): this {
		this.buttonEl.addClass(className);
		return this;
	}

	setCta(): this {
		this.buttonEl.addClass('mod-cta');
		return this;
	}

	setDisabled(disabled: boolean): this {
		this.isDisabled = disabled;
		if (disabled) {
			this.buttonEl.setAttribute('disabled', 'true');
		} else {
			this.buttonEl.removeAttribute('disabled');
		}
		return this;
	}

	onClick(handler: () => void): this {
		this.clickHandler = handler;
		this.buttonEl.addEventListener('click', () => {
			if (!this.isDisabled && this.clickHandler) {
				this.clickHandler();
			}
		});
		return this;
	}

	// Test utilities
	simulateClick(): void {
		if (!this.isDisabled && this.clickHandler) {
			this.clickHandler();
		}
	}

	isButtonDisabled(): boolean {
		return this.isDisabled;
	}

	getButtonText(): string {
		return this.buttonEl.textContent || '';
	}
}

/**
 * Enhanced TextComponent mock with realistic input behavior.
 */
export class TextComponent {
	inputEl: MockHTMLElement;
	private changeHandler?: (value: string) => void;
	private currentValue: string = '';

	constructor(containerEl: MockHTMLElement | HTMLElement) {
		this.inputEl = new MockHTMLElement('input');
		this.inputEl.setAttribute('type', 'text');

		// If containerEl is our MockHTMLElement, append to it
		if (containerEl instanceof MockHTMLElement) {
			containerEl.appendChild(this.inputEl);
		}
	}

	setPlaceholder(placeholder: string): this {
		this.inputEl.setAttribute('placeholder', placeholder);
		return this;
	}

	setValue(value: string): this {
		this.currentValue = value;
		this.inputEl.setAttribute('value', value);
		return this;
	}

	getValue(): string {
		return this.currentValue;
	}

	onChange(handler: (value: string) => void): this {
		this.changeHandler = handler;
		this.inputEl.addEventListener('change', (event: any) => {
			this.currentValue = event.target?.value || '';
			if (this.changeHandler) {
				this.changeHandler(this.currentValue);
			}
		});
		this.inputEl.addEventListener('input', (event: any) => {
			this.currentValue = event.target?.value || '';
			if (this.changeHandler) {
				this.changeHandler(this.currentValue);
			}
		});
		return this;
	}

	// Test utilities
	simulateInput(value: string): void {
		this.currentValue = value;
		this.inputEl.setAttribute('value', value);
		this.inputEl.triggerEvent('input', { target: { value } });
		this.inputEl.triggerEvent('change', { target: { value } });
	}

	getPlaceholder(): string {
		return this.inputEl.getAttribute('placeholder') || '';
	}
}

/**
 * WorkspaceLeaf type for better TypeScript support in tests.
 */
export interface WorkspaceLeaf {
	view: any;
	openFile(file: TFile): Promise<any>;
	getViewState(): any;
	setViewState(state: any): Promise<void>;
	containerEl: HTMLElement;
}

/**
 * MarkdownView type for better TypeScript support in tests.
 */
export interface MarkdownView {
	file: TFile | null;
	editor: any;
	contentEl: HTMLElement;
	getViewType(): string;
	getMode(): 'source' | 'preview';
}
