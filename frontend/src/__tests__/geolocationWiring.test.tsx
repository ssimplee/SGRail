/**
 * Wiring tests for GPS nearest-station detection.
 *
 * The individual pieces (useCurrentLocation, findNearestStations,
 * NearestStationInfo, NearestStationMarker, MapControls' locate button) all
 * existed and worked in isolation, but nothing connected them: the locate
 * button never rendered, SVGOverlay never received nearestStationId, the info
 * card was imported by nobody, and the route form sent the literal string
 * "current-location" as an origin station id.
 *
 * These tests assert the connections, not the maths — haversine and
 * findNearestStations are covered by haversine.property.test.ts.
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";

import { MRTMapComponent } from "../components/map/MRTMapComponent";
import { MapControls } from "../components/map/MapControls";
import { LocationErrorCard } from "../components/map/LocationErrorCard";
import { RouteInputForm } from "../components/route/RouteInputForm";
import { useMapStore } from "../store/mapStore";

// Bishan's exact coordinates, so the nearest station is unambiguous.
const BISHAN = { latitude: 1.3513, longitude: 103.8491 };

/** Error codes as defined by the Geolocation API */
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

interface MockCoords {
  latitude: number;
  longitude: number;
}

let getCurrentPosition: ReturnType<typeof vi.fn>;

/** Make navigator.geolocation succeed with the given coordinates. */
function grantLocation(coords: MockCoords, accuracy = 20) {
  getCurrentPosition.mockImplementation((onSuccess: (p: unknown) => void) => {
    onSuccess({
      coords: { ...coords, accuracy, heading: null, speed: null },
      timestamp: 1_700_000_000_000,
    });
  });
}

/** Make navigator.geolocation fail with the given error code. */
function denyLocation(code: number) {
  getCurrentPosition.mockImplementation(
    (_onSuccess: unknown, onError: (e: unknown) => void) => {
      onError({ code, PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT });
    },
  );
}

beforeEach(() => {
  getCurrentPosition = vi.fn();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    writable: true,
    value: {
      getCurrentPosition,
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
  });
  // The map store is a module-level singleton shared between tests.
  useMapStore.getState().selectStation(null);
});

/** Press the map's locate button. */
function clickLocate() {
  fireEvent.click(screen.getByRole("button", { name: /locate me/i }));
}

// ── MapControls ───────────────────────────────────────────────────────────────

describe("MapControls locate button", () => {
  const noop = () => {};

  it("does not render the locate button when onLocateMe is omitted", () => {
    render(<MapControls onZoomIn={noop} onZoomOut={noop} onReset={noop} />);
    expect(
      screen.queryByRole("button", { name: /locate me/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the locate button when onLocateMe is provided", () => {
    render(
      <MapControls
        onZoomIn={noop}
        onZoomOut={noop}
        onReset={noop}
        onLocateMe={noop}
      />,
    );
    expect(
      screen.getByRole("button", { name: /locate me/i }),
    ).toBeInTheDocument();
  });

  it("disables the button and marks it busy while locating", () => {
    render(
      <MapControls
        onZoomIn={noop}
        onZoomOut={noop}
        onReset={noop}
        onLocateMe={noop}
        isLocating
      />,
    );
    const button = screen.getByRole("button", {
      name: /finding your location/i,
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

// ── LocationErrorCard ─────────────────────────────────────────────────────────

describe("LocationErrorCard", () => {
  it("shows the message and a retry button when retrying can help", () => {
    const onRetry = vi.fn();
    render(
      <LocationErrorCard
        message="Location permission was denied."
        onDismiss={() => {}}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Location permission was denied.",
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("omits the retry button when no retry handler is given", () => {
    render(
      <LocationErrorCard
        message="Your browser does not support geolocation."
        onDismiss={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /try again/i }),
    ).not.toBeInTheDocument();
  });
});

// ── Map: end-to-end wiring ────────────────────────────────────────────────────

describe("MRTMapComponent GPS wiring", () => {
  it("exposes a locate button on the map", () => {
    render(<MRTMapComponent />);
    expect(
      screen.getByRole("button", { name: /locate me/i }),
    ).toBeInTheDocument();
  });

  it("does not request location until the button is pressed", () => {
    render(<MRTMapComponent />);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("shows the nearest station and marks it on the overlay after a fix", async () => {
    grantLocation(BISHAN);
    render(<MRTMapComponent />);
    clickLocate();

    const card = await screen.findByRole("region", {
      name: /nearest station information/i,
    });
    expect(card).toHaveTextContent("Bishan");
    // Standing on the station itself — distance rounds to 0m.
    expect(card).toHaveTextContent(/0m away/);
    expect(card).toHaveTextContent(/±20m accuracy/);

    // The SVG marker layer is driven by the same result.
    expect(screen.getByLabelText("Nearest station: Bishan")).toBeInTheDocument();
  });

  it("warns when GPS accuracy is too poor to trust the result", async () => {
    grantLocation(BISHAN, 250);
    render(<MRTMapComponent />);
    clickLocate();

    expect(await screen.findByText(/GPS accuracy is low/i)).toBeInTheDocument();
  });

  it("opens the station panel from the details button", async () => {
    grantLocation(BISHAN);
    render(<MRTMapComponent />);
    clickLocate();

    fireEvent.click(
      await screen.findByRole("button", { name: /station details/i }),
    );

    expect(useMapStore.getState().selectedStation?.id).toBe("bishan");
  });

  it("clears the result when the card is dismissed", async () => {
    grantLocation(BISHAN);
    render(<MRTMapComponent />);
    clickLocate();

    fireEvent.click(
      await screen.findByRole("button", { name: /dismiss nearest station/i }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: /nearest station information/i }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByLabelText("Nearest station: Bishan"),
    ).not.toBeInTheDocument();
  });

  it.each([
    [PERMISSION_DENIED, /permission was denied/i],
    [POSITION_UNAVAILABLE, /could not be determined/i],
    [TIMEOUT, /timed out/i],
  ])(
    "surfaces failure code %i instead of failing silently",
    async (code, expected) => {
      denyLocation(code);
      render(<MRTMapComponent />);
      clickLocate();

      expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    },
  );

  it("reports a location outside Singapore rather than picking a station", async () => {
    // London — well outside the Singapore bounding box.
    grantLocation({ latitude: 51.5074, longitude: -0.1278 });
    render(<MRTMapComponent />);
    clickLocate();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /outside Singapore/i,
    );
    expect(
      screen.queryByRole("region", { name: /nearest station information/i }),
    ).not.toBeInTheDocument();
  });
});

// ── Route form: current location resolves to a real station ───────────────────

describe("RouteInputForm current location", () => {
  /**
   * Click the first dropdown option whose text matches. Matched by hand rather
   * than with findByRole's `name`, because station names are prefixes of one
   * another ("Orchard" also matches "Orchard Boulevard") and a multiple match
   * throws.
   */
  async function pickOption(matcher: RegExp) {
    const options = await screen.findAllByRole("option");
    const match = options.find((o) => matcher.test(o.textContent ?? ""));
    if (!match) {
      throw new Error(
        `No option matching ${matcher}. Saw: ${options
          .map((o) => o.textContent)
          .join(" | ")}`,
      );
    }
    fireEvent.click(match);
  }

  /** Open a station combobox by focusing it, then pick a listed option. */
  async function chooseFromCombobox(fieldLabel: RegExp, optionLabel: RegExp) {
    fireEvent.focus(screen.getByRole("combobox", { name: fieldLabel }));
    await pickOption(optionLabel);
  }

  it("submits the nearest station id, never the 'current-location' placeholder", async () => {
    grantLocation(BISHAN);
    const onSubmit = vi.fn();
    render(<RouteInputForm onSubmit={onSubmit} />);

    await chooseFromCombobox(/origin station/i, /use current location/i);

    // The resolved station is named in the field, not hidden behind a label.
    expect(await screen.findByText(/Bishan/)).toBeInTheDocument();

    const destination = screen.getByRole("combobox", {
      name: /destination station/i,
    });
    fireEvent.focus(destination);
    fireEvent.change(destination, { target: { value: "Orchard" } });
    await pickOption(/^OrchardNS22/);

    fireEvent.click(screen.getByRole("button", { name: /plan route/i }));

    expect(onSubmit).toHaveBeenCalledOnce();
    const params = onSubmit.mock.calls[0][0];
    expect(params.originStationId).toBe("bishan");
    expect(params.originStationId).not.toBe("current-location");
  });

  it("explains the failure and keeps the form usable when permission is denied", async () => {
    denyLocation(PERMISSION_DENIED);
    render(<RouteInputForm onSubmit={vi.fn()} />);

    await chooseFromCombobox(/origin station/i, /use current location/i);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /permission was denied/i,
    );

    // "Change" returns the user to manual station selection.
    fireEvent.click(screen.getByRole("button", { name: /change/i }));
    expect(
      screen.getByRole("combobox", { name: /origin station/i }),
    ).toBeInTheDocument();
  });
});
