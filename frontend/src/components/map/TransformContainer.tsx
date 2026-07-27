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

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;

/** Zoom level used when centring on a station, close enough to read labels */
const FOCUS_SCALE = 2;
const FOCUS_ANIMATION_MS = 400;

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
    transformRef.current?.resetTransform();
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
        minScale={0.3}
        maxScale={MAX_SCALE}
        centerOnInit
        limitToBounds={false}
        panning={{ velocityDisabled: false }}
        wheel={{ smoothStep: 0.05 }}
        pinch={{ step: 5 }}
        doubleClick={{ disabled: false, step: 0.7 }}
      >
        <div className="relative h-full w-full">
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: "1600px", height: "1000px" }}
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
