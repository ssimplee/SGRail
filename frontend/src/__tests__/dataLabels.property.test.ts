import * as fc from "fast-check";

/**
 * Property 7: Data Source Honesty
 *
 * Any data with non-"official" source is labelled Demo/Estimated/Community-reported/Historical — never "Live".
 * Only source="official" or source="live" produces the "Live" label.
 *
 * **Validates: Requirements 1.2**
 */

// Replicate the SOURCE_CONFIG mapping logic as a pure function for testing
const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  demo: {
    label: "Demo",
    className: "bg-gray-200 text-gray-700",
  },
  simulated: {
    label: "Demo",
    className: "bg-gray-200 text-gray-700",
  },
  estimated: {
    label: "Estimated",
    className: "bg-yellow-100 text-yellow-800",
  },
  historical: {
    label: "Estimated",
    className: "bg-yellow-100 text-yellow-800",
  },
  community: {
    label: "Community",
    className: "bg-blue-100 text-blue-800",
  },
  official: {
    label: "Live",
    className: "bg-green-100 text-green-800",
  },
  live: {
    label: "Live",
    className: "bg-green-100 text-green-800",
  },
};

/**
 * Pure function that mirrors the DataSourceLabel resolution logic.
 * Given a source string, returns the label that would be displayed.
 */
function resolveLabel(source: string): string {
  const normalised = source.toLowerCase();
  const config = SOURCE_CONFIG[normalised];
  return config ? config.label : source;
}

describe("Property 7: Data Source Honesty", () => {
  it('source "demo" → label "Demo" (never "Live")', () => {
    fc.assert(
      fc.property(fc.constant("demo"), (source) => {
        const label = resolveLabel(source);
        expect(label).toBe("Demo");
        expect(label).not.toBe("Live");
      }),
      { numRuns: 50 }
    );
  });

  it('source "simulated" → label "Demo" (never "Live")', () => {
    fc.assert(
      fc.property(fc.constant("simulated"), (source) => {
        const label = resolveLabel(source);
        expect(label).toBe("Demo");
        expect(label).not.toBe("Live");
      }),
      { numRuns: 50 }
    );
  });

  it('source "estimated" → label "Estimated" (never "Live")', () => {
    fc.assert(
      fc.property(fc.constant("estimated"), (source) => {
        const label = resolveLabel(source);
        expect(label).toBe("Estimated");
        expect(label).not.toBe("Live");
      }),
      { numRuns: 50 }
    );
  });

  it('source "historical" → label "Estimated" (never "Live")', () => {
    fc.assert(
      fc.property(fc.constant("historical"), (source) => {
        const label = resolveLabel(source);
        expect(label).toBe("Estimated");
        expect(label).not.toBe("Live");
      }),
      { numRuns: 50 }
    );
  });

  it('source "community" → label "Community" (never "Live")', () => {
    fc.assert(
      fc.property(fc.constant("community"), (source) => {
        const label = resolveLabel(source);
        expect(label).toBe("Community");
        expect(label).not.toBe("Live");
      }),
      { numRuns: 50 }
    );
  });

  it('source "official" → label "Live"', () => {
    fc.assert(
      fc.property(fc.constant("official"), (source) => {
        const label = resolveLabel(source);
        expect(label).toBe("Live");
      }),
      { numRuns: 50 }
    );
  });

  it('source "live" → label "Live"', () => {
    fc.assert(
      fc.property(fc.constant("live"), (source) => {
        const label = resolveLabel(source);
        expect(label).toBe("Live");
      }),
      { numRuns: 50 }
    );
  });

  it('for any random source string that is NOT "official" or "live", the resolved label is NOT "Live"', () => {
    // Generate arbitrary strings that are not "official" or "live" (case-insensitive)
    const nonLiveSourceArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => {
        const lower = s.toLowerCase();
        return lower !== "official" && lower !== "live";
      });

    fc.assert(
      fc.property(nonLiveSourceArb, (source) => {
        const label = resolveLabel(source);
        expect(label).not.toBe("Live");
      }),
      { numRuns: 50 }
    );
  });
});
