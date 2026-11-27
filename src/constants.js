(() => {
  const PathMatch = (window.PathMatch = window.PathMatch || {});

  PathMatch.CARD_SYMBOLS = ["🍎", "🚀", "🎲", "🌵", "🐙", "🎸", "🐳", "🔥"];

  PathMatch.COST_MODES = {
    WEIGHTED: "w",
    UNIT: "e",
  };

  PathMatch.DIFFICULTIES = {
    e: {
      cols: 4,
      rows: 2,
      pairs: 4,
      weightedEnergy: 50,
      unitEnergy: 26,
      weightedBonus: 25,
      unitBonus: 14,
    },
    m: {
      cols: 4,
      rows: 3,
      pairs: 6,
      weightedEnergy: 70,
      unitEnergy: 36,
      weightedBonus: 40,
      unitBonus: 20,
    },
    h: {
      cols: 4,
      rows: 4,
      pairs: 8,
      weightedEnergy: 100,
      unitEnergy: 50,
      weightedBonus: 60,
      unitBonus: 30,
    },
  };

  PathMatch.BOARD_CONFIG = {
    WIDTH: 720,
    BASE_HEIGHT: 180,
    ROW_SPACING: 150,
    COL_SPACING: 173,
    OFFSET_X: 100,
    OFFSET_Y: 90,
    JITTER_X: 40,
    JITTER_Y: 30,
    CARD_WIDTH: 62,
    CARD_HEIGHT: 80,
    MIN_EDGE_WEIGHT: 1,
    MAX_EDGE_WEIGHT: 5,
    EXTRA_EDGE_PROBABILITY: 0.5,
    MISMATCH_DELAY_MS: 1300,
    NEXT_GRAPH_DELAY_MS: 900,
    LOW_ENERGY_RATIO: 0.3,
  };
})();
