import { useRef, useCallback, type ReactNode } from "react";
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
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;

export function TransformContainer({
  children,
  className,
  crowdLayerActive,
  onToggleCrowd,
  stationLabelsActive,
  onToggleStationLabels,
}: TransformContainerProps) {
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
          />
        </div>
      </TransformWrapper>
    </div>
  );
}
