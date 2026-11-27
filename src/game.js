(() => {
  const PathMatch = (window.PathMatch = window.PathMatch || {});
  const { BOARD_CONFIG, COST_MODES, DIFFICULTIES } = PathMatch;
  const { calculatePathCost, createConnectedGraph, findEdge } = PathMatch.graph;

  class GameController {
    /**
     * @param {object} options
     * @param {() => { difficultyKey: string, costMode: string, timeLimitSeconds: number }} options.getSettings
     * @param {(state: object) => void} options.onStateChange
     * @param {(text: string, color?: string) => void} options.onMessage
     * @param {(result: { won: boolean, description: string }) => void} options.onGameOver
     * @param {() => void} options.onResetModal
     */
    constructor({
      getSettings,
      onStateChange,
      onMessage,
      onGameOver,
      onResetModal,
    }) {
      this.getSettings = getSettings;
      this.onStateChange = onStateChange;
      this.onMessage = onMessage;
      this.onGameOver = onGameOver;
      this.onResetModal = onResetModal;

      this.nodes = [];
      this.edges = [];
      this.path = [];
      this.viewBoxHeight = 480;
      this.energy = 0;
      this.maxEnergy = 0;
      this.graphsCompleted = 0;
      this.pairsMatched = 0;
      this.timeRemaining = 0;
      this.startedAt = 0;
      this.timerId = null;
      this.transitionTimeoutId = null;
      this.mismatchTimeoutId = null;
      this.previewTimeoutId = null;
      this.isPreviewing = false;
      this.isGameOver = false;
      this.isLocked = false;
    }

    getState() {
      return {
        nodes: this.nodes,
        edges: this.edges,
        path: this.path,
        viewBoxHeight: this.viewBoxHeight,
        energy: this.energy,
        maxEnergy: this.maxEnergy,
        graphsCompleted: this.graphsCompleted,
        pairsMatched: this.pairsMatched,
        timeRemaining: this.timeRemaining,
        isPreviewing: this.isPreviewing,
        isGameOver: this.isGameOver,
        isLocked: this.isLocked,
      };
    }

    startNewGame() {
      this.clearTimers();
      this.onResetModal();

      this.isGameOver = false;
      this.isLocked = false;
      this.isPreviewing = false;
      this.path = [];
      this.graphsCompleted = 0;
      this.pairsMatched = 0;

      const { difficultyKey, costMode, timeLimitSeconds } = this.getSettings();
      const difficulty = DIFFICULTIES[difficultyKey];
      const initialEnergy =
        costMode === COST_MODES.WEIGHTED
          ? difficulty.weightedEnergy
          : difficulty.unitEnergy;

      this.energy = initialEnergy;
      this.maxEnergy = initialEnergy;
      this.startedAt = Date.now();

      this.loadNextGraph(difficulty, timeLimitSeconds);
      this.notifyStateChange();
    }

    loadNextGraph(difficulty, timeLimitSeconds) {
      const graph = createConnectedGraph(difficulty);
      this.nodes = graph.nodes;
      this.edges = graph.edges;
      this.viewBoxHeight = graph.viewBoxHeight;
      this.path = [];

      this.stopTimer();
      this.timeRemaining = timeLimitSeconds;
      this.isPreviewing = true;
      this.isLocked = true;

      const graphNumber = this.graphsCompleted + 1;
      const previewSeconds = Math.round(BOARD_CONFIG.PREVIEW_DURATION_MS / 1000);
      this.onMessage(
        `Grafo #${graphNumber}: memorize as cartas! (${previewSeconds}s)`
      );

      this.previewTimeoutId = setTimeout(() => {
        this.previewTimeoutId = null;
        if (this.isGameOver) {
          return;
        }
        this.isPreviewing = false;
        this.isLocked = false;
        if (this.timeRemaining > 0) {
          this.timerId = setInterval(() => this.tickTimer(), 1000);
        }
        this.onMessage("Escolha uma carta de origem.");
        this.notifyStateChange();
      }, BOARD_CONFIG.PREVIEW_DURATION_MS);
    }

    handleNodeClick(nodeIndex) {
      if (this.isGameOver || this.isLocked) {
        return;
      }

      if (this.path.length === 0) {
        if (this.nodes[nodeIndex].matched) {
          this.onMessage(
            "Escolha uma carta ainda virada para baixo.",
            "var(--danger)"
          );
          return;
        }
        this.path = [nodeIndex];
        this.onMessage("Agora monte o caminho pelas arestas.");
        this.notifyStateChange();
        return;
      }

      const lastIndex = this.path[this.path.length - 1];
      const existingIndex = this.path.indexOf(nodeIndex);

      if (existingIndex === this.path.length - 1) {
        this.path.pop();
        if (this.path.length === 0) {
          this.onMessage("Escolha uma carta de origem.");
        }
        this.notifyStateChange();
        return;
      }

      if (existingIndex !== -1) {
        this.path = this.path.slice(0, existingIndex + 1);
        this.notifyStateChange();
        return;
      }

      if (findEdge(this.edges, lastIndex, nodeIndex)) {
        this.path.push(nodeIndex);
        this.notifyStateChange();
      } else {
        this.onMessage(
          "Essas cartas não estão ligadas por uma aresta.",
          "var(--danger)"
        );
      }
    }

    confirmPath() {
      if (this.isGameOver || this.isLocked || this.path.length < 2) {
        return;
      }

      const startIndex = this.path[0];
      const endIndex = this.path[this.path.length - 1];

      if (this.nodes[endIndex].matched) {
        this.onMessage(
          "O destino precisa estar virado para baixo.",
          "var(--danger)"
        );
        return;
      }

      const { costMode } = this.getSettings();
      const cost = calculatePathCost(this.path, this.edges, costMode);

      this.path = [];

      const startNode = this.nodes[startIndex];
      const endNode = this.nodes[endIndex];
      const isMatch = startNode.sym === endNode.sym;

      if (!isMatch) {
        this.energy = Math.max(0, this.energy - cost);
      }

      startNode.temp = true;
      endNode.temp = true;

      if (isMatch) {
        startNode.matched = true;
        endNode.matched = true;
        startNode.temp = false;
        endNode.temp = false;
        this.pairsMatched += 1;
        this.onMessage(
          `Par encontrado! ${startNode.sym} (sem gasto de energia)`,
          "var(--success)"
        );
      } else {
        this.onMessage("Não combinam. Memorize!", "var(--danger)");
        this.isLocked = true;
        this.mismatchTimeoutId = setTimeout(() => {
          this.mismatchTimeoutId = null;
          startNode.temp = false;
          endNode.temp = false;
          this.isLocked = false;
          this.notifyStateChange();
        }, BOARD_CONFIG.MISMATCH_DELAY_MS);
      }

      if (this.nodes.every((node) => node.matched)) {
        this.advanceToNextGraph();
      } else if (this.energy <= 0) {
        this.endGame("A energia acabou.");
      }

      this.notifyStateChange();
    }

    advanceToNextGraph() {
      const { difficultyKey, costMode, timeLimitSeconds } = this.getSettings();
      const difficulty = DIFFICULTIES[difficultyKey];
      const energyBonus =
        costMode === COST_MODES.WEIGHTED
          ? difficulty.weightedBonus
          : difficulty.unitBonus;

      this.graphsCompleted += 1;
      this.energy += energyBonus;
      this.maxEnergy = Math.max(this.maxEnergy, this.energy);
      this.isLocked = true;
      this.stopTimer();

      const timerHint = timeLimitSeconds > 0 ? " Tempo reiniciado!" : "";
      this.onMessage(
        `Grafo #${this.graphsCompleted} completo! +${energyBonus}⚡ de energia.${timerHint}`,
        "var(--success)"
      );

      this.transitionTimeoutId = setTimeout(() => {
        this.transitionTimeoutId = null;
        if (this.isGameOver) {
          return;
        }
        this.loadNextGraph(difficulty, timeLimitSeconds);
        this.notifyStateChange();
      }, BOARD_CONFIG.NEXT_GRAPH_DELAY_MS);
    }

    clearPath() {
      if (this.isGameOver || this.isLocked) {
        return;
      }
      this.path = [];
      this.onMessage("Caminho limpo.");
      this.notifyStateChange();
    }

    endGame(reason) {
      this.isGameOver = true;
      this.clearTimers();
      const durationSeconds = this.startedAt
        ? Math.max(0, Math.round((Date.now() - this.startedAt) / 1000))
        : 0;
      this.onGameOver({
        graphsCompleted: this.graphsCompleted,
        pairsMatched: this.pairsMatched,
        energyRemaining: this.energy,
        maxEnergy: this.maxEnergy,
        durationSeconds,
        description: `${reason} Grafos completos: ${this.graphsCompleted} · Pares: ${this.pairsMatched} · Tempo: ${durationSeconds}s.`,
      });
    }

    destroy() {
      this.clearTimers();
    }

    tickTimer() {
      this.timeRemaining -= 1;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.endGame("O tempo acabou.");
      }
      this.notifyStateChange();
    }

    stopTimer() {
      if (this.timerId !== null) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }

    clearTimers() {
      this.stopTimer();
      if (this.transitionTimeoutId !== null) {
        clearTimeout(this.transitionTimeoutId);
        this.transitionTimeoutId = null;
      }
      if (this.mismatchTimeoutId !== null) {
        clearTimeout(this.mismatchTimeoutId);
        this.mismatchTimeoutId = null;
      }
      if (this.previewTimeoutId !== null) {
        clearTimeout(this.previewTimeoutId);
        this.previewTimeoutId = null;
      }
    }

    notifyStateChange() {
      this.onStateChange(this.getState());
    }
  }

  PathMatch.GameController = GameController;
})();
