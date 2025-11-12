import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type GranolaImporterPlugin from '../main';
import { LogLevel, ImportStrategy, DatePrefixFormat } from './types';

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

		new Setting(containerEl).setHeading().setName('Connection and validation');

		// Connection status
		const statusEl = containerEl.createDiv('connection-status');
		this.updateConnectionStatus(statusEl);

		// Validate connection button
		new Setting(containerEl)
			.setName('Test Granola connection')
			.setDesc('Verify that the plugin can connect to Granola and access your documents')
			.addButton(button => {
				button
					.setButtonText('Test connection')
					.setCta()
					.onClick(async () => {
						await this.validateConnection(statusEl);
					});
			});
	}

	/**
	 * Adds the debug and logging section.
	 */
	private addDebugSection(): void {
		const { containerEl } = this;

		new Setting(containerEl).setHeading().setName('Debug and logging');

		// Debug mode toggle
		new Setting(containerEl)
			.setName('Enable debug mode')
			.setDesc(
				'Show detailed logging for troubleshooting. Automatically sets log level to "Debug" when enabled.'
			)
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.debug.enabled).onChange(async value => {
					this.plugin.settings.debug.enabled = value;
					// When enabling debug mode, automatically set log level to DEBUG
					// When disabling, revert to WARN to reduce noise
					if (value) {
						this.plugin.settings.debug.logLevel = LogLevel.DEBUG;
					} else {
						this.plugin.settings.debug.logLevel = LogLevel.WARN;
					}
					this.plugin.logger.updateSettings(this.plugin.settings);
					await this.plugin.saveSettings();
					// Refresh the UI to show the updated log level
					this.display();
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
					.addOption(LogLevel.DEBUG.toString(), 'Debug and above')
					.setValue(this.plugin.settings.debug.logLevel.toString())
					.onChange(async value => {
						const numValue = parseInt(value);
						if (Object.values(LogLevel).includes(numValue)) {
							this.plugin.settings.debug.logLevel = numValue;
						}
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

		new Setting(containerEl).setHeading().setName('Import behavior');

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

		// Skip empty documents
		new Setting(containerEl)
			.setName('Skip empty documents')
			.setDesc(
				'Filter out empty placeholder documents that have no meaningful content or were never modified after creation'
			)
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.import.skipEmptyDocuments)
					.onChange(async value => {
						this.plugin.settings.import.skipEmptyDocuments = value;
						await this.plugin.saveSettings();
					});
			});
	}

	/**
	 * Adds the content processing section.
	 */
	private addContentSection(): void {
		const { containerEl } = this;

		new Setting(containerEl).setHeading().setName('Content processing');

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

		// Granola URL toggle
		new Setting(containerEl)
			.setName('Include Granola URL')
			.setDesc(
				'Add a direct link to the original Granola note in the frontmatter for easy cross-referencing'
			)
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.content.includeGranolaUrl)
					.onChange(async value => {
						this.plugin.settings.content.includeGranolaUrl = value;
						await this.plugin.saveSettings();
					});
			});

		// Custom filename template toggle
		new Setting(containerEl)
			.setName('Use custom filename template')
			.setDesc(
				'Enable custom filename templates with variables instead of date prefix format'
			)
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.content.useCustomFilenameTemplate)
					.onChange(async value => {
						this.plugin.settings.content.useCustomFilenameTemplate = value;
						await this.plugin.saveSettings();
						// Refresh the display to show/hide dependent settings
						this.display();
					});
			});

		// Show either date prefix or filename template based on toggle
		if (!this.plugin.settings.content.useCustomFilenameTemplate) {
			// Date prefix format (original behavior)
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
							this.plugin.settings.content.datePrefixFormat =
								value as DatePrefixFormat;
							await this.plugin.saveSettings();
						});
				});
		} else {
			// Filename template (new behavior)
			new Setting(containerEl)
				.setName('Filename template')
				.setDesc(
					'Customize how files are named. Available variables: {title}, {id}, {created_date}, {updated_date}, {created_time}, {updated_time}, {created_datetime}, {updated_datetime}'
				)
				.addText(text => {
					text.setPlaceholder('{created_date} - {title}')
						.setValue(this.plugin.settings.content.filenameTemplate)
						.onChange(async value => {
							this.plugin.settings.content.filenameTemplate =
								value || '{created_date} - {title}';
							await this.plugin.saveSettings();
							// Update preview
							this.updateFilenamePreview();
						});
				})
				.addButton(button => {
					button
						.setButtonText('Preview')
						.setCta()
						.onClick(() => {
							this.updateFilenamePreview();
						});
				});

			// Add preview element
			const previewEl = containerEl.createDiv('setting-item-description');
			previewEl.addClass('granola-filename-template-preview');
			previewEl.id = 'granola-filename-template-preview';
			this.updateFilenamePreview();
		}

		// Action items section header
		new Setting(containerEl).setHeading().setName('Action items');

		// Convert action items to tasks
		new Setting(containerEl)
			.setName('Convert action items to tasks')
			.setDesc(
				'Automatically convert bullet points under action-oriented headers to markdown task format (- [ ]). Recognizes variations like "Action Items for Alex", "Follow-ups", "Next Steps", "TODOs", etc.'
			)
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.actionItems.convertToTasks)
					.onChange(async value => {
						this.plugin.settings.actionItems.convertToTasks = value;
						await this.plugin.saveSettings();
						// Refresh the entire settings display to update dependencies
						this.display();
					});
			});

		// Add task tag (dependent on convert to tasks)
		if (this.plugin.settings.actionItems.convertToTasks) {
			new Setting(containerEl)
				.setName('Add task tag')
				.setDesc('Add a tag below converted tasks for easy filtering and task management')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.actionItems.addTaskTag)
						.onChange(async value => {
							this.plugin.settings.actionItems.addTaskTag = value;
							await this.plugin.saveSettings();
							// Refresh the entire settings display to update dependencies
							this.display();
						});
				});

			// Task tag name (dependent on add task tag)
			if (this.plugin.settings.actionItems.addTaskTag) {
				new Setting(containerEl)
					.setName('Task tag name')
					.setDesc('Tag to add to notes containing converted tasks (include # symbol)')
					.addText(text => {
						text.setPlaceholder('#tasks')
							.setValue(this.plugin.settings.actionItems.taskTagName)
							.onChange(async value => {
								// Ensure tag starts with #
								if (value && !value.startsWith('#')) {
									value = '#' + value;
								}
								this.plugin.settings.actionItems.taskTagName = value || '#tasks';
								await this.plugin.saveSettings();
							});
					});
			}
		}
	}

	/**
	 * Adds the UI preferences section.
	 */
	private addUISection(): void {
		const { containerEl } = this;

		new Setting(containerEl).setHeading().setName('User interface');

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

		// Show empty documents
		new Setting(containerEl)
			.setName('Show empty documents')
			.setDesc(
				'Display empty documents in the document selection modal. Empty documents are those that were created but never modified.'
			)
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.ui.showEmptyDocuments)
					.onChange(async value => {
						this.plugin.settings.ui.showEmptyDocuments = value;
						await this.plugin.saveSettings();
					});
			});

		// Attendee Tags section
		new Setting(containerEl).setHeading().setName('Attendee tags');

		// Enable attendee tags
		new Setting(containerEl)
			.setName('Extract attendee tags')
			.setDesc('Automatically create tags from meeting attendee names')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.attendeeTags.enabled).onChange(async value => {
					this.plugin.settings.attendeeTags.enabled = value;
					await this.plugin.saveSettings();
					// Refresh the display to show/hide dependent settings
					this.display();
				});
			});

		// Show attendee tag settings only if enabled
		if (this.plugin.settings.attendeeTags.enabled) {
			// Exclude my name option
			new Setting(containerEl)
				.setName('Exclude my name')
				.setDesc('Exclude your own name from attendee tags')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.attendeeTags.excludeMyName)
						.onChange(async value => {
							this.plugin.settings.attendeeTags.excludeMyName = value;
							await this.plugin.saveSettings();
							// Refresh display to show/hide name field
							this.display();
						});
				});

			// My name field (only shown if excluding is enabled)
			if (this.plugin.settings.attendeeTags.excludeMyName) {
				new Setting(containerEl)
					.setName('My name')
					.setDesc('Your name as it appears in meeting attendee lists')
					.addText(text => {
						text.setPlaceholder('John Smith')
							.setValue(this.plugin.settings.attendeeTags.myName)
							.onChange(async value => {
								this.plugin.settings.attendeeTags.myName = value;
								await this.plugin.saveSettings();
							});
					});
			}

			// Include host toggle
			new Setting(containerEl)
				.setName('Include host in attendee tags')
				.setDesc('Include the meeting host/creator in the attendee tags')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.attendeeTags.includeHost)
						.onChange(async value => {
							this.plugin.settings.attendeeTags.includeHost = value;
							await this.plugin.saveSettings();
						});
				});

			// Tag template
			new Setting(containerEl)
				.setName('Tag template')
				.setDesc(
					'Template for attendee tags. Available variables: {name}, {email}, {domain}, {company}. Example: person/{name} or {company}/{name}'
				)
				.addText(text => {
					text.setPlaceholder('person/{name}')
						.setValue(this.plugin.settings.attendeeTags.tagTemplate)
						.onChange(async value => {
							this.plugin.settings.attendeeTags.tagTemplate =
								value || 'person/{name}';
							await this.plugin.saveSettings();
						});
				});
		}
	}

	/**
	 * Validates the Granola connection and updates the UI.
	 */
	private async validateConnection(statusEl: HTMLElement): Promise<void> {
		statusEl.empty();
		statusEl.createEl('span', {
			text: '🔄 Testing connection...',
			cls: 'granola-connection-testing',
		});

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

				statusEl.empty();
				statusEl.createEl('span', {
					text: '✅ Connected successfully!',
					cls: 'granola-connection-success',
				});
				new Notice('✅ Granola connection test successful!', 3000);
			} else {
				throw new Error('Invalid response format');
			}
		} catch (error) {
			this.plugin.settings.connection.isConnected = false;
			await this.plugin.saveSettings();

			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			statusEl.empty();
			statusEl.createEl('span', {
				text: '❌ Connection failed',
				cls: 'granola-connection-failed',
			});
			new Notice(`❌ Connection test failed: ${errorMessage}`, 5000);
		}
	}

	/**
	 * Updates the connection status display.
	 */
	private updateConnectionStatus(statusEl: HTMLElement): void {
		const { isConnected, lastValidated } = this.plugin.settings.connection;

		statusEl.empty();
		if (isConnected && lastValidated > 0) {
			const lastCheck = new Date(lastValidated).toLocaleString();
			statusEl.createEl('span', {
				text: `✅ Connected (last checked: ${lastCheck})`,
				cls: 'granola-connection-connected',
			});
		} else {
			statusEl.createEl('span', {
				text: '⚪ Connection not tested',
				cls: 'granola-connection-not-tested',
			});
		}
	}

	/**
	 * Updates the filename template preview.
	 */
	private updateFilenamePreview(): void {
		const previewEl = this.containerEl.querySelector('#granola-filename-template-preview');
		if (!previewEl) return;

		const template = this.plugin.settings.content.filenameTemplate || '{title}';
		const now = new Date();

		// Create sample data
		const sampleTitle = 'Team Standup Meeting';
		const sampleId = 'abc123def456';

		// Format dates according to settings
		const dateFormat = this.plugin.settings.content.datePrefixFormat;
		const formattedDate = this.formatDateForPreview(now, dateFormat);
		const formattedTime = this.formatTimeForPreview(now);

		// Replace template variables
		const preview = template
			.replace(/{title}/g, sampleTitle)
			.replace(/{id}/g, sampleId)
			.replace(/{created_date}/g, formattedDate)
			.replace(/{updated_date}/g, formattedDate)
			.replace(/{created_time}/g, formattedTime)
			.replace(/{updated_time}/g, formattedTime)
			.replace(/{created_datetime}/g, `${formattedDate}_${formattedTime}`)
			.replace(/{updated_datetime}/g, `${formattedDate}_${formattedTime}`);

		previewEl.textContent = `Preview: ${preview}.md`;
	}

	/**
	 * Formats a date for preview according to the specified format setting.
	 */
	private formatDateForPreview(date: Date, format: string): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');

		switch (format) {
			case 'YYYY-MM-DD':
				return `${year}-${month}-${day}`;
			case 'MM-DD-YYYY':
				return `${month}-${day}-${year}`;
			case 'DD-MM-YYYY':
				return `${day}-${month}-${year}`;
			case 'YYYY.MM.DD':
				return `${year}.${month}.${day}`;
			default:
				return `${year}-${month}-${day}`;
		}
	}

	/**
	 * Formats a time for preview as HH-mm-ss.
	 */
	private formatTimeForPreview(date: Date): string {
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');
		return `${hours}-${minutes}-${seconds}`;
	}
}
