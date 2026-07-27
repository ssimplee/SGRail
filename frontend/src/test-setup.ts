import "@testing-library/jest-dom";

/**
 * jsdom implements neither ResizeObserver nor scrollIntoView, both of which are
 * used by libraries we render in component tests (react-zoom-pan-pinch measures
 * the map viewport, Radix and cmdk measure and scroll their popovers). Stub
 * them so rendering does not throw; no test depends on real measurements.
 */
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
