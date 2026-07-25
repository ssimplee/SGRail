/**
 * Confidence model for journey tracking.
 *
 * Combines multiple signals (GPS proximity, elapsed time, route sequence, user confirmation)
 * to produce a confidence score for the user's estimated position on the route.
 * GPS alone is unreliable underground, so the model fuses several factors.
 *
 * Validates: Requirements 7.8
 */

export interface ConfidenceParams {
  /** Distance in metres from GPS position to expected station (null if no GPS) */
  lastGpsDistanceToExpectedStation: number | null;
  /** Milliseconds since last GPS fix */
  timeSinceLastGps: number;
  /** Expected travel time for the current segment in milliseconds */
  expectedTravelTime: number;
  /** Elapsed time since journey/segment started in milliseconds */
  elapsedTime: number;
  /** Whether the user manually confirmed their current station */
  userConfirmedStation: boolean;
  /** Current index in the route sequence (0-based) */
  routeSequenceIndex: number;
  /** Total number of stops in the route */
  totalStops: number;
}

/**
 * Calculate a confidence score in [0.0, 1.0] representing how certain we are
 * about the user's current position along the route.
 *
 * Factors:
 * 1. GPS proximity: closer to expected station → higher confidence
 * 2. GPS freshness: stale GPS → lower confidence
 * 3. Time alignment: elapsed time near expected → higher confidence
 * 4. User confirmation: explicit confirmation → max confidence boost
 * 5. Route progress: early/late in journey handled uniformly
 */
export function calculateConfidence(params: ConfidenceParams): number {
  const {
    lastGpsDistanceToExpectedStation,
    timeSinceLastGps,
    expectedTravelTime,
    elapsedTime,
    userConfirmedStation,
    routeSequenceIndex,
    totalStops,
  } = params;

  // If user confirmed their station, high confidence immediately
  if (userConfirmedStation) {
    return clamp(0.95, 0, 1);
  }

  let score = 0;
  let weightSum = 0;

  // Factor 1: GPS proximity (weight: 0.4)
  const gpsProximityWeight = 0.4;
  if (lastGpsDistanceToExpectedStation !== null) {
    // 0m → 1.0, 200m → 0.5, 1000m → ~0.1
    const proximityScore = Math.exp(-lastGpsDistanceToExpectedStation / 300);
    score += proximityScore * gpsProximityWeight;
    weightSum += gpsProximityWeight;
  }

  // Factor 2: GPS freshness (weight: 0.2)
  const gpsFreshnessWeight = 0.2;
  // Fresh GPS (<10s) → 1.0, stale (>2min) → low
  const freshnessScore = Math.exp(-timeSinceLastGps / 60000);
  score += freshnessScore * gpsFreshnessWeight;
  weightSum += gpsFreshnessWeight;

  // Factor 3: Time alignment (weight: 0.25)
  const timeAlignmentWeight = 0.25;
  if (expectedTravelTime > 0) {
    // How close is elapsed time to expected travel time?
    const timeRatio = elapsedTime / expectedTravelTime;
    // Ideal is around 1.0; too early or too late reduces confidence
    const timeDeviation = Math.abs(timeRatio - 1.0);
    const timeScore = Math.exp(-timeDeviation * 2);
    score += timeScore * timeAlignmentWeight;
    weightSum += timeAlignmentWeight;
  }

  // Factor 4: Route sequence reasonableness (weight: 0.15)
  const sequenceWeight = 0.15;
  if (totalStops > 0) {
    // Being at a valid sequence position adds confidence
    const sequenceProgress = routeSequenceIndex / totalStops;
    // Reasonable progress if within expected range
    const sequenceScore = sequenceProgress >= 0 && sequenceProgress <= 1 ? 0.7 : 0.3;
    score += sequenceScore * sequenceWeight;
    weightSum += sequenceWeight;
  }

  // Normalise by total weight to handle missing factors
  const normalised = weightSum > 0 ? score / weightSum : 0.3;

  return clamp(normalised, 0, 1);
}

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
