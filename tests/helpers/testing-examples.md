# Enhanced Testing Infrastructure Examples

This document provides comprehensive examples of how to use the enhanced testing infrastructure for complex UI component testing.

## Modal Testing Examples

### Basic Modal Lifecycle Testing

```typescript
import { DocumentSelectionModal } from '../../src/ui/document-selection-modal';
import { ModalTestHelper, createModalTestHelper } from '../helpers/modal-test-helper';
import { mockApp, mockVault } from '../__mocks__/obsidian';

describe('DocumentSelectionModal', () => {
  let modal: DocumentSelectionModal;
  let helper: ModalTestHelper<DocumentSelectionModal>;

  beforeEach(() => {
    // Setup mock dependencies
    const mockAPI = createMockGranolaAPI();
    const mockDuplicateDetector = createMockDuplicateDetector();
    const mockMetadataService = createMockMetadataService();
    const mockImportManager = createMockImportManager();
    const mockConverter = createMockConverter();

    modal = new DocumentSelectionModal(
      mockApp,
      mockAPI,
      mockDuplicateDetector,
      mockMetadataService,
      mockImportManager,
      mockConverter
    );

    helper = createModalTestHelper(modal);
  });

  it('should open and close properly', async () => {
    // Test modal lifecycle
    expect(helper.isModalOpen()).toBe(false);

    await helper.openModal();
    expect(helper.isModalOpen()).toBe(true);

    await helper.closeModal();
    expect(helper.isModalOpen()).toBe(false);
  });

  it('should handle button interactions', async () => {
    await helper.openModal();

    // Test button click
    await helper.clickButton('.refresh-button');

    // Assert that refresh was called
    expect(mockAPI.getAllDocuments).toHaveBeenCalled();
  });

  it('should handle search input', async () => {
    await helper.openModal();

    // Type in search input
    await helper.typeInInput('.search-input', 'test query');

    // Wait for filtered results
    await helper.waitForText('.document-stats', 'Showing 5 of 10 documents');
  });

  it('should handle document selection', async () => {
    await helper.openModal();

    // Select documents
    await helper.toggleCheckbox('.document-checkbox[data-document-id="123"]', true);

    // Verify button state update
    helper.assertElementText('.import-button', 'Import Selected (1)');
    helper.assertButtonState('.import-button', true);
  });
});
```

### Advanced Modal Testing with Progress

```typescript
it('should show import progress correctly', async () => {
  await helper.openModal();

  // Select documents and start import
  await helper.toggleCheckbox('.document-checkbox', true);
  await helper.clickButton('.import-button');

  // Wait for progress view to appear
  await helper.waitForElement('.progress-container');
  helper.assertElementExists('.progress-bar');

  // Simulate progress updates
  await helper.simulateProgress(
    progress => {
      // Progress callback would be called by import manager
      const progressFill = helper.query('.progress-fill');
      progressFill?.style.setProperty('width', `${progress}%`);
    },
    10,
    100
  );

  // Wait for completion
  await helper.waitForText('.import-summary', 'Import Complete!');
  helper.assertElementExists('.import-complete-buttons');
});
```

## DOM Utilities Examples

### Complex User Interactions

```typescript
import { DOMTestUtils } from '../helpers/dom-test-utils';

describe('Complex UI Interactions', () => {
  it('should handle realistic typing simulation', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    await DOMTestUtils.simulateTyping(input, 'Hello World', {
      delay: 30, // 30ms between characters
      triggerEvents: true,
    });

    expect(input.value).toBe('Hello World');
  });

  it('should handle drag and drop operations', async () => {
    const source = DOMTestUtils.createMockElement('div', {
      id: 'source',
      textContent: 'Drag me',
    });

    const target = DOMTestUtils.createMockElement('div', {
      id: 'target',
      className: 'drop-zone',
    });

    document.body.appendChild(source);
    document.body.appendChild(target);

    let dropData = '';
    target.addEventListener('drop', e => {
      dropData = e.dataTransfer?.getData('text/plain') || '';
    });

    await DOMTestUtils.simulateDragAndDrop(source, target, {
      dataType: 'text/plain',
      data: 'dragged-content',
    });

    expect(dropData).toBe('dragged-content');
  });

  it('should wait for elements with timeout', async () => {
    // Simulate async element creation
    setTimeout(() => {
      const element = DOMTestUtils.createMockElement('div', {
        className: 'async-element',
        textContent: 'I appeared!',
      });
      document.body.appendChild(element);
    }, 100);

    const element = await DOMTestUtils.waitForElement('.async-element', {
      timeout: 1000,
    });

    DOMTestUtils.assertTextContent(element, 'I appeared!');
  });
});
```

### Form Testing

```typescript
it('should handle complex form interactions', async () => {
  const form = document.createElement('form');
  const emailInput = DOMTestUtils.createMockElement('input', {
    attributes: { type: 'email', required: 'true', name: 'email' },
  }) as HTMLInputElement;

  const submitButton = DOMTestUtils.createMockElement('button', {
    attributes: { type: 'submit' },
    textContent: 'Submit',
  });

  form.appendChild(emailInput);
  form.appendChild(submitButton);
  document.body.appendChild(form);

  // Test validation failure
  let submitResult = await DOMTestUtils.simulateFormSubmit(form);
  expect(submitResult).toBe(false); // Should fail validation

  // Fill in required field
  await DOMTestUtils.simulateTyping(emailInput, 'test@example.com');

  // Test successful submission
  submitResult = await DOMTestUtils.simulateFormSubmit(form);
  expect(submitResult).toBe(true);
});
```

## Advanced Obsidian API Mocking

### Vault Operations Testing

```typescript
import { mockVault, mockWorkspace, TFile } from '../__mocks__/obsidian';

describe('Vault Operations', () => {
  beforeEach(() => {
    mockVault.clear();
    mockWorkspace.clear();
  });

  it('should create files correctly', async () => {
    const file = await mockVault.create('test.md', '# Test Content');

    expect(file).toBeInstanceOf(TFile);
    expect(file.path).toBe('test.md');
    expect(mockVault.getMockFileContent('test.md')).toBe('# Test Content');
  });

  it('should handle file reading', async () => {
    // Add mock file
    mockVault.addMockFile('existing.md', '# Existing Content');

    const file = new TFile('existing.md');
    const content = await mockVault.read(file);

    expect(content).toBe('# Existing Content');
  });

  it('should simulate workspace operations', async () => {
    const file = new TFile('document.md');
    mockVault.addMockFile('document.md', '# Document');

    // Create leaf and open file
    const leaf = mockWorkspace.getLeaf('tab');
    await leaf.openFile(file);

    expect(leaf.view).toBeDefined();
    expect(leaf.view?.file).toBe(file);

    // Verify workspace state
    const markdownLeaves = mockWorkspace.getLeavesOfType('markdown');
    expect(markdownLeaves).toHaveLength(1);
  });
});
```

### Button and Input Component Testing

```typescript
import { ButtonComponent, TextComponent } from '../__mocks__/obsidian';
import { MockHTMLElement } from '../helpers/modal-test-helper';

describe('UI Components', () => {
  it('should test ButtonComponent interactions', () => {
    const container = new MockHTMLElement('div');
    const button = new ButtonComponent(container);

    let clicked = false;
    button
      .setButtonText('Click Me')
      .setCta()
      .onClick(() => {
        clicked = true;
      });

    expect(button.getButtonText()).toBe('Click Me');
    expect(button.isButtonDisabled()).toBe(false);

    // Simulate click
    button.simulateClick();
    expect(clicked).toBe(true);

    // Test disabled state
    button.setDisabled(true);
    clicked = false;
    button.simulateClick();
    expect(clicked).toBe(false); // Should not trigger when disabled
  });

  it('should test TextComponent interactions', () => {
    const container = new MockHTMLElement('div');
    const textInput = new TextComponent(container);

    let lastValue = '';
    textInput.setPlaceholder('Enter text...').onChange(value => {
      lastValue = value;
    });

    expect(textInput.getPlaceholder()).toBe('Enter text...');

    // Simulate input
    textInput.simulateInput('Hello World');
    expect(textInput.getValue()).toBe('Hello World');
    expect(lastValue).toBe('Hello World');
  });
});
```

## Performance and Timer Testing

### Async Operation Testing

```typescript
describe('Performance Testing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should test debounced operations', async () => {
    const debouncedFn = jest.fn();
    const debounce = (fn: Function, delay: number) => {
      let timeoutId: NodeJS.Timeout;
      return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
      };
    };

    const debouncedCall = debounce(debouncedFn, 300);

    // Multiple rapid calls
    debouncedCall('call1');
    debouncedCall('call2');
    debouncedCall('call3');

    // Should not have been called yet
    expect(debouncedFn).not.toHaveBeenCalled();

    // Advance timers
    await DOMTestUtils.advanceTimers(300);

    // Should have been called once with last value
    expect(debouncedFn).toHaveBeenCalledTimes(1);
    expect(debouncedFn).toHaveBeenCalledWith('call3');
  });

  it('should test animation frame timing', async () => {
    const animationCallback = jest.fn();

    requestAnimationFrame(animationCallback);

    // Should not be called immediately
    expect(animationCallback).not.toHaveBeenCalled();

    // Advance by one frame (16ms)
    await DOMTestUtils.advanceTimers(16);

    expect(animationCallback).toHaveBeenCalledTimes(1);
  });
});
```

## Error Handling and Edge Cases

### Robust Error Testing

```typescript
describe('Error Handling', () => {
  it('should handle modal errors gracefully', async () => {
    const modal = new DocumentSelectionModal(/* ... */);
    const helper = createModalTestHelper(modal);

    // Mock API to throw error
    jest.spyOn(mockAPI, 'getAllDocuments').mockRejectedValue(new Error('Network error'));

    await helper.openModal();

    // Should show error message
    await helper.waitForText('.error-message', 'Failed to load documents: Network error');

    // Modal should still be functional
    expect(helper.isModalOpen()).toBe(true);
  });

  it('should handle promise rejections', async () => {
    const errorHandler = jest.fn();
    process.on('unhandledRejection', errorHandler);

    // This should be caught by the test setup
    Promise.reject(new Error('Unhandled error'));

    await DOMTestUtils.flushPromises();

    // The test setup should catch this and fail the test
    // This is just an example of how error handling works
  });
});
```

## Best Practices

### 1. Always Clean Up

```typescript
afterEach(() => {
  // Clean up DOM
  document.body.innerHTML = '';

  // Clear mocks
  jest.clearAllMocks();

  // Clean up timers
  global.cleanupTimers();
});
```

### 2. Use Realistic Delays

```typescript
// Good: Realistic user interaction timing
await DOMTestUtils.simulateTyping(input, 'text', { delay: 50 });

// Avoid: Unrealistic instant interactions that don't catch timing bugs
input.value = 'text';
```

### 3. Test Both Success and Failure Cases

```typescript
it('should handle both success and error states', async () => {
  // Test success case
  mockAPI.getAllDocuments.mockResolvedValue([
    /* documents */
  ]);
  await helper.openModal();
  helper.assertElementExists('.document-list');

  // Reset and test error case
  await helper.closeModal();
  mockAPI.getAllDocuments.mockRejectedValue(new Error('API Error'));
  await helper.openModal();
  helper.assertElementExists('.error-message');
});
```

### 4. Use Specific Selectors

```typescript
// Good: Specific, meaningful selectors
helper.assertElementExists('[data-testid="import-progress-bar"]');

// Avoid: Generic selectors that might match multiple elements
helper.assertElementExists('.progress');
```

This enhanced testing infrastructure provides comprehensive tools for testing complex UI components with realistic user interactions, proper error handling, and maintainable test patterns.
