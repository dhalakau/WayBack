from evaluation.simulator import generate_session


def test_simulator_returns_correct_count():
    session = generate_session(num_events=5, seed=42)
    assert len(session) == 5


def test_simulator_events_have_required_fields():
    session = generate_session(num_events=3, seed=42)
    required = {"lat", "lon", "now", "current_category", "ground_truth_location"}
    for event in session:
        for field in required:
            assert field in event, f"Event missing field: {field}"


def test_simulator_is_deterministic():
    session_a = generate_session(num_events=5, seed=42)
    session_b = generate_session(num_events=5, seed=42)
    for a, b in zip(session_a, session_b):
        assert a["lat"] == b["lat"]
        assert a["current_category"] == b["current_category"]


def test_simulator_different_seeds_differ():
    session_a = generate_session(num_events=5, seed=1)
    session_b = generate_session(num_events=5, seed=99)
    categories_a = [e["current_category"] for e in session_a]
    categories_b = [e["current_category"] for e in session_b]
    assert categories_a != categories_b, "Different seeds should produce different sessions"


def test_simulator_coordinates_are_valid():
    session = generate_session(num_events=5, seed=42)
    for event in session:
        assert 47.0 < event["lat"] < 49.0, "Latitude should be in Bavaria range"
        assert 10.0 < event["lon"] < 13.0, "Longitude should be in Bavaria range"
