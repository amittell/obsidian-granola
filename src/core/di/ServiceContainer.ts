import type { GranolaSettings } from '../../types';

export type ServiceIdentifier<T> = string | symbol;
export type ServiceFactory<T> = (container: ServiceContainer) => T | Promise<T>;
export type SettingsReloadHook = (settings: GranolaSettings, container: ServiceContainer) => void | Promise<void>;

type ServiceScope = 'singleton' | 'scoped';

interface ServiceRegistration<T> {
        scope: ServiceScope;
        factory: ServiceFactory<T>;
        onSettingsReload?: SettingsReloadHook;
}

interface RegistrationRecord<T> {
        container: ServiceContainer;
        registration: ServiceRegistration<T>;
}

/**
 * Minimal dependency injection container with support for singleton and scoped services.
 */
export class ServiceContainer {
        private readonly registrations = new Map<ServiceIdentifier<unknown>, ServiceRegistration<unknown>>();
        private readonly singletonCache = new Map<ServiceIdentifier<unknown>, Promise<unknown>>();
        private readonly scopedCache = new Map<ServiceIdentifier<unknown>, Promise<unknown>>();

        constructor(private readonly parent?: ServiceContainer) {}

        registerSingleton<T>(
                identifier: ServiceIdentifier<T>,
                factory: ServiceFactory<T>,
                options: { onSettingsReload?: SettingsReloadHook } = {}
        ): void {
                this.register(identifier, {
                        scope: 'singleton',
                        factory,
                        onSettingsReload: options.onSettingsReload,
                });
        }

        registerScoped<T>(
                identifier: ServiceIdentifier<T>,
                factory: ServiceFactory<T>,
                options: { onSettingsReload?: SettingsReloadHook } = {}
        ): void {
                this.register(identifier, {
                        scope: 'scoped',
                        factory,
                        onSettingsReload: options.onSettingsReload,
                });
        }

        async resolve<T>(identifier: ServiceIdentifier<T>): Promise<T> {
                const record = this.lookup(identifier);
                if (!record) {
                        throw new Error(`Service not registered for identifier: ${identifier.toString()}`);
                }

                const { registration, container } = record as RegistrationRecord<T>;
                if (registration.scope === 'singleton') {
                        return (await container.resolveSingleton(identifier, registration.factory, this)) as T;
                }

                return (await this.resolveScoped(identifier, registration.factory)) as T;
        }

        createScope(): ServiceContainer {
                return new ServiceContainer(this);
        }

        async reloadSettings(settings: GranolaSettings): Promise<void> {
                const visited = new Set<ServiceContainer>();
                for (let current: ServiceContainer | undefined = this; current; current = current.parent) {
                        if (visited.has(current)) {
                                continue;
                        }

                        visited.add(current);

                        for (const registration of current.registrations.values()) {
                                if (registration.onSettingsReload) {
                                        await registration.onSettingsReload(settings, current);
                                }
                        }
                }
        }

        clearSingleton(identifier: ServiceIdentifier<unknown>): void {
                this.singletonCache.delete(identifier);
        }

        clearScoped(): void {
                this.scopedCache.clear();
        }

        private register<T>(identifier: ServiceIdentifier<T>, registration: ServiceRegistration<T>): void {
                if (this.registrations.has(identifier)) {
                        throw new Error(`Service already registered for identifier: ${identifier.toString()}`);
                }

                this.registrations.set(identifier, registration as ServiceRegistration<unknown>);
        }

        private lookup<T>(identifier: ServiceIdentifier<T>): RegistrationRecord<T> | undefined {
                if (this.registrations.has(identifier)) {
                        return {
                                container: this,
                                registration: this.registrations.get(identifier) as ServiceRegistration<T>,
                        };
                }

                if (this.parent) {
                        return this.parent.lookup(identifier);
                }

                return undefined;
        }

        private async resolveSingleton<T>(
                identifier: ServiceIdentifier<T>,
                factory: ServiceFactory<T>,
                requester: ServiceContainer
        ): Promise<T> {
                if (!this.singletonCache.has(identifier)) {
                        const instancePromise = Promise.resolve(factory(requester)).catch((error) => {
                                this.singletonCache.delete(identifier);
                                throw error;
                        });
                        this.singletonCache.set(identifier, instancePromise as Promise<unknown>);
                }

                return (await this.singletonCache.get(identifier)) as T;
        }

        private async resolveScoped<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): Promise<T> {
                if (!this.scopedCache.has(identifier)) {
                        const instancePromise = Promise.resolve(factory(this)).catch((error) => {
                                this.scopedCache.delete(identifier);
                                throw error;
                        });
                        this.scopedCache.set(identifier, instancePromise as Promise<unknown>);
                }

                return (await this.scopedCache.get(identifier)) as T;
        }
}
