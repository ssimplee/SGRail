"""Property tests for route preference influence.

**Property 8: Route Preference Influence**
- Test: FEWEST_TRANSFERS route has transfer_count <= FASTEST route
- Test: WHEELCHAIR route contains only accessible edges

**Validates: Requirements 12.1, 12.3, 12.5**
"""

import sys
import os

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

# Add the app directory to path so we can import route_engine
sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "services")
)
sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
)

from app.services.route_engine import (
    build_graph,
    find_route,
    find_routes,
    EdgeType,
    GraphEdge,
    GraphNode,
    RouteGraph,
    ROUTE_GRAPH,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _count_transfers(path: list[GraphNode], graph: RouteGraph) -> int:
    """Count the number of transfer edges in a path."""
    transfers = 0
    for i in range(len(path) - 1):
        current = path[i]
        next_node = path[i + 1]
        for edge in graph.edges_from(current):
            if edge.to_node == next_node:
                if edge.edge_type == EdgeType.TRANSFER:
                    transfers += 1
                break
    return transfers


def _all_edges_accessible(path: list[GraphNode], graph: RouteGraph) -> bool:
    """Check that every edge in the path has accessible=True."""
    for i in range(len(path) - 1):
        current = path[i]
        next_node = path[i + 1]
        for edge in graph.edges_from(current):
            if edge.to_node == next_node:
                if not edge.accessible:
                    return False
                break
    return True


# ---------------------------------------------------------------------------
# Station pairs known to have routes requiring transfers
# ---------------------------------------------------------------------------

# These pairs are on different lines and require at least one transfer
CROSS_LINE_PAIRS = [
    ("pasir-ris", "jurong-east"),      # EW to NS via interchange
    ("pasir-ris", "bishan"),           # EW to NS/CC
    ("harbourfront", "ang-mo-kio"),    # NE to NS
    ("punggol", "buona-vista"),        # NE to EW/CC
    ("pasir-ris", "marina-south-pier"),  # EW to NS
    ("harbourfront", "orchard"),       # NE to NS
]

# Station pairs that may have direct routes (same line)
SAME_LINE_PAIRS = [
    ("jurong-east", "orchard"),        # Both on NS
    ("jurong-east", "city-hall"),      # Both on NS
    ("pasir-ris", "bugis"),            # Both on EW
    ("harbourfront", "serangoon"),     # Both on NE
]

# All pairs combined for general route preference testing
ALL_ROUTE_PAIRS = CROSS_LINE_PAIRS + SAME_LINE_PAIRS


# ---------------------------------------------------------------------------
# Property Tests
# ---------------------------------------------------------------------------


class TestRoutePreferenceInfluence:
    """Property 8: Route Preference Influence.

    **Validates: Requirements 12.1, 12.3, 12.5**
    """

    @pytest.mark.parametrize("origin,dest", CROSS_LINE_PAIRS)
    def test_fewest_transfers_has_lte_transfers_than_fastest(
        self, origin: str, dest: str
    ):
        """FEWEST_TRANSFERS route has transfer_count <= FASTEST route's transfer_count.

        For routes that cross lines and require transfers, the FEWEST_TRANSFERS
        preference should find a route with equal or fewer transfers than the
        FASTEST preference route.

        **Validates: Requirements 12.1, 12.3**
        """
        graph = ROUTE_GRAPH

        # Find route with FEWEST_TRANSFERS preference
        fewest_results = find_routes(
            graph, origin, dest, "FEWEST_TRANSFERS", max_routes=1
        )
        # Find route with FASTEST preference
        fastest_results = find_routes(
            graph, origin, dest, "FASTEST", max_routes=1
        )

        # Both should find at least one route
        assert len(fewest_results) > 0, (
            f"No FEWEST_TRANSFERS route found from {origin} to {dest}"
        )
        assert len(fastest_results) > 0, (
            f"No FASTEST route found from {origin} to {dest}"
        )

        fewest_path = fewest_results[0][0]
        fastest_path = fastest_results[0][0]

        fewest_transfers = _count_transfers(fewest_path, graph)
        fastest_transfers = _count_transfers(fastest_path, graph)

        assert fewest_transfers <= fastest_transfers, (
            f"FEWEST_TRANSFERS route ({origin} → {dest}) has {fewest_transfers} transfers "
            f"but FASTEST has only {fastest_transfers}. "
            f"FEWEST_TRANSFERS path: {[n[0] for n in fewest_path]}, "
            f"FASTEST path: {[n[0] for n in fastest_path]}"
        )

    @pytest.mark.parametrize("origin,dest", ALL_ROUTE_PAIRS)
    def test_wheelchair_route_contains_only_accessible_edges(
        self, origin: str, dest: str
    ):
        """WHEELCHAIR route only traverses edges where accessible=True.

        When routing with the WHEELCHAIR preference, the algorithm must
        exclude inaccessible edges. Every edge in the returned path must
        have accessible=True.

        **Validates: Requirements 12.5**
        """
        graph = ROUTE_GRAPH

        results = find_routes(graph, origin, dest, "WHEELCHAIR", max_routes=1)

        if len(results) == 0:
            # No route found — this is acceptable if inaccessible edges block
            # all paths. The property is vacuously true.
            pytest.skip(
                f"No WHEELCHAIR route from {origin} to {dest} (may be blocked by inaccessible edges)"
            )

        path = results[0][0]
        assert _all_edges_accessible(path, graph), (
            f"WHEELCHAIR route from {origin} to {dest} contains inaccessible edges. "
            f"Path: {[(n[0], n[1]) for n in path]}"
        )

    @pytest.mark.parametrize("origin,dest", CROSS_LINE_PAIRS[:3])
    def test_both_preferences_find_valid_routes_for_interchange_pairs(
        self, origin: str, dest: str
    ):
        """For known interchange pairs, both FEWEST_TRANSFERS and FASTEST find routes.

        This verifies both preferences produce valid paths for cross-line journeys.

        **Validates: Requirements 12.1, 12.3**
        """
        graph = ROUTE_GRAPH

        fewest_results = find_routes(
            graph, origin, dest, "FEWEST_TRANSFERS", max_routes=1
        )
        fastest_results = find_routes(
            graph, origin, dest, "FASTEST", max_routes=1
        )

        assert len(fewest_results) > 0, (
            f"FEWEST_TRANSFERS should find a route from {origin} to {dest}"
        )
        assert len(fastest_results) > 0, (
            f"FASTEST should find a route from {origin} to {dest}"
        )

        # Both paths should start at origin and end at destination
        fewest_path = fewest_results[0][0]
        fastest_path = fastest_results[0][0]

        assert fewest_path[0][0] == origin
        assert fewest_path[-1][0] == dest
        assert fastest_path[0][0] == origin
        assert fastest_path[-1][0] == dest




class TestCompletedCircleLineRouting:
    """Regression tests for the completed Circle Line Stage 6 loop."""

    def test_ccl6_connects_harbourfront_to_marina_bay_without_transfer(self):
        """Telok Blangah to Marina Bay should stay on the completed CCL."""
        results = find_routes(
            ROUTE_GRAPH, "telok-blangah", "marina-bay", "FASTEST", max_routes=1
        )

        assert results, "Expected a route through the completed Circle Line"
        path = results[0][0]

        assert path[0] == ("telok-blangah", "CC")
        assert path[-1] == ("marina-bay", "CC")
        assert _count_transfers(path, ROUTE_GRAPH) == 0
        assert ("prince-edward-road", "CC") in path

    def test_keppel_to_bayfront_uses_ccl6_not_ne_dt_detour(self):
        """The new CCL6 stretch should be the direct route to Bayfront."""
        results = find_routes(ROUTE_GRAPH, "keppel", "bayfront", "FASTEST", max_routes=1)

        assert results, "Expected a route from Keppel to Bayfront"
        path = results[0][0]

        assert path == [
            ("keppel", "CC"),
            ("cantonment", "CC"),
            ("prince-edward-road", "CC"),
            ("marina-bay", "CC"),
            ("bayfront", "CC"),
        ]


class TestWheelchairPropertyWithInaccessibleEdges:
    """Property test using a synthetic graph with inaccessible edges.

    This ensures the WHEELCHAIR filter is actually exercised even when
    the production graph has all edges accessible.

    **Validates: Requirements 12.5**
    """

    @given(
        travel_accessible=st.floats(min_value=1.0, max_value=20.0),
        travel_inaccessible=st.floats(min_value=0.1, max_value=5.0),
    )
    @settings(max_examples=50)
    def test_wheelchair_never_uses_inaccessible_edge_synthetic(
        self, travel_accessible: float, travel_inaccessible: float
    ):
        """In a graph with inaccessible shortcuts, WHEELCHAIR avoids them.

        Creates a graph where the inaccessible path is shorter (cheaper)
        but the WHEELCHAIR preference must still avoid it.

        **Validates: Requirements 12.5**
        """
        graph = RouteGraph()

        # Path 1: A -> B -> D (accessible, longer)
        graph.add_edge(
            GraphEdge(
                from_node=("a", "X"),
                to_node=("b", "X"),
                edge_type=EdgeType.RIDE,
                travel_minutes=travel_accessible,
                accessible=True,
            ),
            bidirectional=False,
        )
        graph.add_edge(
            GraphEdge(
                from_node=("b", "X"),
                to_node=("d", "X"),
                edge_type=EdgeType.RIDE,
                travel_minutes=travel_accessible,
                accessible=True,
            ),
            bidirectional=False,
        )

        # Path 2: A -> C -> D (inaccessible shortcut)
        graph.add_edge(
            GraphEdge(
                from_node=("a", "X"),
                to_node=("c", "X"),
                edge_type=EdgeType.RIDE,
                travel_minutes=travel_inaccessible,
                accessible=False,
            ),
            bidirectional=False,
        )
        graph.add_edge(
            GraphEdge(
                from_node=("c", "X"),
                to_node=("d", "X"),
                edge_type=EdgeType.RIDE,
                travel_minutes=travel_inaccessible,
                accessible=True,
            ),
            bidirectional=False,
        )

        result = find_route(graph, ("a", "X"), ("d", "X"), "WHEELCHAIR")

        assert result is not None, "WHEELCHAIR should find the accessible path A->B->D"
        path, _ = result

        # The path must not include node C (which requires the inaccessible edge)
        station_ids = [n[0] for n in path]
        assert "c" not in station_ids, (
            f"WHEELCHAIR route used inaccessible edge via 'c'. Path: {station_ids}"
        )

    @given(
        n_stations=st.integers(min_value=3, max_value=8),
    )
    @settings(max_examples=30)
    def test_wheelchair_with_all_accessible_graph_finds_route(
        self, n_stations: int
    ):
        """When all edges are accessible, WHEELCHAIR finds a route like any other preference.

        **Validates: Requirements 12.5**
        """
        graph = RouteGraph()

        # Create a linear chain of stations, all accessible
        stations = [f"s{i}" for i in range(n_stations)]
        for i in range(len(stations) - 1):
            graph.add_edge(
                GraphEdge(
                    from_node=(stations[i], "L"),
                    to_node=(stations[i + 1], "L"),
                    edge_type=EdgeType.RIDE,
                    travel_minutes=3.0,
                    accessible=True,
                ),
                bidirectional=False,
            )

        result = find_route(
            graph, (stations[0], "L"), (stations[-1], "L"), "WHEELCHAIR"
        )

        assert result is not None, (
            f"WHEELCHAIR should find a route through {n_stations} accessible stations"
        )
        path, _ = result
        assert len(path) == n_stations
        assert path[0][0] == stations[0]
        assert path[-1][0] == stations[-1]
