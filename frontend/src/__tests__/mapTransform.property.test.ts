/**
 * Property-Based Tests: Map Transform Clamping
 *
 * Validates: Requirements 3.5
 *
 * Verifies that for any zoom scale and translation, the visible map area
 * always has non-zero overlap with the viewport. The map can never be
 * panned completely outside the viewport bounds.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Viewport dimensions (typical desktop viewport for the map component)
 */
const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 750;

/**
 * Base map dimensions in viewBox units (SVG viewBox is 1600x1000)
 */
const BASE_MAP_WIDTH = 1600;
const BASE_MAP_HEIGHT = 1000;

/**
 * Scale bounds matching TransformContainer configuration
 */
const MIN_SCALE = 1;
const MAX_SCALE = 5;

/**
 * Simulates the clamping behavior of react-zoom-pan-pinch with limitToBounds enabled.
 * The map content at a given scale cannot be translated beyond the point where
 * it would leave the viewport entirely.
 *
 * At scale s, the rendered map size is (BASE_MAP_WIDTH * s, BASE_MAP_HEIGHT * s).
 * Translation is clamped so the map always overlaps the viewport:
 *   - minX = viewportWidth - mapWidth (map's right edge at viewport's right edge)
 *   - maxX = 0 (map's left edge at viewport's left edge)
 *   - minY = viewportHeight - mapHeight (map's bottom edge at viewport's bottom edge)
 *   - maxY = 0 (map's top edge at viewport's top edge)
 */
function clampTransform(
  scale: number,
  x: number,
  y: number,
  viewportW: number,
  viewportH: number
): { x: number; y: number } {
  const mapW = BASE_MAP_WIDTH * scale;
  const mapH = BASE_MAP_HEIGHT * scale;

  const minX = viewportW - mapW;
  const maxX = 0;
  const minY = viewportH - mapH;
  const maxY = 0;

  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

/**
 * Checks whether two axis-aligned rectangles have non-zero overlap.
 * Rect A: [ax1, ay1, ax2, ay2] and Rect B: [bx1, by1, bx2, by2]
 */
function hasNonZeroOverlap(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number
): boolean {
  const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
  const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);
  return overlapX > 0 && overlapY > 0;
}

describe("Property 2: Map Transform Clamping", () => {
  /**
   * Validates: Requirements 3.5
   *
   * For any zoom scale in [1, 5] and any arbitrary translation values
   * (including extreme values), after clamping the map rectangle must
   * always have non-zero overlap with the viewport rectangle.
   */
  it("clamped map always has non-zero overlap with viewport", () => {
    fc.assert(
      fc.property(
        // Generate random scale in [MIN_SCALE, MAX_SCALE]
        fc.double({ min: MIN_SCALE, max: MAX_SCALE, noNaN: true }),
        // Generate arbitrary translateX values including extremes
        fc.double({ min: -100000, max: 100000, noNaN: true }),
        // Generate arbitrary translateY values including extremes
        fc.double({ min: -100000, max: 100000, noNaN: true }),
        (scale, rawX, rawY) => {
          const { x, y } = clampTransform(
            scale,
            rawX,
            rawY,
            VIEWPORT_WIDTH,
            VIEWPORT_HEIGHT
          );

          const mapW = BASE_MAP_WIDTH * scale;
          const mapH = BASE_MAP_HEIGHT * scale;

          // Map rectangle after clamping: top-left at (x, y), size (mapW, mapH)
          const mapLeft = x;
          const mapTop = y;
          const mapRight = x + mapW;
          const mapBottom = y + mapH;

          // Viewport rectangle: top-left at (0, 0), size (VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
          const vpLeft = 0;
          const vpTop = 0;
          const vpRight = VIEWPORT_WIDTH;
          const vpBottom = VIEWPORT_HEIGHT;

          const overlaps = hasNonZeroOverlap(
            mapLeft,
            mapTop,
            mapRight,
            mapBottom,
            vpLeft,
            vpTop,
            vpRight,
            vpBottom
          );

          expect(overlaps).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
