/**
 * Tests for the first-run "the map is clickable" hint.
 *
 * Station dots rest at 0.15 opacity so they do not double-draw over the
 * badges printed on the map image, which leaves the map reading as a static
 * picture. On touch there is no hover and no cursor change, so nothing
 * signals that stations are interactive. This hint says it once.
 */

import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MapTapHint } from "../components/map/MapTapHint";
import { useFirstRunHint } from "../hooks/useFirstRunHint";
import { MapPage } from "../pages/MapPage";
import { useMapStore } from "../store/mapStore";
import { STATIONS } from "../data/stations";

const HINT_KEY = "sgrail.map-tap-hint-dismissed";

beforeEach(() => {
  window.localStorage.clear();
  useMapStore.getState().selectStation(null);
});

/** MapPage needs a router (nav links) and a query client (station panel). */
function renderMapPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── useFirstRunHint ───────────────────────────────────────────────────────────

describe("useFirstRunHint", () => {
  it("is visible on a first visit", () => {
    const { result } = renderHook(() => useFirstRunHint(HINT_KEY));
    expect(result.current.visible).toBe(true);
  });

  it("hides and remembers the dismissal", () => {
    const { result } = renderHook(() => useFirstRunHint(HINT_KEY));
    act(() => result.current.dismiss());

    expect(result.current.visible).toBe(false);
    expect(window.localStorage.getItem(HINT_KEY)).toBe("1");
  });

  it("stays hidden on a later visit", () => {
    window.localStorage.setItem(HINT_KEY, "1");
    const { result } = renderHook(() => useFirstRunHint(HINT_KEY));
    expect(result.current.visible).toBe(false);
  });

  it("keeps rendering when storage is unavailable", () => {
    // Safari private mode throws on access; showing the hint again is a
    // better failure than crashing the page.
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });

    const { result } = renderHook(() => useFirstRunHint(HINT_KEY));
    expect(result.current.visible).toBe(true);
    expect(() => act(() => result.current.dismiss())).not.toThrow();
    expect(result.current.visible).toBe(false);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

// ── MapTapHint ────────────────────────────────────────────────────────────────

describe("MapTapHint", () => {
  it("names the interaction and calls back when dismissed", () => {
    const onDismiss = vi.fn();
    render(<MapTapHint onDismiss={onDismiss} />);

    expect(screen.getByRole("status", { name: /map hint/i })).toHaveTextContent(
      /any station for arrivals, timings and crowd/i,
    );

    fireEvent.click(screen.getByRole("button", { name: /dismiss map hint/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

// ── MapPage integration ───────────────────────────────────────────────────────

describe("MapPage hint lifecycle", () => {
  it("shows the hint on a first visit", () => {
    renderMapPage();
    expect(screen.getByRole("status", { name: /map hint/i })).toHaveTextContent(/any station/i);
  });

  it("does not show it again once dismissed", () => {
    window.localStorage.setItem(HINT_KEY, "1");
    renderMapPage();
    expect(screen.queryByRole("status", { name: /map hint/i })).not.toBeInTheDocument();
  });

  it("retires the hint once a station has been opened", () => {
    renderMapPage();
    expect(screen.getByRole("status", { name: /map hint/i })).toBeInTheDocument();

    const bishan = STATIONS.find((s) => s.id === "bishan")!;
    act(() => useMapStore.getState().selectStation(bishan));

    expect(screen.queryByRole("status", { name: /map hint/i })).not.toBeInTheDocument();
    // ...and stays gone on the next visit.
    expect(window.localStorage.getItem(HINT_KEY)).toBe("1");
  });
});
