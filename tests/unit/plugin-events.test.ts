import {
	PluginEvents,
	PluginEventScope,
	VaultIndexerEventsAdapter,
	CostTrackerEventsAdapter,
} from '../../src/core/events/PluginEvents';

describe('PluginEvents', () => {
	it('notifies subscribers with typed payloads', async () => {
		const events = new PluginEvents();
		const handler = jest.fn();

		events.subscribe('cost-tracker:updated', handler);
		await events.emit('cost-tracker:updated', { total: 42 });

		expect(handler).toHaveBeenCalledWith({ total: 42 });
	});

	it('supports one-time subscriptions', async () => {
		const events = new PluginEvents();
		const handler = jest.fn();

		events.subscribeOnce('vault:indexer:updated', handler);
		await events.emit('vault:indexer:updated', { progress: 0.5 });
		await events.emit('vault:indexer:updated', { progress: 0.9 });

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith({ progress: 0.5 });
	});

	it('clears subscriptions via scopes and clearAll', async () => {
		const events = new PluginEvents();
		const scope = new PluginEventScope(events);
		const handler = jest.fn();

		scope.on('plugin:initialized', handler);
		await events.emit('plugin:initialized');
		expect(handler).toHaveBeenCalledTimes(1);

		scope.dispose();
		await events.emit('plugin:initialized');
		expect(handler).toHaveBeenCalledTimes(1);

		const anotherHandler = jest.fn();
		events.subscribe('cost-tracker:reset', anotherHandler);
		events.clearAll();
		await events.emit('cost-tracker:reset');
		expect(anotherHandler).not.toHaveBeenCalled();
	});

	it('removes scoped subscriptions when manually unsubscribed', async () => {
		const events = new PluginEvents();
		const scope = new PluginEventScope(events);
		const handler = jest.fn();

		const subscription = scope.on('cost-tracker:reset', handler);
		subscription.unsubscribe();

		await events.emit('cost-tracker:reset');

		expect(handler).not.toHaveBeenCalled();

		scope.dispose();
	});
});

describe('Plugin event adapters', () => {
	it('registers vault indexer adapter handlers when constructed', async () => {
		const events = new PluginEvents();
		const subscribeSpy = jest.spyOn(events, 'subscribe');

		const adapter = new VaultIndexerEventsAdapter(events);

		expect(subscribeSpy).toHaveBeenCalledWith(
			'vault:indexer:initialized',
			(adapter as unknown as { handleInitialized: unknown }).handleInitialized
		);
		expect(subscribeSpy).toHaveBeenCalledWith(
			'vault:indexer:updated',
			(adapter as unknown as { handleUpdated: unknown }).handleUpdated
		);

		const registeredHandler = subscribeSpy.mock.calls[0][1] as (
			payload: unknown
		) => Promise<void>;
		await expect(registeredHandler({ timestamp: Date.now() })).resolves.toBeUndefined();

		adapter.dispose();
		subscribeSpy.mockRestore();
	});

	it('registers cost tracker adapter handlers when constructed', async () => {
		const events = new PluginEvents();
		const subscribeSpy = jest.spyOn(events, 'subscribe');

		const adapter = new CostTrackerEventsAdapter(events);

		expect(subscribeSpy).toHaveBeenCalledWith(
			'cost-tracker:updated',
			(adapter as unknown as { handleUpdated: unknown }).handleUpdated
		);
		expect(subscribeSpy).toHaveBeenCalledWith(
			'cost-tracker:reset',
			(adapter as unknown as { handleReset: unknown }).handleReset
		);

		const registeredHandler = subscribeSpy.mock.calls.find(
			([event]) => event === 'cost-tracker:reset'
		)?.[1] as (payload: unknown) => Promise<void>;
		if (registeredHandler) {
			await expect(registeredHandler(undefined)).resolves.toBeUndefined();
		}

		adapter.dispose();
		subscribeSpy.mockRestore();
	});
});
