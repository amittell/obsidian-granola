import { ServiceContainer } from '../../src/core/di/ServiceContainer';
import { DEFAULT_SETTINGS, GranolaSettings } from '../../src/types';

describe('ServiceContainer', () => {
        it('resolves singleton registrations once', async () => {
                const container = new ServiceContainer();
                let createCount = 0;

                container.registerSingleton('singleton-test', () => {
                        createCount += 1;
                        return { created: createCount };
                });

                const first = await container.resolve('singleton-test');
                const second = await container.resolve('singleton-test');

                expect(first).toBe(second);
                expect(createCount).toBe(1);
        });

        it('provides scoped instances per scope', async () => {
                const container = new ServiceContainer();

                container.registerScoped('scoped-test', () => ({ id: Symbol('scoped') }));

                const scopeA = container.createScope();
                const scopeB = container.createScope();

                const firstScopeInstance = await scopeA.resolve('scoped-test');
                const secondScopeInstance = await scopeA.resolve('scoped-test');
                const otherScopeInstance = await scopeB.resolve('scoped-test');

                expect(firstScopeInstance).toBe(secondScopeInstance);
                expect(firstScopeInstance).not.toBe(otherScopeInstance);
        });

        it('supports asynchronous factories', async () => {
                const container = new ServiceContainer();

                container.registerSingleton('async-test', async () => {
                        await new Promise((resolve) => setTimeout(resolve, 0));
                        return { ready: true };
                });

                const instance = await container.resolve('async-test');
                expect(instance).toEqual({ ready: true });
        });

        it('invokes settings reload hooks for registrations', async () => {
                const container = new ServiceContainer();
                const reloadHook = jest.fn();

                container.registerSingleton('settings-aware', () => ({}), {
                        onSettingsReload: reloadHook,
                });

                const newSettings: GranolaSettings = {
                        ...DEFAULT_SETTINGS,
                        plugin: {
                                ...DEFAULT_SETTINGS.plugin,
                                flags: {
                                        ...DEFAULT_SETTINGS.plugin.flags,
                                        useEventBus: true,
                                },
                        },
                };

                await container.reloadSettings(newSettings);

                expect(reloadHook).toHaveBeenCalledWith(newSettings, container);
        });

        it('propagates reload hooks through scoped containers', async () => {
                const container = new ServiceContainer();
                const reloadHook = jest.fn();

                container.registerScoped('scoped-settings', () => ({}), {
                        onSettingsReload: reloadHook,
                });

                const scope = container.createScope();
                await scope.reloadSettings(DEFAULT_SETTINGS);

                expect(reloadHook).toHaveBeenCalledWith(DEFAULT_SETTINGS, scope);
        });
});
