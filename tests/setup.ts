/**
 * Jest test setup file
 * Configures global test environment and mocks
 */

// Mock fetch globally for Node.js environment
global.fetch = jest.fn();