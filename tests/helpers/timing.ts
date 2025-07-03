/**
 * Timing utilities for stable, deterministic tests
 */

export class MockTimer {
	private currentTime = 1640995200000; // Fixed start time: Jan 1, 2022
	private timers: Map<number, { callback: () => void; time: number }> = new Map();
	private nextTimerId = 1;

	now(): number {
		return this.currentTime;
	}

	advance(ms: number): void {
		const targetTime = this.currentTime + ms;

		// Execute any timers that should fire
		for (const [id, timer] of this.timers) {
			if (timer.time <= targetTime) {
				timer.callback();
				this.timers.delete(id);
			}
		}

		this.currentTime = targetTime;
	}

	setTimeout(callback: () => void, ms: number): number {
		const id = this.nextTimerId++;
		this.timers.set(id, { callback, time: this.currentTime + ms });
		return id;
	}

	clearTimeout(id: number): void {
		this.timers.delete(id);
	}

	reset(): void {
		this.currentTime = 1640995200000;
		this.timers.clear();
		this.nextTimerId = 1;
	}
}

export async function waitForCondition(
	condition: () => boolean | Promise<boolean>,
	timeout = 5000,
	interval = 10
): Promise<void> {
	const start = Date.now();

	while (Date.now() - start < timeout) {
		if (await condition()) {
			return;
		}
		await new Promise(resolve => setTimeout(resolve, interval));
	}

	throw new Error(`Condition not met within ${timeout}ms`);
}

export async function flushPromises(): Promise<void> {
	await new Promise(resolve => setImmediate(resolve));
}

export function createDeterministicTimeRange(): {
	startTime: number;
	advance: (ms: number) => number;
	getElapsed: () => number;
} {
	let currentTime = 1640995200000;
	const startTime = currentTime;

	return {
		startTime,
		advance: (ms: number) => {
			currentTime += ms;
			return currentTime;
		},
		getElapsed: () => currentTime - startTime,
	};
}
