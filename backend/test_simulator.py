from evaluation.simulator import generate_session

session = generate_session(num_events=5, seed=42)

print("Simulated tourist session:\n")
for i, event in enumerate(session, 1):
    print(f"Event {i}:")
    print(f"  Time:     {event['now'].strftime('%H:%M')}")
    print(f"  Location: {event['ground_truth_location']} ({event['lat']:.4f}, {event['lon']:.4f})")
    print(f"  Category: {event['current_category']}")
    print()