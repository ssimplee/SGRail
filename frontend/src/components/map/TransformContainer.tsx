import {
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type ReactNode,
} from "react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { MapControls } from "./MapControls";

interface TransformContainerProps {
  children: ReactNode;
  className?: string;
  crowdLayerActive?: boolean;
  onToggleCrowd?: () => void;
  stationLabelsActive?: boolean;
  onToggleStationLabels?: () => void;
  onLocateMe?: () => void;
  isLocating?: boolean;
}

/**
 * Imperative handle for driving the viewport from outside the container.
 */
export interface MapViewHandle {
  /**
   * Centre the viewport on a point given in map-image coordinates — the same
   * 1600×1000 space the SVG overlay and station x/y values use.
   */
  focusOnPoint: (x: number, y: number, scale?: number) => void;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;

/** Zoom level used when centring on a station, close enough to read labels */
const FOCUS_SCALE = 2;
const FOCUS_ANIMATION_MS = 400;

/** Map content is laid out on a fixed 1600×1000 stage (see contentStyle below) */
const CONTENT_WIDTH = 1600;
const CONTENT_HEIGHT = 1000;

/**
 * Scale that makes the fixed-size map stage fill the wrapper viewport with
 * no letterboxing — the same "cover" behaviour as CSS background-size or
 * Google Maps' initial view. Clamped to the configured zoom bounds so it
 * never asks the library to render outside what it's configured to allow.
 */
function computeCoverScale(wrapper: HTMLElement): number {
  const scale = Math.max(
    wrapper.clientWidth / CONTENT_WIDTH,
    wrapper.clientHeight / CONTENT_HEIGHT,
  );
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export const TransformContainer = forwardRef<
  MapViewHandle,
  TransformContainerProps
>(function TransformContainer(
  {
    children,
    className,
    crowdLayerActive,
    onToggleCrowd,
    stationLabelsActive,
    onToggleStationLabels,
    onLocateMe,
    isLocating,
  },
  ref,
) {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);

  const handleZoomIn = useCallback(() => {
    transformRef.current?.zoomIn(ZOOM_STEP);
  }, []);

  const handleZoomOut = useCallback(() => {
    transformRef.current?.zoomOut(ZOOM_STEP);
  }, []);

  const handleReset = useCallback(() => {
    const api = transformRef.current;
    const wrapper = api?.instance.wrapperComponent;
    if (!api || !wrapper) return;
    api.centerView(computeCoverScale(wrapper), FOCUS_ANIMATION_MS);
  }, []);

  const handleMapInit = useCallback((api: ReactZoomPanPinchRef) => {
    const wrapper = api.instance.wrapperComponent;
    if (!wrapper) return;

    // wrapper.clientWidth/Height can still read 0 here — onInit fires as
    // soon as the DOM nodes exist, which can be a layout pass before the
    // surrounding flex/grid chain has resolved a real height. Wait for a
    // ResizeObserver to confirm an actual size (the same signal the
    // library's own centerOnInit waits for) before computing the fit,
    // otherwise the cover scale collapses to MIN_SCALE.
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      observer.disconnect();
      api.centerView(computeCoverScale(wrapper), 0);
    });
    observer.observe(wrapper);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focusOnPoint(x, y, scale = FOCUS_SCALE) {
        const api = transformRef.current;
        const wrapper = api?.instance.wrapperComponent;
        if (!api || !wrapper) return;

        // setTransform positions the content's top-left corner, so shift by
        // half the viewport to bring the requested point to the centre.
        api.setTransform(
          wrapper.clientWidth / 2 - x * scale,
          wrapper.clientHeight / 2 - y * scale,
          scale,
          FOCUS_ANIMATION_MS,
        );
      },
    }),
    [],
  );

  return (
    <div className={className}>
      <TransformWrapper
        ref={transformRef}
        initialScale={0.6}
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        centerOnInit
        limitToBounds={false}
        panning={{ velocityDisabled: false }}
        wheel={{ smoothStep: 0.002 }}
        pinch={{ step: 5 }}
        doubleClick={{ disabled: false, step: 0.7 }}
        onInit={handleMapInit}
      >
        <div className="relative h-full w-full">
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: `${CONTENT_WIDTH}px`, height: `${CONTENT_HEIGHT}px` }}
          >
            {children}
          </TransformComponent>
          <MapControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleReset}
            crowdLayerActive={crowdLayerActive}
            onToggleCrowd={onToggleCrowd}
            stationLabelsActive={stationLabelsActive}
            onToggleStationLabels={onToggleStationLabels}
            onLocateMe={onLocateMe}
            isLocating={isLocating}
          />
        </div>
      </TransformWrapper>
    </div>
  );
});
