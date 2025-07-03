/**
 * Global declarations for constants injected by esbuild during build process
 */

declare const ENABLE_PERFORMANCE_MONITORING: boolean;
declare const PERFORMANCE_MONITORING_ENABLED: boolean;
declare const DEBUG: boolean;
declare const __DEV__: boolean;

declare namespace NodeJS {
	interface ProcessEnv {
		NODE_ENV: 'development' | 'production';
	}
}
