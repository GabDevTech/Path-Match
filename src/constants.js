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
      unitEnergy: 40,
      weightedBonus: 25,
      unitBonus: 20,
    },
    m: {
      cols: 4,
      rows: 3,
      pairs: 6,
      weightedEnergy: 70,
      unitEnergy: 56,
      weightedBonus: 40,
      unitBonus: 32,
    },
    h: {
      cols: 4,
      rows: 4,
      pairs: 8,
      weightedEnergy: 100,
      unitEnergy: 80,
      weightedBonus: 60,
      unitBonus: 48,
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
    FIXED_EDGE_COST: 2,
    WEIGHTED_EDGE_DISTRIBUTION: [
      { weight: 2, probability: 0.45 },
      { weight: 3, probability: 0.4 },
      { weight: 4, probability: 0.15 },
    ],
    EXTRA_EDGE_PROBABILITY: 0.5,
    MISMATCH_DELAY_MS: 1300,
    PREVIEW_DURATION_MS: 3000,
    NEXT_GRAPH_DELAY_MS: 900,
    LOW_ENERGY_RATIO: 0.3,
  };
})();
