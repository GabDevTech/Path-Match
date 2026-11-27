(() => {
  const PathMatch = (window.PathMatch = window.PathMatch || {});
  const { BOARD_CONFIG, CARD_SYMBOLS, COST_MODES } = PathMatch;

  /**
   * Returns a random integer in the range [0, max).
   * @param {number} max
   * @returns {number}
   */
  function randomInt(max) {
    return Math.floor(Math.random() * max);
  }

  /**
   * Shuffles an array in place using Fisher-Yates.
   * @template T
   * @param {T[]} items
   * @returns {T[]}
   */
  function shuffleArray(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  /**
   * Returns the traversal cost of a single edge for the active cost mode.
   * @param {{ w: number }} edge
   * @param {string} costMode
   * @returns {number}
   */
  function getEdgeCost(edge, costMode) {
    return costMode === COST_MODES.WEIGHTED
      ? edge.w
      : BOARD_CONFIG.FIXED_EDGE_COST;
  }

  /**
   * Finds the undirected edge connecting two node indices, if any.
   * @param {Array<{ a: number, b: number, w: number }>} edges
   * @param {number} nodeA
   * @param {number} nodeB
   * @returns {{ a: number, b: number, w: number } | undefined}
   */
  function findEdge(edges, nodeA, nodeB) {
    return edges.find(
      (edge) =>
        (edge.a === nodeA && edge.b === nodeB) ||
        (edge.a === nodeB && edge.b === nodeA)
    );
  }

  /**
   * Calculates the total cost of a path of node indices.
   * @param {number[]} path
   * @param {Array<{ a: number, b: number, w: number }>} edges
   * @param {string} costMode
   * @returns {number}
   */
  function calculatePathCost(path, edges, costMode) {
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const edge = findEdge(edges, path[i - 1], path[i]);
      if (edge) {
        total += getEdgeCost(edge, costMode);
      }
    }
    return total;
  }

  function createDisjointSet(size) {
    const parent = Array.from({ length: size }, (_, index) => index);

    function find(node) {
      if (parent[node] !== node) {
        parent[node] = find(parent[node]);
      }
      return parent[node];
    }

    function union(a, b) {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA === rootB) {
        return false;
      }
      parent[rootA] = rootB;
      return true;
    }

    return { union };
  }

  function buildCandidateEdges(cols, rows) {
    const toIndex = (col, row) => row * cols + col;
    const candidates = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (col < cols - 1) {
          candidates.push([toIndex(col, row), toIndex(col + 1, row)]);
        }
        if (row < rows - 1) {
          candidates.push([toIndex(col, row), toIndex(col, row + 1)]);
        }
        if (col < cols - 1 && row < rows - 1) {
          const diagonal =
            Math.random() < 0.5
              ? [toIndex(col, row), toIndex(col + 1, row + 1)]
              : [toIndex(col + 1, row), toIndex(col, row + 1)];
          candidates.push(diagonal);
        }
      }
    }

    return shuffleArray(candidates);
  }

  function randomEdgeWeight() {
    const roll = Math.random();
    let cumulative = 0;
    const distribution = BOARD_CONFIG.WEIGHTED_EDGE_DISTRIBUTION;

    for (const entry of distribution) {
      cumulative += entry.probability;
      if (roll < cumulative) {
        return entry.weight;
      }
    }

    return distribution[distribution.length - 1].weight;
  }

  /**
   * Generates a connected graph of memory cards for the given difficulty config.
   * @param {{ cols: number, rows: number, pairs: number }} difficulty
   * @returns {{ nodes: Array<object>, edges: Array<object>, viewBoxHeight: number }}
   */
  function createConnectedGraph(difficulty) {
    const { cols, rows, pairs } = difficulty;
    const selectedSymbols = CARD_SYMBOLS.slice(0, pairs);
    const deck = shuffleArray([...selectedSymbols, ...selectedSymbols]);

    const nodes = deck.map((sym, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x =
        BOARD_CONFIG.OFFSET_X +
        col * BOARD_CONFIG.COL_SPACING +
        randomInt(BOARD_CONFIG.JITTER_X) -
        BOARD_CONFIG.JITTER_X / 2;
      const y =
        BOARD_CONFIG.OFFSET_Y +
        row * BOARD_CONFIG.ROW_SPACING +
        randomInt(BOARD_CONFIG.JITTER_Y) -
        BOARD_CONFIG.JITTER_Y / 2;

      return { sym, x, y, matched: false, temp: false };
    });

    const candidates = buildCandidateEdges(cols, rows);
    const disjointSet = createDisjointSet(nodes.length);
    const edges = [];
    const remainingCandidates = [];

    for (const [a, b] of candidates) {
      if (disjointSet.union(a, b)) {
        edges.push({ a, b, w: randomEdgeWeight() });
      } else {
        remainingCandidates.push([a, b]);
      }
    }

    for (const [a, b] of remainingCandidates) {
      if (Math.random() < BOARD_CONFIG.EXTRA_EDGE_PROBABILITY) {
        edges.push({ a, b, w: randomEdgeWeight() });
      }
    }

    const viewBoxHeight =
      BOARD_CONFIG.BASE_HEIGHT + (rows - 1) * BOARD_CONFIG.ROW_SPACING;

    return { nodes, edges, viewBoxHeight };
  }

  PathMatch.graph = {
    randomInt,
    shuffleArray,
    getEdgeCost,
    findEdge,
    calculatePathCost,
    createConnectedGraph,
  };
})();
