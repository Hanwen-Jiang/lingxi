import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia. HeroUI Pro's Sheet (and our
// useMediaQuery hook) call it at module import time, so we have to stub it
// before any component is loaded.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom doesn't implement scrollIntoView either; HeroUI components call it
// when opening popovers/sheets in tests.
if (typeof window !== "undefined" && !(Element.prototype as Element & {scrollIntoView?: () => void}).scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// jsdom doesn't implement ResizeObserver; HeroUI's ScrollShadow watches the
// content size with one.
if (typeof window !== "undefined" && typeof (globalThis as {ResizeObserver?: unknown}).ResizeObserver !== "function") {
  class StubResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as {ResizeObserver?: unknown}).ResizeObserver = StubResizeObserver;
}
