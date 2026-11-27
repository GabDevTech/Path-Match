(() => {
  const PathMatch = (window.PathMatch = window.PathMatch || {});
  const { BOARD_CONFIG, COST_MODES } = PathMatch;
  const { calculatePathCost, findEdge } = PathMatch.graph;

  function getStepLabel(path, nodeIndex) {
    const position = path.indexOf(nodeIndex);
    if (position === 0) {
      return "origem";
    }
    if (position === path.length - 1) {
      return "destino";
    }
    return `passo ${position}`;
  }

  function collectActiveEdges(path, edges) {
    const activeEdges = new Set();
    for (let i = 1; i < path.length; i++) {
      const edge = findEdge(edges, path[i - 1], path[i]);
      if (edge) {
        activeEdges.add(edge);
      }
    }
    return activeEdges;
  }

  /**
   * Renders the graph edges, optional edge weights, and card nodes into the SVG element.
   * @param {SVGElement} svgElement
   * @param {{ nodes: Array<object>, edges: Array<object>, path: number[] }} state
   * @param {string} costMode
   */
  function renderGraphSvg(svgElement, state, costMode) {
    const { nodes, edges, path } = state;
    const activeEdges = collectActiveEdges(path, edges);
    const halfWidth = BOARD_CONFIG.CARD_WIDTH / 2;
    const halfHeight = BOARD_CONFIG.CARD_HEIGHT / 2;
    let markup = "";

    for (const edge of edges) {
      const nodeA = nodes[edge.a];
      const nodeB = nodes[edge.b];
      const isHighlighted = activeEdges.has(edge);
      const stroke = isHighlighted ? "var(--accent)" : "var(--edge)";
      const strokeWidth = isHighlighted ? 5 : 2.5;

      markup += `<line x1="${nodeA.x}" y1="${nodeA.y}" x2="${nodeB.x}" y2="${nodeB.y}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }

    if (costMode === COST_MODES.WEIGHTED) {
      for (const edge of edges) {
        const nodeA = nodes[edge.a];
        const nodeB = nodes[edge.b];
        const midX = (nodeA.x + nodeB.x) / 2;
        const midY = (nodeA.y + nodeB.y) / 2;

        markup += `<circle cx="${midX}" cy="${midY}" r="11" fill="var(--card)" stroke="var(--edge)"/>`;
        markup += `<text x="${midX}" y="${midY + 4.5}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ink)">${edge.w}</text>`;
      }
    }

    nodes.forEach((node, index) => {
      const isFaceUp = state.isPreviewing || node.matched || node.temp;
      const isSelected = path.includes(index);
      const cardX = node.x - halfWidth;
      const cardY = node.y - halfHeight;
      const fill = isFaceUp ? "var(--card)" : "var(--card-back)";
      const stroke = isSelected
        ? "var(--accent)"
        : node.matched
          ? "var(--success)"
          : "var(--card-back-border)";
      const strokeWidth = isSelected ? 5 : 3;

      markup += `<g class="graph-node" data-node-index="${index}">`;
      markup += `<rect x="${cardX}" y="${cardY}" width="${BOARD_CONFIG.CARD_WIDTH}" height="${BOARD_CONFIG.CARD_HEIGHT}" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

      if (isFaceUp) {
        markup += `<text x="${node.x}" y="${node.y + 11}" text-anchor="middle" font-size="32">${node.sym}</text>`;
      } else {
        markup += `<text x="${node.x}" y="${node.y + 9}" text-anchor="middle" font-size="26" fill="#fff" opacity=".85">?</text>`;
      }

      if (isSelected) {
        const label = getStepLabel(path, index);
        markup += `<text x="${node.x}" y="${cardY - 5}" text-anchor="middle" font-size="12" fill="var(--accent)" font-weight="700">${label}</text>`;
      }

      markup += "</g>";
    });

    svgElement.innerHTML = markup;
  }

  /**
   * Updates HUD indicators and button states.
   * @param {object} ui
   * @param {object} state
   * @param {{ costMode: string, timeMode: string }} settings
   */
  function updateHud(ui, state, { costMode, timeMode }) {
    const pathCost = calculatePathCost(state.path, state.edges, costMode);
    const energyRatio = state.maxEnergy > 0 ? state.energy / state.maxEnergy : 0;

    ui.energyValue.textContent = String(state.energy);
    ui.pathCost.textContent = String(pathCost);
    ui.graphsValue.textContent = String(state.graphsCompleted);
    ui.pairsValue.textContent = String(state.pairsMatched);
    ui.energyFill.style.width = `${energyRatio * 100}%`;
    ui.energyFill.style.background =
      energyRatio < BOARD_CONFIG.LOW_ENERGY_RATIO
        ? "var(--danger)"
        : "var(--success)";
    ui.timerValue.textContent =
      timeMode === "0" ? "–" : `${state.timeRemaining}s`;

    ui.confirmBtn.disabled =
      state.isGameOver || state.isLocked || state.path.length < 2;
    ui.clearBtn.disabled =
      state.isGameOver || state.isLocked || state.path.length === 0;
  }

  /**
   * Updates the status message banner.
   * @param {HTMLElement} element
   * @param {string} text
   * @param {string} [color]
   */
  function setStatusMessage(element, text, color = "var(--ink)") {
    element.textContent = text;
    element.style.color = color;
  }

  /**
   * Displays the end-of-game modal.
   * @param {object} ui
   * @param {{ won: boolean, description: string }} result
   */
  function showGameOverModal(ui, { description }) {
    ui.modalTitle.textContent = "Fim de jogo";
    ui.modalDescription.textContent = description;
    ui.modalOverlay.classList.add("is-open");
  }

  /**
   * Hides the end-of-game modal.
   * @param {object} ui
   */
  function hideGameOverModal(ui) {
    ui.modalOverlay.classList.remove("is-open");
  }

  PathMatch.renderer = {
    renderGraphSvg,
    updateHud,
    setStatusMessage,
    showGameOverModal,
    hideGameOverModal,
  };
})();
