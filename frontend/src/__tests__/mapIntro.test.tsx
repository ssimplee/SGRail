/**
 * Tests for the first-run map intro dialog.
 *
 * Two things on the map are not self-evident: station dots rest at 0.15
 * opacity so they do not double-draw over the badges printed on the map
 * image, and the locate control is an unlabelled crosshair. Neither has any
 * affordance on touch, where there is no hover and no cursor. The dialog
 * introduces both, once.
 */

import {
  render,
  screen,
  fireEvent,
  renderHook,
  act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MapIntroDialog } from "../components/map/MapIntroDialog";
import { useFirstRunHint } from "../hooks/useFirstRunHint";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { MapPage } from "../pages/MapPage";
import { useMapStore } from "../store/mapStore";
import { STATIONS } from "../data/stations";

const INTRO_KEY = "sgrail.map-intro-seen";

/** Drive matchMedia so reduced-motion can be switched on for a test. */
function mockReducedMotion(enabled: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: enabled && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  window.localStorage.clear();
  useMapStore.getState().selectStation(null);
  mockReducedMotion(false);
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
    const { result } = renderHook(() => useFirstRunHint(INTRO_KEY));
    expect(result.current.visible).toBe(true);
  });

  it("hides and remembers the dismissal", () => {
    const { result } = renderHook(() => useFirstRunHint(INTRO_KEY));
    act(() => result.current.dismiss());

    expect(result.current.visible).toBe(false);
    expect(window.localStorage.getItem(INTRO_KEY)).toBe("1");
  });

  it("stays hidden on a later visit", () => {
    window.localStorage.setItem(INTRO_KEY, "1");
    const { result } = renderHook(() => useFirstRunHint(INTRO_KEY));
    expect(result.current.visible).toBe(false);
  });

  it("keeps rendering when storage is unavailable", () => {
    // Safari private mode throws on access; showing the intro again is a
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

    const { result } = renderHook(() => useFirstRunHint(INTRO_KEY));
    expect(result.current.visible).toBe(true);
    expect(() => act(() => result.current.dismiss())).not.toThrow();
    expect(result.current.visible).toBe(false);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

// ── usePrefersReducedMotion ───────────────────────────────────────────────────

describe("usePrefersReducedMotion", () => {
  it("is false by default", () => {
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("is true when the system asks for reduced motion", () => {
    mockReducedMotion(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });
});

// ── MapIntroDialog ────────────────────────────────────────────────────────────

describe("MapIntroDialog", () => {
  it("introduces both map features", () => {
    render(<MapIntroDialog open onDismiss={() => {}} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/any station$/i)).toBeInTheDocument();
    expect(screen.getByText(/find your nearest station/i)).toBeInTheDocument();
    // Illustrations carry meaning, so they need text alternatives.
    expect(
      screen.getByRole("img", { name: /tapping a station/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /locate button/i }),
    ).toBeInTheDocument();
  });

  it("dismisses on the confirm button", () => {
    const onDismiss = vi.fn();
    render(<MapIntroDialog open onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("renders nothing when closed", () => {
    render(<MapIntroDialog open={false} onDismiss={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("animates by default", () => {
    const { container } = render(<MapIntroDialog open onDismiss={() => {}} />);
    expect(container.ownerDocument.querySelectorAll("animate").length).toBeGreaterThan(0);
  });

  it("drops the animation when reduced motion is requested", () => {
    mockReducedMotion(true);
    render(<MapIntroDialog open onDismiss={() => {}} />);

    // Stills only — no looping <animate> or <animateTransform> anywhere.
    expect(document.querySelectorAll("animate")).toHaveLength(0);
    expect(document.querySelectorAll("animateTransform")).toHaveLength(0);
    // The illustrations are still present and still described.
    expect(
      screen.getByRole("img", { name: /tapping a station/i }),
    ).toBeInTheDocument();
  });
});

// ── MapPage integration ───────────────────────────────────────────────────────

describe("MapPage intro lifecycle", () => {
  it("shows the intro on a first visit", () => {
    renderMapPage();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not show it again once seen", () => {
    window.localStorage.setItem(INTRO_KEY, "1");
    renderMapPage();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("remembers the dismissal", () => {
    renderMapPage();
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(INTRO_KEY)).toBe("1");
  });

  it("retires the intro once a station has been opened", () => {
    renderMapPage();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const bishan = STATIONS.find((s) => s.id === "bishan")!;
    act(() => useMapStore.getState().selectStation(bishan));

    expect(window.localStorage.getItem(INTRO_KEY)).toBe("1");
  });
});
