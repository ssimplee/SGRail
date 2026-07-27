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

/**
 * jsdom does not implement matchMedia, which useResponsive subscribes to.
 * Report "does not match" and accept listeners without firing them, so
 * components settle on their desktop layout in tests.
 */
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/**
 * `window.localStorage` arrives here as a bare `{}` rather than a Storage —
 * every method is missing, so anything that persists state throws
 * "storage.setItem is not a function". Install a working in-memory Storage
 * when the real one is unusable.
 */
function createMemoryStorage(): Storage {
  let entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(String(key)) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(String(key), String(value));
    },
    removeItem: (key: string) => {
      entries.delete(String(key));
    },
    clear: () => {
      entries = new Map();
    },
  } as Storage;
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  const existing = globalThis[name] as Partial<Storage> | undefined;
  if (typeof existing?.setItem !== "function") {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: createMemoryStorage(),
    });
  }
}
