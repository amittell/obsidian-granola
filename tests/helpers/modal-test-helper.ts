import { jest } from '@jest/globals';
import { Modal } from 'obsidian';

/**
 * Comprehensive modal testing utilities for complex UI component testing.
 *
 * This helper provides sophisticated testing capabilities for Obsidian modal components,
 * including lifecycle management, user interaction simulation, and async operation testing.
 *
 * @class ModalTestHelper
 * @since 1.1.0
 */
export class ModalTestHelper<T extends Modal = Modal> {
	private modal: T;
	private mockContainerEl: MockHTMLElement;
	private mockContentEl: MockHTMLElement;
	private mockModalEl: MockHTMLElement;
	private isOpen: boolean = false;
	private openPromise?: Promise<void>;
	private closePromise?: Promise<void>;

	constructor(modal: T) {
		this.modal = modal;
		this.setupMockElements();
		this.setupModalMocks();
	}

	/**
	 * Sets up mock DOM elements with comprehensive interaction capabilities.
	 */
	private setupMockElements(): void {
		this.mockContainerEl = new MockHTMLElement('div');
		this.mockContentEl = new MockHTMLElement('div');
		this.mockModalEl = new MockHTMLElement('div');

		// Link elements to modal
		// Use Object.defineProperty to set readonly properties in tests
		Object.defineProperty(this.modal, 'containerEl', {
			value: this.mockContainerEl,
			writable: true,
			configurable: true
		});
		Object.defineProperty(this.modal, 'contentEl', {
			value: this.mockContentEl,
			writable: true,
			configurable: true
		});
		Object.defineProperty(this.modal, 'modalEl', {
			value: this.mockModalEl,
			writable: true,
			configurable: true
		});
	}

	/**
	 * Sets up modal method mocks with realistic behavior.
	 */
	private setupModalMocks(): void {
		const originalOpen = this.modal.open.bind(this.modal);
		const originalClose = this.modal.close.bind(this.modal);

		this.modal.open = jest.fn().mockImplementation(async () => {
			if (this.isOpen) return;

			this.isOpen = true;
			this.openPromise = Promise.resolve().then(async () => {
				if (this.modal.onOpen) {
					await this.modal.onOpen();
				}
			});

			await this.openPromise;
		});

		this.modal.close = jest.fn().mockImplementation(() => {
			if (!this.isOpen) return;

			this.isOpen = false;
			this.closePromise = Promise.resolve().then(() => {
				if (this.modal.onClose) {
					this.modal.onClose();
				}
			});

			return this.closePromise;
		});
	}

	/**
	 * Opens the modal and waits for onOpen to complete.
	 */
	async openModal(): Promise<void> {
		await this.modal.open();
		await this.openPromise;
	}

	/**
	 * Closes the modal and waits for onClose to complete.
	 */
	async closeModal(): Promise<void> {
		this.modal.close();
		await this.closePromise;
	}

	/**
	 * Checks if the modal is currently open.
	 */
	isModalOpen(): boolean {
		return this.isOpen;
	}

	/**
	 * Gets the mock content element for DOM queries.
	 */
	getContentElement(): MockHTMLElement {
		return this.mockContentEl;
	}

	/**
	 * Gets the mock modal element.
	 */
	getModalElement(): MockHTMLElement {
		return this.mockModalEl;
	}

	/**
	 * Simulates a button click by selector or element.
	 */
	async clickButton(selector: string): Promise<void> {
		const button = this.mockContentEl.querySelector(selector);
		if (!(button instanceof MockHTMLElement)) {
			throw new Error(`Button not found: ${selector}`);
		}

		await this.simulateUserInteraction(() => {
			button.click();
		});
	}

	/**
	 * Simulates typing in an input field.
	 */
	async typeInInput(selector: string, value: string): Promise<void> {
		const input = this.mockContentEl.querySelector(selector);
		if (!(input instanceof MockHTMLElement)) {
			throw new Error(`Input not found: ${selector}`);
		}

		await this.simulateUserInteraction(() => {
			input.setAttribute('value', value);
			input.triggerEvent('input', { target: { value } });
			input.triggerEvent('change', { target: { value } });
		});
	}

	/**
	 * Simulates checking/unchecking a checkbox.
	 */
	async toggleCheckbox(selector: string, checked: boolean = true): Promise<void> {
		const checkbox = this.mockContentEl.querySelector(selector);
		if (!(checkbox instanceof MockHTMLElement)) {
			throw new Error(`Checkbox not found: ${selector}`);
		}

		await this.simulateUserInteraction(() => {
			checkbox.setAttribute('checked', checked.toString());
			checkbox.triggerEvent('change', { target: { checked } });
		});
	}

	/**
	 * Simulates selecting an option from a dropdown.
	 */
	async selectOption(selector: string, value: string): Promise<void> {
		const select = this.mockContentEl.querySelector(selector);
		if (!(select instanceof MockHTMLElement)) {
			throw new Error(`Select not found: ${selector}`);
		}

		await this.simulateUserInteraction(() => {
			select.setAttribute('value', value);
			select.triggerEvent('change', { target: { value } });
		});
	}

	/**
	 * Waits for an element to appear in the DOM.
	 */
	async waitForElement(selector: string, timeout: number = 1000): Promise<MockHTMLElement> {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			const element = this.mockContentEl.querySelector(selector);
			if (element instanceof MockHTMLElement) {
				return element;
			}
			await this.delay(10);
		}

		throw new Error(`Element not found within timeout: ${selector}`);
	}

	/**
	 * Waits for an element to disappear from the DOM.
	 */
	async waitForElementToDisappear(selector: string, timeout: number = 1000): Promise<void> {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			const element = this.mockContentEl.querySelector(selector);
			if (!element) {
				return;
			}
			await this.delay(10);
		}

		throw new Error(`Element still visible after timeout: ${selector}`);
	}

	/**
	 * Waits for text content to appear in an element.
	 */
	async waitForText(
		selector: string,
		expectedText: string,
		timeout: number = 1000
	): Promise<void> {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			const element = this.mockContentEl.querySelector(selector);
			if (element instanceof MockHTMLElement && element.textContent?.includes(expectedText)) {
				return;
			}
			await this.delay(10);
		}

		throw new Error(`Text not found within timeout: "${expectedText}" in ${selector}`);
	}

	/**
	 * Simulates user interaction timing.
	 */
	private async simulateUserInteraction(action: () => void): Promise<void> {
		// Add small delay to simulate human interaction timing
		await this.delay(1);
		action();
		await this.delay(1);
	}

	/**
	 * Utility method for delays in tests.
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Gets all elements matching a selector.
	 */
	queryAll(selector: string): MockHTMLElement[] {
		return this.mockContentEl.querySelectorAll(selector);
	}

	/**
	 * Gets a single element matching a selector.
	 */
	query(selector: string): MockHTMLElement | null {
		const element = this.mockContentEl.querySelector(selector);
		return element instanceof MockHTMLElement ? element : null;
	}

	/**
	 * Asserts that an element exists.
	 */
	assertElementExists(selector: string): MockHTMLElement {
		const element = this.query(selector);
		if (!element) {
			throw new Error(`Expected element to exist: ${selector}`);
		}
		return element;
	}

	/**
	 * Asserts that an element does not exist.
	 */
	assertElementNotExists(selector: string): void {
		const element = this.query(selector);
		if (element) {
			throw new Error(`Expected element to not exist: ${selector}`);
		}
	}

	/**
	 * Asserts that an element has specific text content.
	 */
	assertElementText(selector: string, expectedText: string): void {
		const element = this.assertElementExists(selector);
		const actualText = element.textContent || '';
		if (!actualText.includes(expectedText)) {
			throw new Error(
				`Expected element "${selector}" to contain text "${expectedText}", but got "${actualText}"`
			);
		}
	}

	/**
	 * Asserts that an element has a specific attribute value.
	 */
	assertElementAttribute(selector: string, attribute: string, expectedValue: string): void {
		const element = this.assertElementExists(selector);
		const actualValue = element.getAttribute(attribute);
		if (actualValue !== expectedValue) {
			throw new Error(
				`Expected element "${selector}" to have ${attribute}="${expectedValue}", but got "${actualValue}"`
			);
		}
	}

	/**
	 * Asserts that a button is enabled or disabled.
	 */
	assertButtonState(selector: string, enabled: boolean): void {
		const button = this.assertElementExists(selector);
		const isDisabled = button.hasAttribute('disabled');
		if (enabled && isDisabled) {
			throw new Error(`Expected button "${selector}" to be enabled, but it's disabled`);
		}
		if (!enabled && !isDisabled) {
			throw new Error(`Expected button "${selector}" to be disabled, but it's enabled`);
		}
	}

	/**
	 * Simulates progress updates for testing async operations.
	 */
	simulateProgress(
		callback: (progress: number) => void,
		totalSteps: number = 100,
		stepDelay: number = 10
	): Promise<void> {
		return new Promise(resolve => {
			let currentStep = 0;
			const interval = setInterval(async () => {
				currentStep++;
				const progress = (currentStep / totalSteps) * 100;
				callback(progress);

				if (currentStep >= totalSteps) {
					clearInterval(interval);
					resolve();
				}
			}, stepDelay);
		});
	}

	/**
	 * Creates a test context for modal testing with cleanup.
	 */
	static createTestContext<T extends Modal>(modal: T): ModalTestContext<T> {
		const helper = new ModalTestHelper(modal);

		return {
			helper,
			async setup() {
				// Any setup logic needed before tests
			},
			async cleanup() {
				// Cleanup after tests
				if (helper.isModalOpen()) {
					await helper.closeModal();
				}
			},
		};
	}
}

/**
 * Test context for modal testing with setup and cleanup.
 */
export interface ModalTestContext<T extends Modal = Modal> {
	helper: ModalTestHelper<T>;
	setup(): Promise<void>;
	cleanup(): Promise<void>;
}

/**
 * Mock HTML Element with comprehensive testing capabilities.
 *
 * This mock provides realistic DOM element behavior for testing complex UI interactions
 * without requiring a full browser environment.
 */
export class MockHTMLElement {
	private tagName: string;
	private attributes: Map<string, string> = new Map();
	private children: MockHTMLElement[] = [];
	private parent: MockHTMLElement | null = null;
	private eventListeners: Map<string, Function[]> = new Map();
	private _textContent: string = '';
	private _htmlContent: string = '';
	private _classList: MockClassList;
	private _style: MockCSSStyleDeclaration;

	constructor(tagName: string = 'div') {
		this.tagName = tagName;
		this._classList = new MockClassList();
		this._style = new MockCSSStyleDeclaration();
	}

	// DOM element methods
	createElement(
		tagName: string,
		options?: { cls?: string; text?: string; attr?: Record<string, string> }
	): MockHTMLElement {
		const element = new MockHTMLElement(tagName);

		if (options?.cls) {
			element.addClass(options.cls);
		}
		if (options?.text) {
			element.textContent = options.text;
		}
		if (options?.attr) {
			Object.entries(options.attr).forEach(([key, value]) => {
				element.setAttribute(key, value);
			});
		}

		this.appendChild(element);
		return element;
	}

	createEl(
		tagName: string,
		options?: { cls?: string; text?: string; attr?: Record<string, string> }
	): MockHTMLElement {
		return this.createElement(tagName, options);
	}

	createDiv(className?: string): MockHTMLElement {
		const div = this.createElement('div');
		if (className) {
			div.addClass(className);
		}
		return div;
	}

	appendChild(child: MockHTMLElement): void {
		child.parent = this;
		this.children.push(child);
	}

	removeChild(child: MockHTMLElement): void {
		const index = this.children.indexOf(child);
		if (index > -1) {
			this.children.splice(index, 1);
			child.parent = null;
		}
	}

	querySelector(selector: string): MockHTMLElement | null {
		// Simple selector implementation for common cases
		if (selector.startsWith('.')) {
			const className = selector.substring(1);
			return this.findByClass(className);
		}
		if (selector.startsWith('#')) {
			const id = selector.substring(1);
			return this.findById(id);
		}
		if (selector.startsWith('[') && selector.endsWith(']')) {
			const attr = selector.slice(1, -1);
			const [name, value] = attr.split('=');
			return this.findByAttribute(name, value?.replace(/"/g, ''));
		}
		return this.findByTagName(selector);
	}

	querySelectorAll(selector: string): MockHTMLElement[] {
		const results: MockHTMLElement[] = [];
		this.collectMatches(selector, results);
		return results;
	}

	private findByClass(className: string): MockHTMLElement | null {
		if (this._classList.contains(className)) {
			return this;
		}
		for (const child of this.children) {
			const found = child.findByClass(className);
			if (found) return found;
		}
		return null;
	}

	private findById(id: string): MockHTMLElement | null {
		if (this.getAttribute('id') === id) {
			return this;
		}
		for (const child of this.children) {
			const found = child.findById(id);
			if (found) return found;
		}
		return null;
	}

	private findByAttribute(name: string, value?: string): MockHTMLElement | null {
		const attrValue = this.getAttribute(name);
		if (attrValue !== null && (value === undefined || attrValue === value)) {
			return this;
		}
		for (const child of this.children) {
			const found = child.findByAttribute(name, value);
			if (found) return found;
		}
		return null;
	}

	private findByTagName(tagName: string): MockHTMLElement | null {
		if (this.tagName.toLowerCase() === tagName.toLowerCase()) {
			return this;
		}
		for (const child of this.children) {
			const found = child.findByTagName(tagName);
			if (found) return found;
		}
		return null;
	}

	private collectMatches(selector: string, results: MockHTMLElement[]): void {
		const match = this.querySelector(selector);
		if (match === this) {
			results.push(this);
		}
		for (const child of this.children) {
			child.collectMatches(selector, results);
		}
	}

	// Attribute methods
	setAttribute(name: string, value: string): void {
		this.attributes.set(name, value);
	}

	getAttribute(name: string): string | null {
		return this.attributes.get(name) || null;
	}

	hasAttribute(name: string): boolean {
		return this.attributes.has(name);
	}

	removeAttribute(name: string): void {
		this.attributes.delete(name);
	}

	// Class methods
	addClass(className: string): void {
		this._classList.add(className);
	}

	removeClass(className: string): void {
		this._classList.remove(className);
	}

	hasClass(className: string): boolean {
		return this._classList.contains(className);
	}

	// Content methods
	get textContent(): string {
		return this._textContent;
	}

	set textContent(value: string) {
		this._textContent = value;
		this._htmlContent = value;
	}

	empty(): void {
		this.children = [];
		this._textContent = '';
		this._htmlContent = '';
	}

	// Event methods
	addEventListener(event: string, listener: Function): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, []);
		}
		this.eventListeners.get(event)!.push(listener);
	}

	removeEventListener(event: string, listener: Function): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			const index = listeners.indexOf(listener);
			if (index > -1) {
				listeners.splice(index, 1);
			}
		}
	}

	click(): void {
		this.triggerEvent('click');
	}

	triggerEvent(event: string, eventData?: Record<string, unknown>): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			listeners.forEach(listener => {
				listener(eventData || { target: this, type: event });
			});
		}
	}

	// Scroll methods
	scrollIntoView(options?: ScrollIntoViewOptions): void {
		// Mock implementation - just track that it was called
		Object.defineProperty(this, '_scrollIntoViewCalled', {
			value: true,
			writable: true,
			configurable: true
		});
		Object.defineProperty(this, '_scrollIntoViewOptions', {
			value: options,
			writable: true,
			configurable: true
		});
	}

	// Style and layout
	get classList(): MockClassList {
		return this._classList;
	}

	get style(): MockCSSStyleDeclaration {
		return this._style;
	}

	// Utility methods for testing
	getChildrenByClass(className: string): MockHTMLElement[] {
		return this.children.filter(child => child.hasClass(className));
	}

	getChildrenByTag(tagName: string): MockHTMLElement[] {
		return this.children.filter(child => child.tagName.toLowerCase() === tagName.toLowerCase());
	}

	getAllChildren(): MockHTMLElement[] {
		return [...this.children];
	}

	getEventListeners(event: string): Function[] {
		return this.eventListeners.get(event) || [];
	}
}

/**
 * Mock CSS class list implementation.
 */
export class MockClassList {
	private classes: Set<string> = new Set();

	add(className: string): void {
		this.classes.add(className);
	}

	remove(className: string): void {
		this.classes.delete(className);
	}

	contains(className: string): boolean {
		return this.classes.has(className);
	}

	toggle(className: string): boolean {
		if (this.contains(className)) {
			this.remove(className);
			return false;
		} else {
			this.add(className);
			return true;
		}
	}

	toString(): string {
		return Array.from(this.classes).join(' ');
	}
}

/**
 * Mock CSS style declaration implementation.
 */
export class MockCSSStyleDeclaration {
	private styles: Map<string, string> = new Map();

	getPropertyValue(property: string): string {
		return this.styles.get(property) || '';
	}

	setProperty(property: string, value: string): void {
		this.styles.set(property, value);
	}

	removeProperty(property: string): void {
		this.styles.delete(property);
	}

	// Common style properties
	get display(): string {
		return this.getPropertyValue('display');
	}

	set display(value: string) {
		this.setProperty('display', value);
	}

	get width(): string {
		return this.getPropertyValue('width');
	}

	set width(value: string) {
		this.setProperty('width', value);
	}

	get height(): string {
		return this.getPropertyValue('height');
	}

	set height(value: string) {
		this.setProperty('height', value);
	}
}

/**
 * Factory function for creating modal test helpers.
 */
export function createModalTestHelper<T extends Modal>(modal: T): ModalTestHelper<T> {
	return new ModalTestHelper(modal);
}

/**
 * Common test patterns for modal testing.
 */
export const ModalTestPatterns = {
	/**
	 * Tests basic modal lifecycle (open/close).
	 */
	async testModalLifecycle<T extends Modal>(helper: ModalTestHelper<T>): Promise<void> {
		// Test initial state
		expect(helper.isModalOpen()).toBe(false);

		// Test opening
		await helper.openModal();
		expect(helper.isModalOpen()).toBe(true);

		// Test closing
		await helper.closeModal();
		expect(helper.isModalOpen()).toBe(false);
	},

	/**
	 * Tests that modal calls onOpen when opened.
	 */
	async testOnOpenCalled<T extends Modal>(helper: ModalTestHelper<T>): Promise<void> {
		// Access private modal property using a type assertion to access private member
		const modal = (helper as ModalTestHelper<T> & { modal: T }).modal;
		const onOpenSpy = jest.spyOn(modal, 'onOpen');

		await helper.openModal();

		expect(onOpenSpy).toHaveBeenCalled();
	},

	/**
	 * Tests that modal calls onClose when closed.
	 */
	async testOnCloseCalled<T extends Modal>(helper: ModalTestHelper<T>): Promise<void> {
		// Access private modal property using a type assertion to access private member
		const modal = (helper as ModalTestHelper<T> & { modal: T }).modal;
		const onCloseSpy = jest.spyOn(modal, 'onClose');

		await helper.openModal();
		await helper.closeModal();

		expect(onCloseSpy).toHaveBeenCalled();
	},

	/**
	 * Tests button interaction patterns.
	 */
	async testButtonClick<T extends Modal>(
		helper: ModalTestHelper<T>,
		buttonSelector: string,
		expectedAction: () => void
	): Promise<void> {
		await helper.openModal();

		const actionSpy = jest.fn(expectedAction);
		await helper.clickButton(buttonSelector);

		// Note: This is a pattern - actual implementation would depend on the specific modal
		// Users should adapt this pattern for their specific use cases
	},
};
