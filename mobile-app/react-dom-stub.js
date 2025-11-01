// Stub for react-dom in React Native environment
// Provides minimal API that @react-aria/utils might need

export function flushSync(fn) {
  // In React Native, we can just execute synchronously
  if (typeof fn === 'function') {
    return fn();
  }
  return undefined;
}

// Export other commonly used react-dom functions as no-ops or stubs
export const version = '19.0.0';

// Default export (though typically react-dom uses named exports)
export default {
  flushSync,
  version,
};

