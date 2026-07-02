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

// jsdom does not implement EventSource — provide a controllable mock.
class MockEventSource {
  constructor(url) {
    this.url       = url;
    this.readyState = 1; // OPEN
    MockEventSource._instances.push(this);
  }
  close() { this.readyState = 2; }

  // Static helpers for tests
  static _instances = [];
  static reset() { MockEventSource._instances = []; }

  /** Fire a message event on all open EventSource instances. */
  static fireMessage(payload) {
    MockEventSource._instances.forEach((es) => {
      if (es.onmessage) es.onmessage({ data: JSON.stringify(payload) });
    });
  }

  /** Simulate a connection error on all open instances. */
  static fireError() {
    MockEventSource._instances.forEach((es) => {
      if (es.onerror) es.onerror(new Event("error"));
    });
  }
}

global.EventSource = MockEventSource;

