/**
 * Settings test helper using robust UI mocking
 */

import { MockSettingBuilder } from './ui-mocks';
import { TestIsolationManager } from './test-isolation';

export interface MockSettingCallbacks {
	sliderCallbacks: Array<(value: number) => Promise<void>>;
	dropdownCallbacks: Array<(value: string) => Promise<void>>;
	toggleCallbacks: Array<(value: boolean) => Promise<void>>;
	textCallbacks: Array<(value: string) => Promise<void>>;
	buttonCallbacks: Array<() => Promise<void>>;
}

export function createSettingsTestEnvironment(): {
	mockSetting: any;
	callbacks: MockSettingCallbacks;
	isolation: TestIsolationManager;
} {
	const callbacks: MockSettingCallbacks = {
		sliderCallbacks: [],
		dropdownCallbacks: [],
		toggleCallbacks: [],
		textCallbacks: [],
		buttonCallbacks: [],
	};

	const mockSetting = jest.fn().mockImplementation(() => {
		const settingInstance = {
			setName: jest.fn().mockReturnThis(),
			setDesc: jest.fn().mockReturnThis(),
			addSlider: jest.fn().mockImplementation(builderFn => {
				const mockSlider = {
					setLimits: jest.fn().mockReturnThis(),
					setValue: jest.fn().mockReturnThis(),
					setDynamicTooltip: jest.fn().mockReturnThis(),
					onChange: jest.fn().mockImplementation(callback => {
						callbacks.sliderCallbacks.push(callback);
						return mockSlider;
					}),
				};
				builderFn(mockSlider);
				return settingInstance;
			}),
			addDropdown: jest.fn().mockImplementation(builderFn => {
				const mockDropdown = {
					addOption: jest.fn().mockReturnThis(),
					setValue: jest.fn().mockReturnThis(),
					onChange: jest.fn().mockImplementation(callback => {
						callbacks.dropdownCallbacks.push(callback);
						return mockDropdown;
					}),
				};
				builderFn(mockDropdown);
				return settingInstance;
			}),
			addToggle: jest.fn().mockImplementation(builderFn => {
				const mockToggle = {
					setValue: jest.fn().mockReturnThis(),
					onChange: jest.fn().mockImplementation(callback => {
						callbacks.toggleCallbacks.push(callback);
						return mockToggle;
					}),
				};
				builderFn(mockToggle);
				return settingInstance;
			}),
			addText: jest.fn().mockImplementation(builderFn => {
				const mockText = {
					setPlaceholder: jest.fn().mockReturnThis(),
					setValue: jest.fn().mockReturnThis(),
					onChange: jest.fn().mockImplementation(callback => {
						callbacks.textCallbacks.push(callback);
						return mockText;
					}),
				};
				builderFn(mockText);
				return settingInstance;
			}),
			addButton: jest.fn().mockImplementation(builderFn => {
				const mockButton = {
					setButtonText: jest.fn().mockReturnThis(),
					setCta: jest.fn().mockReturnThis(),
					onClick: jest.fn().mockImplementation(callback => {
						callbacks.buttonCallbacks.push(callback);
						return mockButton;
					}),
				};
				builderFn(mockButton);
				return settingInstance;
			}),
		};
		return settingInstance;
	});

	const isolation = new TestIsolationManager();

	return {
		mockSetting,
		callbacks,
		isolation,
	};
}
