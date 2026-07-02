import "@testing-library/jest-dom";
import { vi } from "vitest";

// jsdom does not implement IntersectionObserver — provide a minimal mock
class MockIntersectionObserver {
  constructor(cb) {
    this.cb = cb;
  }
  observe(el) {
    MockIntersectionObserver._instances.push({ observer: this, el });
  }
  disconnect() {}
  unobserve() {}

  // Test helper: fire the callback as if the element became visible
  static triggerVisible() {
    MockIntersectionObserver._instances.forEach(({ observer }) => {
      observer.cb([{ isIntersecting: true }]);
    });
  }
}
MockIntersectionObserver._instances = [];

global.IntersectionObserver = MockIntersectionObserver;
// Re-expose the helper on globalThis so tests can call it
globalThis.triggerScrolledToBottom = () => {
  MockIntersectionObserver._instances = [];
  // will be called after observe() is set up
};
