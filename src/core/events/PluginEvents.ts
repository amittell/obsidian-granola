export interface PluginEventMap {
        'plugin:initialized': void;
        'vault:indexer:initialized': { timestamp: number };
        'vault:indexer:updated': { progress: number };
        'cost-tracker:updated': { total: number };
        'cost-tracker:reset': void;
}

type EventHandler<T> = (payload: T) => void | Promise<void>;

export interface PluginEventSubscription {
        unsubscribe(): void;
}

/**
 * Lightweight typed event emitter for orchestrating plugin subsystems.
 */
export class PluginEvents {
        private readonly handlers = new Map<keyof PluginEventMap, Set<EventHandler<unknown>>>();

        subscribe<K extends keyof PluginEventMap>(event: K, handler: EventHandler<PluginEventMap[K]>): PluginEventSubscription {
                const handlerSet = this.getHandlerSet(event);
                handlerSet.add(handler as EventHandler<unknown>);
                return {
                        unsubscribe: () => {
                                this.unsubscribe(event, handler);
                        },
                };
        }

        subscribeOnce<K extends keyof PluginEventMap>(
                event: K,
                handler: EventHandler<PluginEventMap[K]>
        ): PluginEventSubscription {
                const subscription = this.subscribe(event, async (payload) => {
                        try {
                                await handler(payload);
                        } finally {
                                subscription.unsubscribe();
                        }
                });
                return subscription;
        }

        async emit<K extends keyof PluginEventMap>(
                event: K,
                ...[payload]: PluginEventMap[K] extends void
                        ? [payload?: PluginEventMap[K]]
                        : [payload: PluginEventMap[K]]
        ): Promise<void> {
                const handlerSet = this.handlers.get(event);
                if (!handlerSet || handlerSet.size === 0) {
                        return;
                }

                const handlers = Array.from(handlerSet) as EventHandler<PluginEventMap[K]>[];
                await Promise.all(
                        handlers.map(async (handler) => {
                                await handler(payload as PluginEventMap[K]);
                        })
                );
        }

        unsubscribe<K extends keyof PluginEventMap>(event: K, handler: EventHandler<PluginEventMap[K]>): void {
                const handlerSet = this.handlers.get(event);
                if (!handlerSet) {
                        return;
                }

                handlerSet.delete(handler as EventHandler<unknown>);
                if (handlerSet.size === 0) {
                        this.handlers.delete(event);
                }
        }

        clearAll(): void {
                this.handlers.clear();
        }

        createScope(): PluginEventScope {
                return new PluginEventScope(this);
        }

        private getHandlerSet<K extends keyof PluginEventMap>(event: K): Set<EventHandler<unknown>> {
                if (!this.handlers.has(event)) {
                        this.handlers.set(event, new Set());
                }

                return this.handlers.get(event)!;
        }
}

/**
 * Utility for managing grouped subscriptions with automatic disposal.
 */
export class PluginEventScope {
        private readonly subscriptions = new Set<PluginEventSubscription>();

        constructor(private readonly events: PluginEvents) {}

        on<K extends keyof PluginEventMap>(event: K, handler: EventHandler<PluginEventMap[K]>): PluginEventSubscription {
                const subscription = this.events.subscribe(event, handler);
                const scopedSubscription: PluginEventSubscription = {
                        unsubscribe: () => {
                                this.subscriptions.delete(scopedSubscription);
                                subscription.unsubscribe();
                        },
                };
                this.subscriptions.add(scopedSubscription);
                return scopedSubscription;
        }

        once<K extends keyof PluginEventMap>(event: K, handler: EventHandler<PluginEventMap[K]>): PluginEventSubscription {
                const subscription = this.events.subscribeOnce(event, handler);
                const scopedSubscription: PluginEventSubscription = {
                        unsubscribe: () => {
                                this.subscriptions.delete(scopedSubscription);
                                subscription.unsubscribe();
                        },
                };
                this.subscriptions.add(scopedSubscription);
                return scopedSubscription;
        }

        dispose(): void {
                for (const subscription of this.subscriptions) {
                        subscription.unsubscribe();
                }
                this.subscriptions.clear();
        }
}

/**
 * Stub adapter for wiring the vault indexer to the shared event bus.
 */
export class VaultIndexerEventsAdapter {
        private readonly scope: PluginEventScope;

        constructor(events: PluginEvents) {
                this.scope = events.createScope();
                this.register();
        }

        dispose(): void {
                this.scope.dispose();
        }

        private register(): void {
                this.scope.on('vault:indexer:initialized', this.handleInitialized);
                this.scope.on('vault:indexer:updated', this.handleUpdated);
        }

        // Placeholder handlers for future implementations
        private readonly handleInitialized = async (_payload: PluginEventMap['vault:indexer:initialized']) => {
                return;
        };

        private readonly handleUpdated = async (_payload: PluginEventMap['vault:indexer:updated']) => {
                return;
        };
}

/**
 * Stub adapter for wiring the cost tracker to the shared event bus.
 */
export class CostTrackerEventsAdapter {
        private readonly scope: PluginEventScope;

        constructor(events: PluginEvents) {
                this.scope = events.createScope();
                this.register();
        }

        dispose(): void {
                this.scope.dispose();
        }

        private register(): void {
                this.scope.on('cost-tracker:updated', this.handleUpdated);
                this.scope.on('cost-tracker:reset', this.handleReset);
        }

        private readonly handleUpdated = async (_payload: PluginEventMap['cost-tracker:updated']) => {
                return;
        };

        private readonly handleReset = async (_payload: PluginEventMap['cost-tracker:reset']) => {
                return;
        };
}
