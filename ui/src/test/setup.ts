import '@testing-library/jest-dom';

// Mock environment variables
global.process = {
  ...global.process,
  env: {
    ...global.process?.env,
    NODE_ENV: 'test',
  },
};

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});