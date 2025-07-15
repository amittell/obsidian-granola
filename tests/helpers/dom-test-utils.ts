/**
 * DOM testing utilities for enhanced UI component testing.
 *
 * This module provides comprehensive DOM manipulation and testing utilities
 * specifically designed for complex Obsidian UI component testing scenarios.
 *
 * @module DOMTestUtils
 * @since 1.1.0
 */

import { jest } from '@jest/globals';

/**
 * Enhanced DOM testing utilities for complex UI interactions.
 */
export class DOMTestUtils {
	/**
	 * Simulates user typing with realistic timing and events.
	 */
	static async simulateTyping(
		element: HTMLElement,
		text: string,
		options: {
			delay?: number;
			triggerEvents?: boolean;
		} = {}
	): Promise<void> {
		const { delay = 50, triggerEvents = true } = options;

		if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
			let currentValue = element.value || '';

			for (const char of text) {
				currentValue += char;
				element.value = currentValue;

				if (triggerEvents) {
					// Trigger input event
					element.dispatchEvent(new Event('input', { bubbles: true }));

					// Small delay between characters for realism
					if (delay > 0) {
						await new Promise(resolve => setTimeout(resolve, delay));
					}
				}
			}

			if (triggerEvents) {
				// Trigger change event after all typing is complete
				element.dispatchEvent(new Event('change', { bubbles: true }));
			}
		}
	}

	/**
	 * Simulates a realistic click with proper event sequence.
	 */
	static async simulateClick(
		element: HTMLElement,
		options: {
			button?: number;
			ctrlKey?: boolean;
			shiftKey?: boolean;
			altKey?: boolean;
			metaKey?: boolean;
			delay?: number;
		} = {}
	): Promise<void> {
		const {
			button = 0,
			ctrlKey = false,
			shiftKey = false,
			altKey = false,
			metaKey = false,
			delay = 0,
		} = options;

		const eventOptions = {
			button,
			buttons: 1,
			ctrlKey,
			shiftKey,
			altKey,
			metaKey,
			bubbles: true,
			cancelable: true,
		};

		// Simulate complete click sequence
		element.dispatchEvent(new MouseEvent('mousedown', eventOptions));

		if (delay > 0) {
			await new Promise(resolve => setTimeout(resolve, delay));
		}

		element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
		element.dispatchEvent(new MouseEvent('click', eventOptions));
	}

	/**
	 * Simulates keyboard interactions with proper key sequences.
	 */
	static async simulateKeyboard(
		element: HTMLElement,
		key: string,
		options: {
			ctrlKey?: boolean;
			shiftKey?: boolean;
			altKey?: boolean;
			metaKey?: boolean;
			keyCode?: number;
		} = {}
	): Promise<void> {
		const {
			ctrlKey = false,
			shiftKey = false,
			altKey = false,
			metaKey = false,
			keyCode,
		} = options;

		const eventOptions = {
			key,
			code: key,
			keyCode: keyCode || this.getKeyCode(key),
			ctrlKey,
			shiftKey,
			altKey,
			metaKey,
			bubbles: true,
			cancelable: true,
		};

		element.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
		element.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
		element.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
	}

	/**
	 * Waits for an element to appear in the DOM with a timeout.
	 */
	static async waitForElement(
		selector: string,
		options: {
			timeout?: number;
			parent?: HTMLElement;
			visible?: boolean;
		} = {}
	): Promise<HTMLElement> {
		const { timeout = 5000, parent = document.body, visible = true } = options;
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			const element = parent.querySelector(selector);
			if (!(element instanceof HTMLElement)) continue;

			if (element) {
				if (visible) {
					const style = window.getComputedStyle(element);
					if (
						style.display !== 'none' &&
						style.visibility !== 'hidden' &&
						style.opacity !== '0'
					) {
						return element;
					}
				} else {
					return element;
				}
			}

			await new Promise(resolve => setTimeout(resolve, 50));
		}

		throw new Error(`Element not found within ${timeout}ms: ${selector}`);
	}

	/**
	 * Waits for an element to disappear from the DOM.
	 */
	static async waitForElementToDisappear(
		selector: string,
		options: {
			timeout?: number;
			parent?: HTMLElement;
		} = {}
	): Promise<void> {
		const { timeout = 5000, parent = document.body } = options;
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			const element = parent.querySelector(selector);

			if (!element) {
				return;
			}

			// Check if element is hidden
			if (element instanceof HTMLElement) {
				const style = window.getComputedStyle(element);
				if (
					style.display === 'none' ||
					style.visibility === 'hidden' ||
					style.opacity === '0'
				) {
					return;
				}
			}

			await new Promise(resolve => setTimeout(resolve, 50));
		}

		throw new Error(`Element still visible after ${timeout}ms: ${selector}`);
	}

	/**
	 * Waits for text content to appear in an element.
	 */
	static async waitForText(
		selector: string,
		expectedText: string,
		options: {
			timeout?: number;
			parent?: HTMLElement;
			exact?: boolean;
		} = {}
	): Promise<HTMLElement> {
		const { timeout = 5000, parent = document.body, exact = false } = options;
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			const element = parent.querySelector(selector);
			if (!(element instanceof HTMLElement)) continue;

			if (element) {
				const textContent = element.textContent || '';
				const matches = exact
					? textContent === expectedText
					: textContent.includes(expectedText);

				if (matches) {
					return element;
				}
			}

			await new Promise(resolve => setTimeout(resolve, 50));
		}

		throw new Error(`Text not found within ${timeout}ms: "${expectedText}" in ${selector}`);
	}

	/**
	 * Simulates drag and drop operations.
	 */
	static async simulateDragAndDrop(
		source: HTMLElement,
		target: HTMLElement,
		options: {
			dataType?: string;
			data?: string;
			delay?: number;
		} = {}
	): Promise<void> {
		const { dataType = 'text/plain', data = '', delay = 100 } = options;

		// Create drag start event
		const dragStartEvent = new DragEvent('dragstart', {
			bubbles: true,
			cancelable: true,
			dataTransfer: new DataTransfer(),
		});

		if (dragStartEvent.dataTransfer) {
			dragStartEvent.dataTransfer.setData(dataType, data);
		}

		source.dispatchEvent(dragStartEvent);

		if (delay > 0) {
			await new Promise(resolve => setTimeout(resolve, delay));
		}

		// Create drag over event
		target.dispatchEvent(
			new DragEvent('dragover', {
				bubbles: true,
				cancelable: true,
				dataTransfer: dragStartEvent.dataTransfer,
			})
		);

		// Create drop event
		target.dispatchEvent(
			new DragEvent('drop', {
				bubbles: true,
				cancelable: true,
				dataTransfer: dragStartEvent.dataTransfer,
			})
		);

		// Create drag end event
		source.dispatchEvent(
			new DragEvent('dragend', {
				bubbles: true,
				cancelable: true,
				dataTransfer: dragStartEvent.dataTransfer,
			})
		);
	}

	/**
	 * Simulates scroll events with realistic behavior.
	 */
	static simulateScroll(
		element: HTMLElement,
		options: {
			scrollTop?: number;
			scrollLeft?: number;
			smooth?: boolean;
		} = {}
	): void {
		const { scrollTop, scrollLeft, smooth = false } = options;

		if (scrollTop !== undefined) {
			Object.defineProperty(element, 'scrollTop', {
				value: scrollTop,
				writable: true,
			});
		}

		if (scrollLeft !== undefined) {
			Object.defineProperty(element, 'scrollLeft', {
				value: scrollLeft,
				writable: true,
			});
		}

		element.dispatchEvent(new Event('scroll', { bubbles: true }));
	}

	/**
	 * Simulates form submission with validation.
	 */
	static async simulateFormSubmit(
		form: HTMLFormElement,
		options: {
			preventDefault?: boolean;
			validate?: boolean;
		} = {}
	): Promise<boolean> {
		const { preventDefault = false, validate = true } = options;

		if (validate) {
			// Check for required fields
			const requiredElements = form.querySelectorAll('[required]');
			for (const element of requiredElements) {
				if (
					element instanceof HTMLInputElement ||
					element instanceof HTMLSelectElement ||
					element instanceof HTMLTextAreaElement
				) {
					if (!element.value.trim()) {
						element.dispatchEvent(new Event('invalid', { bubbles: false }));
						return false;
					}
				}
			}
		}

		const submitEvent = new Event('submit', { bubbles: true, cancelable: true });

		if (preventDefault) {
			submitEvent.preventDefault();
		}

		form.dispatchEvent(submitEvent);
		return !submitEvent.defaultPrevented;
	}

	/**
	 * Creates a mock ResizeObserver entry for testing.
	 */
	static createMockResizeObserverEntry(
		element: HTMLElement,
		contentRect: DOMRectInit
	): ResizeObserverEntry {
		return {
			target: element,
			contentRect: new DOMRect(
				contentRect.x,
				contentRect.y,
				contentRect.width,
				contentRect.height
			),
			borderBoxSize: [],
			contentBoxSize: [],
			devicePixelContentBoxSize: [],
		} as ResizeObserverEntry;
	}

	/**
	 * Creates a mock IntersectionObserver entry for testing.
	 */
	static createMockIntersectionObserverEntry(
		element: HTMLElement,
		options: {
			intersectionRatio?: number;
			isIntersecting?: boolean;
			boundingClientRect?: DOMRectInit;
			intersectionRect?: DOMRectInit;
			rootBounds?: DOMRectInit;
		} = {}
	): IntersectionObserverEntry {
		const {
			intersectionRatio = 0,
			isIntersecting = false,
			boundingClientRect = { x: 0, y: 0, width: 100, height: 100 },
			intersectionRect = { x: 0, y: 0, width: 0, height: 0 },
			rootBounds = { x: 0, y: 0, width: 1000, height: 1000 },
		} = options;

		return {
			target: element,
			intersectionRatio,
			isIntersecting,
			boundingClientRect: new DOMRect(
				boundingClientRect.x,
				boundingClientRect.y,
				boundingClientRect.width,
				boundingClientRect.height
			),
			intersectionRect: new DOMRect(
				intersectionRect.x,
				intersectionRect.y,
				intersectionRect.width,
				intersectionRect.height
			),
			rootBounds: new DOMRect(
				rootBounds.x,
				rootBounds.y,
				rootBounds.width,
				rootBounds.height
			),
			time: Date.now(),
		} as IntersectionObserverEntry;
	}

	/**
	 * Gets the appropriate key code for a given key string.
	 */
	private static getKeyCode(key: string): number {
		const keyCodes: Record<string, number> = {
			Enter: 13,
			Escape: 27,
			Space: 32,
			ArrowUp: 38,
			ArrowDown: 40,
			ArrowLeft: 37,
			ArrowRight: 39,
			Tab: 9,
			Backspace: 8,
			Delete: 46,
			Home: 36,
			End: 35,
			PageUp: 33,
			PageDown: 34,
			F1: 112,
			F2: 113,
			F3: 114,
			F4: 115,
			F5: 116,
			F6: 117,
			F7: 118,
			F8: 119,
			F9: 120,
			F10: 121,
			F11: 122,
			F12: 123,
		};

		return keyCodes[key] || key.charCodeAt(0);
	}

	/**
	 * Triggers a custom event on an element.
	 */
	static triggerCustomEvent(element: HTMLElement, eventType: string, eventData: any = {}): void {
		const event = new CustomEvent(eventType, {
			detail: eventData,
			bubbles: true,
			cancelable: true,
		});

		element.dispatchEvent(event);
	}

	/**
	 * Flushes all pending promises and timers.
	 */
	static async flushPromises(): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, 0));
	}

	/**
	 * Advances all timers by the specified amount.
	 */
	static async advanceTimers(ms: number): Promise<void> {
		jest.advanceTimersByTime(ms);
		await this.flushPromises();
	}

	/**
	 * Runs all pending timers to completion.
	 */
	static async runAllTimers(): Promise<void> {
		jest.runAllTimers();
		await this.flushPromises();
	}

	/**
	 * Creates a mock DOM element with specified properties.
	 */
	static createMockElement(
		tagName: string,
		options: {
			id?: string;
			className?: string;
			textContent?: string;
			attributes?: Record<string, string>;
			style?: Record<string, string>;
		} = {}
	): HTMLElement {
		const element = document.createElement(tagName);

		if (options.id) {
			element.id = options.id;
		}

		if (options.className) {
			element.className = options.className;
		}

		if (options.textContent) {
			element.textContent = options.textContent;
		}

		if (options.attributes) {
			Object.entries(options.attributes).forEach(([key, value]) => {
				element.setAttribute(key, value);
			});
		}

		if (options.style) {
			Object.entries(options.style).forEach(([key, value]) => {
				(element.style as any)[key] = value;
			});
		}

		return element;
	}

	/**
	 * Asserts that an element has specific text content.
	 */
	static assertTextContent(element: HTMLElement, expectedText: string, exact = false): void {
		const actualText = element.textContent || '';

		if (exact) {
			if (actualText !== expectedText) {
				throw new Error(`Expected exact text "${expectedText}", but got "${actualText}"`);
			}
		} else {
			if (!actualText.includes(expectedText)) {
				throw new Error(
					`Expected text to contain "${expectedText}", but got "${actualText}"`
				);
			}
		}
	}

	/**
	 * Asserts that an element has a specific CSS class.
	 */
	static assertHasClass(element: HTMLElement, className: string): void {
		if (!element.classList.contains(className)) {
			throw new Error(
				`Expected element to have class "${className}", but it doesn't. Classes: ${Array.from(element.classList).join(', ')}`
			);
		}
	}

	/**
	 * Asserts that an element does not have a specific CSS class.
	 */
	static assertNotHasClass(element: HTMLElement, className: string): void {
		if (element.classList.contains(className)) {
			throw new Error(
				`Expected element to not have class "${className}", but it does. Classes: ${Array.from(element.classList).join(', ')}`
			);
		}
	}

	/**
	 * Asserts that an element has a specific attribute value.
	 */
	static assertAttribute(
		element: HTMLElement,
		attributeName: string,
		expectedValue?: string
	): void {
		const actualValue = element.getAttribute(attributeName);

		if (expectedValue === undefined) {
			if (actualValue === null) {
				throw new Error(
					`Expected element to have attribute "${attributeName}", but it doesn't`
				);
			}
		} else {
			if (actualValue !== expectedValue) {
				throw new Error(
					`Expected attribute "${attributeName}" to be "${expectedValue}", but got "${actualValue}"`
				);
			}
		}
	}

	/**
	 * Asserts that an element is visible (not display: none, visibility: hidden, or opacity: 0).
	 */
	static assertVisible(element: HTMLElement): void {
		const style = window.getComputedStyle(element);

		if (style.display === 'none') {
			throw new Error('Expected element to be visible, but display is "none"');
		}

		if (style.visibility === 'hidden') {
			throw new Error('Expected element to be visible, but visibility is "hidden"');
		}

		if (style.opacity === '0') {
			throw new Error('Expected element to be visible, but opacity is "0"');
		}
	}

	/**
	 * Asserts that an element is hidden.
	 */
	static assertHidden(element: HTMLElement): void {
		const style = window.getComputedStyle(element);

		if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
			throw new Error('Expected element to be hidden, but it appears to be visible');
		}
	}
}

// Export utilities for direct use
export const {
	simulateTyping,
	simulateClick,
	simulateKeyboard,
	waitForElement,
	waitForElementToDisappear,
	waitForText,
	simulateDragAndDrop,
	simulateScroll,
	simulateFormSubmit,
	createMockResizeObserverEntry,
	createMockIntersectionObserverEntry,
	triggerCustomEvent,
	flushPromises,
	advanceTimers,
	runAllTimers,
	createMockElement,
	assertTextContent,
	assertHasClass,
	assertNotHasClass,
	assertAttribute,
	assertVisible,
	assertHidden,
} = DOMTestUtils;
