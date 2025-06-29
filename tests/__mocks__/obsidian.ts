import { jest } from '@jest/globals';

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
	loadData() {
		return Promise.resolve({});
	}
	saveData(data: any) {
		return Promise.resolve();
	}
}

export class Modal {
	app: any;
	modalEl: any;
	contentEl: any;
	
	constructor(app: any) {
		this.app = app;
		this.modalEl = {
			addClass: jest.fn(),
			removeClass: jest.fn()
		};
		this.contentEl = {
			empty: jest.fn(),
			createDiv: jest.fn(() => ({
				createEl: jest.fn(),
				createDiv: jest.fn(),
				addClass: jest.fn(),
				setAttribute: jest.fn(),
				querySelector: jest.fn(),
				querySelectorAll: jest.fn(() => []),
				scrollIntoView: jest.fn(),
				classList: {
					add: jest.fn(),
					remove: jest.fn()
				}
			})),
			createEl: jest.fn(() => ({
				createEl: jest.fn(),
				createDiv: jest.fn(),
				textContent: '',
				innerHTML: '',
				addEventListener: jest.fn()
			})),
			addClass: jest.fn()
		};
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

export const mockVault = {
	create: jest.fn(),
	modify: jest.fn(),
	getAbstractFileByPath: jest.fn(),
	exists: jest.fn(),
	delete: jest.fn(),
};

export const mockApp = {
	vault: mockVault,
	workspace: {
		getLeaf: jest.fn(),
		activeLeaf: null,
	},
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
		getFileCache: jest.fn(),
		getCache: jest.fn(),
	},
	fileManager: {
		processFrontMatter: jest.fn(),
		generateMarkdownLink: jest.fn(),
	},
	lastEvent: null,
	plugins: {
		enabledPlugins: new Set(),
		plugins: new Map(),
	},
	setting: {
		openTabById: jest.fn(),
	},
	loadLocalStorage: jest.fn(),
	saveLocalStorage: jest.fn(),
};

export const requestUrl = jest.fn();
