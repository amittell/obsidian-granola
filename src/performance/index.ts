/**
 * Conditional performance monitoring exports.
 *
 * In development: Full performance monitoring and utilities
 * In production: Lightweight stubs and essential utilities only
 */

// Export everything from performance monitor and utils for now
// This will be optimized at build time
export * from './performance-monitor';
export * from './performance-utils';
