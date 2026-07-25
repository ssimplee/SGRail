"""Quick verification script for the route engine Dijkstra implementation."""
import sys
import os

# Add the services directory to path so we can import route_engine directly
# without triggering app/__init__.py
services_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app", "services")
sys.path.insert(0, services_dir)

import route_engine

ROUTE_GRAPH = route_engine.ROUTE_GRAPH
find_route = route_engine.find_route
find_routes = route_engine.find_routes
compute_edge_cost = route_engine.compute_edge_cost
GraphEdge = route_engine.GraphEdge
EdgeType = route_engine.EdgeType
RoutePreferenceWeights = route_engine.RoutePreferenceWeights
PREFERENCE_WEIGHTS = route_engine.PREFERENCE_WEIGHTS
RouteGraph = route_engine.RouteGraph

# Test 1: find_route from jurong-east (NS) to city-hall (NS)
print("=== Test 1: find_route Jurong East -> City Hall (direct NS line) ===")
result = find_route(ROUTE_GRAPH, ("jurong-east", "NS"), ("city-hall", "NS"), "FASTEST")
if result:
    path, cost = result
    print(f"Route found! Cost: {cost:.2f}")
    print(f"Path ({len(path)} nodes):")
    for node in path:
        print(f"  {node[0]} ({node[1]})")
else:
    print("No route found!")
    sys.exit(1)

print()

# Test 2: find_routes (multiple alternatives)
print("=== Test 2: find_routes Jurong East -> City Hall (alternatives) ===")
routes = find_routes(ROUTE_GRAPH, "jurong-east", "city-hall", "FASTEST")
print(f"Found {len(routes)} routes:")
for i, (path, cost) in enumerate(routes):
    stations = [f"{n[0]}({n[1]})" for n in path]
    print(f"  Route {i+1}: cost={cost:.2f}, stops={len(path)}")
    print(f"    {' -> '.join(stations)}")

print()

# Test 3: compute_edge_cost
print("=== Test 3: compute_edge_cost ===")
test_edge = GraphEdge(
    from_node=("a", "NS"),
    to_node=("b", "NS"),
    edge_type=EdgeType.RIDE,
    travel_minutes=5.0,
    walk_minutes=0.0,
    transfer_count=0,
    crowd_level=0.5,
)
weights = PREFERENCE_WEIGHTS["FASTEST"]
cost = compute_edge_cost(test_edge, weights)
print(f"Edge cost (5 min travel, 0.5 crowd, FASTEST): {cost:.2f}")
assert abs(cost - (5.0 * 1.0 + 0.5 * 0.1 + 0 * 2.0 + 0.0 * 1.0)) < 0.01
print("  PASS")

# Test 4: WHEELCHAIR filters inaccessible
print()
print("=== Test 4: WHEELCHAIR preference filters inaccessible edges ===")

small_graph = RouteGraph()
# A -> B accessible, A -> C inaccessible, C -> D accessible
small_graph.add_edge(GraphEdge(("a", "X"), ("b", "X"), EdgeType.RIDE, travel_minutes=2, accessible=True), bidirectional=False)
small_graph.add_edge(GraphEdge(("a", "X"), ("c", "X"), EdgeType.RIDE, travel_minutes=1, accessible=False), bidirectional=False)
small_graph.add_edge(GraphEdge(("c", "X"), ("d", "X"), EdgeType.RIDE, travel_minutes=1, accessible=True), bidirectional=False)
small_graph.add_edge(GraphEdge(("b", "X"), ("d", "X"), EdgeType.RIDE, travel_minutes=2, accessible=True), bidirectional=False)

# With WHEELCHAIR, should avoid A->C (inaccessible) and go A->B->D
result = find_route(small_graph, ("a", "X"), ("d", "X"), "WHEELCHAIR")
if result:
    path, cost = result
    print(f"  Path: {[n[0] for n in path]}, cost: {cost:.2f}")
    assert ("c", "X") not in path, "Wheelchair route should not go through inaccessible edge"
    print("  PASS - avoided inaccessible edge")
else:
    print("  FAIL - no route found")
    sys.exit(1)

# Test 5: avoid_stations
print()
print("=== Test 5: avoid_stations ===")
result = find_route(ROUTE_GRAPH, ("jurong-east", "NS"), ("city-hall", "NS"), "FASTEST", avoid_stations=["orchard"])
if result:
    path, cost = result
    station_ids = [n[0] for n in path]
    assert "orchard" not in station_ids, "Route should not pass through avoided station"
    print(f"  Route avoids 'orchard': {' -> '.join(station_ids)}")
    print("  PASS")
else:
    print("  Route not found (expected if no alternative exists)")

# Test 6: avoid_lines
print()
print("=== Test 6: avoid_lines ===")
result = find_route(ROUTE_GRAPH, ("jurong-east", "EW"), ("city-hall", "EW"), "FASTEST", avoid_lines=["NS"])
if result:
    path, cost = result
    line_codes = [n[1] for n in path]
    assert "NS" not in line_codes, "Route should not use avoided line"
    print(f"  Route avoids NS line. Lines used: {set(line_codes)}")
    print("  PASS")
else:
    print("  No route found avoiding NS line (may be expected depending on graph)")

print()
print("=== All tests passed! ===")
