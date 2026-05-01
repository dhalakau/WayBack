import math
import datetime
from collections import defaultdict
from methods.base import BaseRecommender
from methods.cbr import tokenize, item_text


# ============================================================
# Grossberg's activation function (from the paper)
# ============================================================
# δa = (max - a)·e − (a − min)·i − decay·(a − rest)
#
# a       = current activation
# e       = excitatory input
# i       = inhibitory input  (always 0 in our model — paper uses only excitation)
# max,min = activation bounds
# rest    = baseline activation
# decay   = pull back to rest each tick
#
# We don't run to convergence — paper uses 10 iterations.
# ============================================================

ACT_MIN = -0.1
ACT_MAX = 1.0
ACT_REST = -0.1
ACT_DECAY = 0.1
ITERATIONS = 10


def grossberg_step(activation, excitatory):
    """One iteration of Grossberg's activation update."""
    delta = (ACT_MAX - activation) * excitatory - ACT_DECAY * (activation - ACT_REST)
    return max(ACT_MIN, min(ACT_MAX, activation + delta))


# ============================================================
# Time bucketing — discretize time into context nodes
# ============================================================
def time_bucket(dt):
    """Convert a datetime into a coarse time-of-day bucket."""
    if dt is None:
        return None
    h = dt.hour
    if 5 <= h < 11:
        return "morning"
    elif 11 <= h < 14:
        return "midday"
    elif 14 <= h < 18:
        return "afternoon"
    elif 18 <= h < 23:
        return "evening"
    else:
        return "night"


def location_bucket(lat, lon, grid=0.005):
    """Discretize GPS into a grid cell so nearby items share a location node."""
    if lat is None or lon is None:
        return None
    return f"loc_{round(lat / grid) * grid:.3f}_{round(lon / grid) * grid:.3f}"


# ============================================================
# CIA Network
# ============================================================
class CIARecommender(BaseRecommender):
    """
    Contextual Interactive Activation network.
    Three-layer spreading activation: Event → Context Info → Documents
    Connection weights based on TF-IDF style normalization (paper Table 3).
    """

    name = "CIA"

    def __init__(self):
        # These get rebuilt each recommend() call so the network stays in sync with items
        self.context_nodes = set()      # set of context-info node IDs
        self.item_to_context = {}       # item.id -> set of context node IDs
        self.context_to_items = defaultdict(set)  # context node -> set of item IDs

    # ----------------------------------------
    # Build network connections from items
    # ----------------------------------------
    def build_network(self, items):
        self.context_nodes = set()
        self.item_to_context = {}
        self.context_to_items = defaultdict(set)

        for item in items:
            ctx = set()

            # Topic nodes — from tokenized text
            for token in tokenize(item_text(item)):
                node = f"topic:{token}"
                ctx.add(node)

            # Category node
            if item.category:
                ctx.add(f"cat:{item.category}")

            # Location bucket
            lb = location_bucket(item.latitude, item.longitude)
            if lb:
                ctx.add(lb)

            # Time bucket (only if item has an event time)
            tb = time_bucket(item.event_datetime)
            if tb:
                ctx.add(f"time:{tb}")

            self.item_to_context[item.id] = ctx
            self.context_nodes |= ctx
            for c in ctx:
                self.context_to_items[c].add(item.id)

    # ----------------------------------------
    # Connection weights (paper Table 3)
    # ----------------------------------------
    def weight_context_to_item(self, ctx_node):
        """1 / #outlinks — rare context nodes carry more weight."""
        n = len(self.context_to_items[ctx_node])
        return 1.0 / n if n > 0 else 0.0

    def weight_item_to_context(self, item, ctx_node):
        """tf in the item — common terms in the item carry more weight."""
        item_ctx = self.item_to_context.get(item.id, set())
        if not item_ctx:
            return 0.0
        return 1.0 / len(item_ctx)

    # ----------------------------------------
    # Build event-layer activation from current context
    # ----------------------------------------
    def event_activations(self, context):
        """Return a dict {context_node: activation_strength} based on current context."""
        active = {}

        # Tokens from current text
        tokens = tokenize(context.get("current_text", ""))
        if tokens:
            weight = 1.0 / len(tokens)
            for tok in tokens:
                node = f"topic:{tok}"
                if node in self.context_nodes:
                    active[node] = active.get(node, 0) + weight

        # Current category
        cat = context.get("current_category")
        if cat:
            node = f"cat:{cat}"
            if node in self.context_nodes:
                active[node] = active.get(node, 0) + 1.0

        # Current location
        lb = location_bucket(context.get("lat"), context.get("lon"))
        if lb and lb in self.context_nodes:
            active[lb] = active.get(lb, 0) + 1.0

        # Current time
        now = context.get("now") or datetime.datetime.utcnow()
        tb = time_bucket(now)
        if tb:
            node = f"time:{tb}"
            if node in self.context_nodes:
                active[node] = active.get(node, 0) + 1.0

        return active

    # ----------------------------------------
    # Spreading activation
    # ----------------------------------------
    def spread(self, items, event_activations):
        """Run spreading activation for ITERATIONS rounds, return item activations."""
        ctx_act = {n: 0.0 for n in self.context_nodes}
        item_act = {i.id: 0.0 for i in items}

        # Seed context layer from event activations
        for node, val in event_activations.items():
            ctx_act[node] = grossberg_step(ctx_act[node], val)

        for _ in range(ITERATIONS):
            # Context → Item (forward pass)
            new_item_act = dict(item_act)
            for item in items:
                excitation = 0.0
                for ctx_node in self.item_to_context.get(item.id, set()):
                    excitation += ctx_act[ctx_node] * self.weight_context_to_item(ctx_node)
                new_item_act[item.id] = grossberg_step(item_act[item.id], excitation)

            # Item → Context (backward pass — pseudo-relevance feedback)
            new_ctx_act = dict(ctx_act)
            for ctx_node in self.context_nodes:
                excitation = 0.0
                for item_id in self.context_to_items[ctx_node]:
                    item = next((i for i in items if i.id == item_id), None)
                    if item:
                        excitation += new_item_act[item_id] * self.weight_item_to_context(item, ctx_node)
                # Re-inject event activation each iteration so seed signal persists
                excitation += event_activations.get(ctx_node, 0)
                new_ctx_act[ctx_node] = grossberg_step(ctx_act[ctx_node], excitation)

            item_act = new_item_act
            ctx_act = new_ctx_act

        return item_act

    # ----------------------------------------
    # Main recommend method
    # ----------------------------------------
    def recommend(self, items, context, top_k=10):
        if not items:
            return []

        self.build_network(items)
        event_act = self.event_activations(context)
        if not event_act:
            return []

        item_activations = self.spread(items, event_act)

        scored = []
        for item in items:
            score = item_activations.get(item.id, 0.0)
            if score > 0:
                scored.append({
                    "item": item,
                    "score": round(score, 4),
                    "explanation": f"Activated through {len(self.item_to_context.get(item.id, set()))} context links (activation: {score:.2f}).",
                })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]