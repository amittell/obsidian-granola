import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type GranolaImporterPlugin from '../main';
import { LogLevel, ImportStrategy, DatePrefixFormat, ContentPriority } from './types';

/**
 * Settings tab for configuring the Granola importer plugin.
 */
export class GranolaSettingTab extends PluginSettingTab {
	plugin: GranolaImporterPlugin;

	constructor(app: App, plugin: GranolaImporterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Granola Importer Settings' });

		// Connection section
		this.addConnectionSection();

		// Debug section
		this.addDebugSection();

		// Import behavior section
		this.addImportSection();

		// Content processing section
		this.addContentSection();

		// UI preferences section
		this.addUISection();
	}

	/**
	 * Adds the connection and validation section.
	 */
	private addConnectionSection(): void {
		const { containerEl } = this;

		containerEl.createEl('h3', { text: 'Connection & Validation' });

		// Connection status
		const statusEl = containerEl.createDiv('connection-status');
		this.updateConnectionStatus(statusEl);

		// Validate connection button
		new Setting(containerEl)
			.setName('Test Granola connection')
			.setDesc('Verify that the plugin can connect to Granola and access your documents')
			.addButton(button => {
				button
					.setButtonText('Test Connection')
					.setCta()
					.onClick(async () => {
						await this.validateConnection(statusEl);
					});
			});

		// API timeout setting
		new Setting(containerEl)
			.setName('API timeout')
			.setDesc('How long to wait for API responses (in seconds)')
			.addSlider(slider => {
				slider
					.setLimits(5, 120, 5)
					.setValue(this.plugin.settings.connection.timeoutMs / 1000)
					.setDynamicTooltip()
					.onChange(async value => {
						this.plugin.settings.connection.timeoutMs = value * 1000;
						await this.plugin.saveSettings();
					});
			});
	}

	/**
	 * Adds the debug and logging section.
	 */
	private addDebugSection(): void {
		const { containerEl } = this;

		containerEl.createEl('h3', { text: 'Debug & Logging' });

		// Debug mode toggle
		new Setting(containerEl)
			.setName('Enable debug mode')
			.setDesc(
				'Show detailed logging for troubleshooting. Disable this to reduce console noise.'
			)
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.debug.enabled).onChange(async value => {
					this.plugin.settings.debug.enabled = value;
					this.plugin.logger.updateSettings(this.plugin.settings);
					await this.plugin.saveSettings();
				});
			});

		// Log level
		new Setting(containerEl)
			.setName('Log level')
			.setDesc('Minimum level of messages to show in console')
			.addDropdown(dropdown => {
				dropdown
					.addOption(LogLevel.ERROR.toString(), 'Error only')
					.addOption(LogLevel.WARN.toString(), 'Warning and above')
					.addOption(LogLevel.INFO.toString(), 'Info and above')
					.addOption(LogLevel.DEBUG.toString(), 'All messages')
					.setValue(this.plugin.settings.debug.logLevel.toString())
					.onChange(async value => {
						this.plugin.settings.debug.logLevel = parseInt(value) as LogLevel;
						this.plugin.logger.updateSettings(this.plugin.settings);
						await this.plugin.saveSettings();
					});
			});
	}

	/**
	 * Adds the import behavior section.
	 */
	private addImportSection(): void {
		const { containerEl } = this;

		containerEl.createEl('h3', { text: 'Import Behavior' });

		// Default import strategy
		new Setting(containerEl)
			.setName('Duplicate handling')
			.setDesc('How to handle documents that already exist in your vault')
			.addDropdown(dropdown => {
				dropdown
					.addOption(ImportStrategy.SKIP_EXISTING, 'Skip existing documents')
					.addOption(ImportStrategy.UPDATE_EXISTING, 'Update existing with newer content')
					.addOption(ImportStrategy.ALWAYS_PROMPT, 'Always ask what to do')
					.setValue(this.plugin.settings.import.strategy)
					.onChange(async value => {
						this.plugin.settings.import.strategy = value as ImportStrategy;
						await this.plugin.saveSettings();
					});
			});

		// Default import folder
		new Setting(containerEl)
			.setName('Import folder')
			.setDesc(
				'Default folder in your vault for imported documents (leave empty for vault root)'
			)
			.addText(text => {
				text.setPlaceholder('e.g., Meetings/Granola')
					.setValue(this.plugin.settings.import.defaultFolder)
					.onChange(async value => {
						this.plugin.settings.import.defaultFolder = value;
						await this.plugin.saveSettings();
					});
			});

		// Create folders toggle
		new Setting(containerEl)
			.setName('Create folders')
			.setDesc("Automatically create folders if they don't exist")
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.import.createFolders).onChange(async value => {
					this.plugin.settings.import.createFolders = value;
					await this.plugin.saveSettings();
				});
			});
	}

	/**
	 * Adds the content processing section.
	 */
	private addContentSection(): void {
		const { containerEl } = this;

		containerEl.createEl('h3', { text: 'Content Processing' });

		// Date prefix format
		new Setting(containerEl)
			.setName('Date prefix format')
			.setDesc(
				'Format for date prefixes in filenames (prevents duplicate names for recurring meetings)'
			)
			.addDropdown(dropdown => {
				dropdown
					.addOption(DatePrefixFormat.ISO_DATE, 'YYYY-MM-DD (2025-06-28)')
					.addOption(DatePrefixFormat.US_DATE, 'MM-DD-YYYY (06-28-2025)')
					.addOption(DatePrefixFormat.EU_DATE, 'DD-MM-YYYY (28-06-2025)')
					.addOption(DatePrefixFormat.DOT_DATE, 'YYYY.MM.DD (2025.06.28)')
					.addOption(DatePrefixFormat.NONE, 'No date prefix')
					.setValue(this.plugin.settings.content.datePrefixFormat)
					.onChange(async value => {
						this.plugin.settings.content.datePrefixFormat = value as DatePrefixFormat;
						await this.plugin.saveSettings();
					});
			});

		// Content priority
		new Setting(containerEl)
			.setName('Content source priority')
			.setDesc('Which content field to try first when extracting note content')
			.addDropdown(dropdown => {
				dropdown
					.addOption(ContentPriority.PANEL_FIRST, 'Panel first (recommended)')
					.addOption(ContentPriority.NOTES_FIRST, 'Notes first')
					.addOption(ContentPriority.PANEL_ONLY, 'Panel only')
					.addOption(ContentPriority.NOTES_ONLY, 'Notes only')
					.setValue(this.plugin.settings.content.contentPriority)
					.onChange(async value => {
						this.plugin.settings.content.contentPriority = value as ContentPriority;
						await this.plugin.saveSettings();
					});
			});

		// Enhanced frontmatter toggle
		new Setting(containerEl)
			.setName('Enhanced frontmatter')
			.setDesc(
				'Include additional metadata fields (id, title, updated timestamp) in frontmatter. Default is minimal frontmatter with only created date and source.'
			)
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.content.includeEnhancedFrontmatter)
					.onChange(async value => {
						this.plugin.settings.content.includeEnhancedFrontmatter = value;
						await this.plugin.saveSettings();
					});
			});

		// Maximum filename length
		new Setting(containerEl)
			.setName('Maximum filename length')
			.setDesc('Limit filename length to prevent filesystem issues')
			.addSlider(slider => {
				slider
					.setLimits(50, 200, 10)
					.setValue(this.plugin.settings.import.maxFilenameLength)
					.setDynamicTooltip()
					.onChange(async value => {
						this.plugin.settings.import.maxFilenameLength = value;
						await this.plugin.saveSettings();
					});
			});
	}

	/**
	 * Adds the UI preferences section.
	 */
	private addUISection(): void {
		const { containerEl } = this;

		containerEl.createEl('h3', { text: 'User Interface' });

		// Auto-close modal
		new Setting(containerEl)
			.setName('Auto-close import modal')
			.setDesc('Automatically close the import dialog after successful import')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.ui.autoCloseModal).onChange(async value => {
					this.plugin.settings.ui.autoCloseModal = value;
					await this.plugin.saveSettings();
				});
			});

		// Progress notifications
		new Setting(containerEl)
			.setName('Show progress notifications')
			.setDesc('Display toast notifications during import progress')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.ui.showProgressNotifications)
					.onChange(async value => {
						this.plugin.settings.ui.showProgressNotifications = value;
						await this.plugin.saveSettings();
					});
			});

		// Select all by default
		new Setting(containerEl)
			.setName('Select all documents by default')
			.setDesc('Automatically select all documents when opening the import dialog')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.ui.selectAllByDefault)
					.onChange(async value => {
						this.plugin.settings.ui.selectAllByDefault = value;
						await this.plugin.saveSettings();
					});
			});
	}

	/**
	 * Validates the Granola connection and updates the UI.
	 */
	private async validateConnection(statusEl: HTMLElement): Promise<void> {
		statusEl.innerHTML = '<span style="color: orange;">🔄 Testing connection...</span>';

		try {
			// Create a temporary API instance for testing
			const auth = this.plugin.auth;
			await auth.loadCredentials();

			// Try to fetch a small number of documents to test the connection
			const response = await this.plugin.api.getDocuments({ limit: 1, offset: 0 });

			if (response && response.docs !== undefined) {
				this.plugin.settings.connection.isConnected = true;
				this.plugin.settings.connection.lastValidated = Date.now();
				await this.plugin.saveSettings();

				statusEl.innerHTML =
					'<span style="color: green;">✅ Connected successfully!</span>';
				new Notice('✅ Granola connection test successful!', 3000);
			} else {
				throw new Error('Invalid response format');
			}
		} catch (error) {
			this.plugin.settings.connection.isConnected = false;
			await this.plugin.saveSettings();

			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			statusEl.innerHTML = '<span style="color: red;">❌ Connection failed</span>';
			new Notice(`❌ Connection test failed: ${errorMessage}`, 5000);
		}
	}

	/**
	 * Updates the connection status display.
	 */
	private updateConnectionStatus(statusEl: HTMLElement): void {
		const { isConnected, lastValidated } = this.plugin.settings.connection;

		if (isConnected && lastValidated > 0) {
			const lastCheck = new Date(lastValidated).toLocaleString();
			statusEl.innerHTML = `<span style="color: green;">✅ Connected (last checked: ${lastCheck})</span>`;
		} else {
			statusEl.innerHTML = '<span style="color: gray;">⚪ Connection not tested</span>';
		}
	}
}
