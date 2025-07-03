/**
 * Robust UI component mocking for Obsidian components
 */

interface MockCallbacks {
	dropdowns: Array<(value: string) => Promise<void>>;
	toggles: Array<(value: boolean) => Promise<void>>;
	sliders: Array<(value: number) => Promise<void>>;
	texts: Array<(value: string) => Promise<void>>;
	buttons: Array<() => Promise<void>>;
}

export class MockSettingBuilder {
	private callbacks: MockCallbacks = {
		dropdowns: [],
		toggles: [],
		sliders: [],
		texts: [],
		buttons: [],
	};

	addDropdown(options: string[], defaultValue: string): this {
		const callback = jest.fn().mockImplementation(async (value: string) => {
			// Simulate dropdown change
		});
		this.callbacks.dropdowns.push(callback);
		return this;
	}

	addToggle(defaultValue: boolean): this {
		const callback = jest.fn().mockImplementation(async (value: boolean) => {
			// Simulate toggle change
		});
		this.callbacks.toggles.push(callback);
		return this;
	}

	addSlider(min: number, max: number, step: number, defaultValue: number): this {
		const callback = jest.fn().mockImplementation(async (value: number) => {
			// Simulate slider change
		});
		this.callbacks.sliders.push(callback);
		return this;
	}

	addText(defaultValue: string): this {
		const callback = jest.fn().mockImplementation(async (value: string) => {
			// Simulate text input change
		});
		this.callbacks.texts.push(callback);
		return this;
	}

	addButton(text: string): this {
		const callback = jest.fn().mockImplementation(async () => {
			// Simulate button click
		});
		this.callbacks.buttons.push(callback);
		return this;
	}

	getCallbacks(): MockCallbacks {
		return this.callbacks;
	}

	build(): any {
		const mockSetting = {
			setName: jest.fn().mockReturnThis(),
			setDesc: jest.fn().mockReturnThis(),
			addDropdown: jest.fn().mockImplementation(fn => {
				const mockDropdown = {
					addOption: jest.fn().mockReturnThis(),
					setValue: jest.fn().mockReturnThis(),
					onChange: jest.fn().mockImplementation(callback => {
						this.callbacks.dropdowns.push(callback);
						return mockDropdown;
					}),
				};
				fn(mockDropdown);
				return mockSetting;
			}),
			addToggle: jest.fn().mockImplementation(fn => {
				const mockToggle = {
					setValue: jest.fn().mockReturnThis(),
					onChange: jest.fn().mockImplementation(callback => {
						this.callbacks.toggles.push(callback);
						return mockToggle;
					}),
				};
				fn(mockToggle);
				return mockSetting;
			}),
			addSlider: jest.fn().mockImplementation(fn => {
				const mockSlider = {
					setLimits: jest.fn().mockReturnThis(),
					setValue: jest.fn().mockReturnThis(),
					setDynamicTooltip: jest.fn().mockReturnThis(),
					onChange: jest.fn().mockImplementation(callback => {
						this.callbacks.sliders.push(callback);
						return mockSlider;
					}),
				};
				fn(mockSlider);
				return mockSetting;
			}),
			addText: jest.fn().mockImplementation(fn => {
				const mockText = {
					setPlaceholder: jest.fn().mockReturnThis(),
					setValue: jest.fn().mockReturnThis(),
					onChange: jest.fn().mockImplementation(callback => {
						this.callbacks.texts.push(callback);
						return mockText;
					}),
				};
				fn(mockText);
				return mockSetting;
			}),
			addButton: jest.fn().mockImplementation(fn => {
				const mockButton = {
					setButtonText: jest.fn().mockReturnThis(),
					setCta: jest.fn().mockReturnThis(),
					onClick: jest.fn().mockImplementation(callback => {
						this.callbacks.buttons.push(callback);
						return mockButton;
					}),
				};
				fn(mockButton);
				return mockSetting;
			}),
		};

		return mockSetting;
	}
}

export function createMockModal(): any {
	return {
		containerEl: {
			createEl: jest.fn().mockImplementation((tag, attrs) => ({
				innerHTML: '',
				createEl: jest.fn().mockReturnThis(),
				createDiv: jest.fn().mockReturnThis(),
				addClass: jest.fn().mockReturnThis(),
				appendChild: jest.fn().mockReturnThis(),
			})),
			createDiv: jest.fn().mockReturnThis(),
			empty: jest.fn().mockReturnThis(),
			addClass: jest.fn().mockReturnThis(),
		},
		titleEl: {
			setText: jest.fn(),
		},
		open: jest.fn(),
		close: jest.fn(),
		onOpen: jest.fn(),
		onClose: jest.fn(),
	};
}

export function setupUITestEnvironment(): {
	mockSetting: () => MockSettingBuilder;
	mockModal: () => any;
	reset: () => void;
} {
	return {
		mockSetting: () => new MockSettingBuilder(),
		mockModal: createMockModal,
		reset: () => {
			jest.clearAllMocks();
		},
	};
}
