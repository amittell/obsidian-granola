/**
 * Test isolation utilities to prevent state leakage between tests
 */

// Define global interface for test cleanup functions
declare global {
	var __testCleanupFunctions: Array<() => void> | undefined;
}

export class TestIsolationManager {
	private cleanupFunctions: Array<() => void> = [];

	addCleanup(cleanup: () => void): void {
		this.cleanupFunctions.push(cleanup);
	}

	reset(): void {
		// Execute all cleanup functions
		this.cleanupFunctions.forEach(cleanup => {
			try {
				cleanup();
			} catch (error) {
				console.warn('Cleanup function failed:', error);
			}
		});

		// Clear the cleanup list
		this.cleanupFunctions = [];

		// Reset Jest mocks
		jest.clearAllMocks();
		jest.restoreAllMocks();

		// Clear any setTimeout/setInterval
		jest.clearAllTimers();
	}

	isolateTest(testFn: () => Promise<void> | void): () => Promise<void> {
		return async () => {
			try {
				await testFn();
			} finally {
				this.reset();
			}
		};
	}
}

export function createIsolatedTestSuite(): TestIsolationManager {
	return new TestIsolationManager();
}

export async function waitForAsyncOperations(): Promise<void> {
	// Wait for all promises to resolve
	await new Promise(resolve => setImmediate(resolve));

	// Wait one more tick for any chained promises
	await new Promise(resolve => setImmediate(resolve));
}

export function createMockWithCleanup<T extends (...args: any[]) => any>(
	mockImplementation: T,
	cleanup?: () => void
): jest.MockedFunction<T> {
	const mock = jest.fn().mockImplementation(mockImplementation);

	if (cleanup) {
		// Store cleanup function for later execution
		if (!global.__testCleanupFunctions) {
			global.__testCleanupFunctions = [];
		}
		global.__testCleanupFunctions.push(cleanup);
	}

	return mock;
}

export function resetGlobalTestState(): void {
	// Execute any stored cleanup functions
	if (global.__testCleanupFunctions) {
		global.__testCleanupFunctions.forEach((cleanup) => {
			try {
				cleanup();
			} catch (error) {
				console.warn('Global cleanup failed:', error);
			}
		});
		global.__testCleanupFunctions = [];
	}
}
