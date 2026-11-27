(() => {
  const { BOARD_CONFIG, GameController, renderer, api } = window.PathMatch;

  const DIFFICULTY_LABELS = { e: "Fácil", m: "Médio", h: "Difícil" };
  const COST_LABELS = { w: "Arestas Ponderadas", e: "Arestas Fixas" };
  const THEME_CYCLE = ["auto", "light", "dark"];
  const THEME_LABELS = {
    auto: "Tema: Auto",
    light: "Tema: Claro",
    dark: "Tema: Escuro",
  };

  const views = {
    loading: document.getElementById("loading-view"),
    auth: document.getElementById("auth-view"),
    home: document.getElementById("home-view"),
    game: document.getElementById("game-view"),
  };

  const ui = {
    authThemeBtn: document.getElementById("auth-theme-btn"),
    homeThemeBtn: document.getElementById("home-theme-btn"),
    tabLogin: document.getElementById("tab-login"),
    tabRegister: document.getElementById("tab-register"),
    authForm: document.getElementById("auth-form"),
    authUsername: document.getElementById("auth-username"),
    authPassword: document.getElementById("auth-password"),
    avatarField: document.getElementById("avatar-field"),
    avatarPicker: document.getElementById("avatar-picker"),
    authError: document.getElementById("auth-error"),
    authSubmitBtn: document.getElementById("auth-submit-btn"),
    homeAvatar: document.getElementById("home-avatar"),
    homeUsername: document.getElementById("home-username"),
    gameAvatar: document.getElementById("game-avatar"),
    gameUsername: document.getElementById("game-username"),
    logoutBtn: document.getElementById("logout-btn"),
    statTotal: document.getElementById("stat-total"),
    statBestGraphs: document.getElementById("stat-best-graphs"),
    statTotalGraphs: document.getElementById("stat-total-graphs"),
    statTotalPairs: document.getElementById("stat-total-pairs"),
    rankingTypeTabs: document.getElementById("ranking-type-tabs"),
    rankingDiffTabs: document.getElementById("ranking-diff-tabs"),
    rankingList: document.getElementById("ranking-list"),
    recentMatchesList: document.getElementById("recent-matches-list"),
    startMatchBtn: document.getElementById("start-match-btn"),
    backHomeBtn: document.getElementById("back-home-btn"),
    gameModeSummary: document.getElementById("game-mode-summary"),
    graphsValue: document.getElementById("graphs-value"),
    pairsValue: document.getElementById("pairs-value"),
    energyValue: document.getElementById("energy-value"),
    energyFill: document.getElementById("energy-fill"),
    timerValue: document.getElementById("timer-value"),
    pathCost: document.getElementById("path-cost"),
    costMode: document.getElementById("cost-mode"),
    timeMode: document.getElementById("time-mode"),
    difficulty: document.getElementById("difficulty"),
    confirmBtn: document.getElementById("confirm-btn"),
    clearBtn: document.getElementById("clear-btn"),
    statusMessage: document.getElementById("status-message"),
    graphBoard: document.getElementById("graph-board"),
    modalOverlay: document.getElementById("game-over-modal"),
    modalTitle: document.getElementById("modal-title"),
    modalDescription: document.getElementById("modal-description"),
    playAgainBtn: document.getElementById("play-again-btn"),
    modalHomeBtn: document.getElementById("modal-home-btn"),
  };

  let currentUser = null;
  let authMode = "login";
  let selectedAvatar = "🧠";
  let currentTheme = localStorage.getItem("pm_theme") || "auto";
  let rankingType = "best";
  let rankingDifficulty = "m";

  function showView(name) {
    Object.entries(views).forEach(([key, element]) => {
      element.classList.toggle("is-hidden", key !== name);
    });
  }

  function applyTheme(theme) {
    currentTheme = THEME_CYCLE.includes(theme) ? theme : "auto";
    localStorage.setItem("pm_theme", currentTheme);

    if (currentTheme === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", currentTheme);
    }

    const label = THEME_LABELS[currentTheme];
    ui.authThemeBtn.textContent = label;
    ui.homeThemeBtn.textContent = label;
  }

  async function cycleTheme() {
    const nextIndex = (THEME_CYCLE.indexOf(currentTheme) + 1) % THEME_CYCLE.length;
    const nextTheme = THEME_CYCLE[nextIndex];
    applyTheme(nextTheme);

    if (currentUser) {
      try {
        const { user } = await api.updatePreferences({ theme: nextTheme });
        currentUser = user;
      } catch (_err) {
        // Keep local theme even if network preference sync fails.
      }
    }
  }

  function setAuthMode(mode) {
    authMode = mode;
    const isRegister = mode === "register";

    ui.tabLogin.classList.toggle("is-active", !isRegister);
    ui.tabRegister.classList.toggle("is-active", isRegister);
    ui.tabLogin.setAttribute("aria-selected", String(!isRegister));
    ui.tabRegister.setAttribute("aria-selected", String(isRegister));
    ui.avatarField.classList.toggle("is-hidden", !isRegister);
    ui.authPassword.autocomplete = isRegister ? "new-password" : "current-password";
    ui.authSubmitBtn.textContent = isRegister ? "Criar conta" : "Entrar";
    ui.authError.textContent = "";
  }

  function getSettings() {
    return {
      difficultyKey: ui.difficulty.value,
      costMode: ui.costMode.value,
      timeLimitSeconds: Number(ui.timeMode.value),
    };
  }

  function formatStatValue(value) {
    return typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "Sem dados";
  }

  function renderMatchHistory(data) {
    const { stats = {}, recent = [] } = data || {};
    ui.statTotal.textContent = formatStatValue(stats.totalGames);
    ui.statBestGraphs.textContent = formatStatValue(stats.bestGraphs);
    ui.statTotalGraphs.textContent = formatStatValue(stats.totalGraphs);
    ui.statTotalPairs.textContent = formatStatValue(stats.totalPairs);

    if (!recent || recent.length === 0) {
      ui.recentMatchesList.innerHTML =
        '<li class="history-empty">Nenhuma partida registrada ainda.</li>';
      return;
    }

    ui.recentMatchesList.innerHTML = recent
      .map((match) => {
        const graphs = Number.isFinite(match.graphsCompleted)
          ? match.graphsCompleted
          : 0;
        const pairs = Number.isFinite(match.pairsMatched)
          ? match.pairsMatched
          : 0;
        const duration = Number.isFinite(match.durationSeconds)
          ? match.durationSeconds
          : 0;
        const badgeClass = graphs > 0 ? "badge-win" : "badge-neutral";
        const graphsLabel = graphs === 1 ? "1 grafo" : `${graphs} grafos`;
        const pairsLabel = pairs === 1 ? "1 par" : `${pairs} pares`;
        const diffLabel = DIFFICULTY_LABELS[match.difficulty] || match.difficulty;
        const costLabel = COST_LABELS[match.costMode] || match.costMode;
        const dateLabel = new Date(match.playedAt).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });

        const isUnranked =
          match.timeLimitSeconds === 0 || match.costMode === "e";
        const modeTag = isUnranked ? " · Sem ranking" : "";

        return `
          <li class="history-item">
            <span>
              <span class="badge ${badgeClass}">${graphsLabel}</span>
              <strong>${diffLabel}</strong> · ${costLabel} · ${pairsLabel}${modeTag}
            </span>
            <span>⏱ ${duration}s · ${dateLabel}</span>
          </li>
        `;
      })
      .join("");
  }

  function renderRanking(entries) {
    if (!entries || entries.length === 0) {
      ui.rankingList.innerHTML =
        '<li class="history-empty">Nenhuma partida ranqueada registrada nesta categoria ainda.</li>';
      return;
    }

    ui.rankingList.innerHTML = entries
      .map((entry) => {
        const isMe = currentUser && entry.userId === currentUser.id;
        const graphs = Number.isFinite(entry.graphsCompleted)
          ? entry.graphsCompleted
          : 0;
        const pairs = Number.isFinite(entry.pairsMatched)
          ? entry.pairsMatched
          : 0;
        const time = Number.isFinite(entry.timeSeconds) ? entry.timeSeconds : 0;
        const matches = Number.isFinite(entry.matches) ? entry.matches : 0;
        const graphsLabel = graphs === 1 ? "1 grafo" : `${graphs} grafos`;
        const pairsLabel = pairs === 1 ? "1 par" : `${pairs} pares`;
        const suffix =
          rankingType === "average"
            ? ` · ${matches} ${matches === 1 ? "partida" : "partidas"}`
            : "";
        return `
          <li class="history-item ranking-item${isMe ? " is-me" : ""}">
            <span>
              <span class="rank-pos">#${entry.rank}</span>
              ${entry.avatar} <strong>${entry.username}</strong>
            </span>
            <span>
              <span class="rank-score">${graphsLabel}</span>
              · ${pairsLabel} · ⏱ ${time}s${suffix}
            </span>
          </li>
        `;
      })
      .join("");
  }

  async function loadRankings() {
    try {
      const data = await api.getRankings(rankingType, rankingDifficulty);
      renderRanking(data.entries);
    } catch (_err) {
      ui.rankingList.innerHTML =
        '<li class="history-empty">Não foi possível carregar o ranking.</li>';
    }
  }

  async function enterHome(user) {
    currentUser = user;
    applyTheme(user.theme || currentTheme);
    ui.homeAvatar.textContent = user.avatar;
    ui.homeUsername.textContent = user.username;
    ui.gameAvatar.textContent = user.avatar;
    ui.gameUsername.textContent = user.username;
    showView("home");

    await Promise.all([
      api
        .getMatches()
        .then(renderMatchHistory)
        .catch(() => {
          ui.recentMatchesList.innerHTML =
            '<li class="history-empty">Não foi possível carregar o histórico.</li>';
        }),
      loadRankings(),
    ]);
  }

  const game = new GameController({
    getSettings,
    onStateChange(state) {
      ui.graphBoard.setAttribute(
        "viewBox",
        `0 0 ${BOARD_CONFIG.WIDTH} ${state.viewBoxHeight}`
      );
      renderer.updateHud(ui, state, {
        costMode: ui.costMode.value,
        timeMode: ui.timeMode.value,
      });
      renderer.renderGraphSvg(ui.graphBoard, state, ui.costMode.value);
    },
    onMessage(text, color) {
      renderer.setStatusMessage(ui.statusMessage, text, color);
    },
    async onGameOver(result) {
      const settings = getSettings();
      const isUnranked =
        settings.timeLimitSeconds === 0 || settings.costMode === "e";
      const modalDescription = isUnranked
        ? `${result.description} Este modo não conta para o ranking.`
        : result.description;

      renderer.showGameOverModal(ui, { description: modalDescription });
      if (!currentUser) {
        return;
      }

      try {
        await api.saveMatch({
          difficulty: settings.difficultyKey,
          costMode: settings.costMode,
          timeLimitSeconds: settings.timeLimitSeconds,
          graphsCompleted: result.graphsCompleted,
          pairsMatched: result.pairsMatched,
          energyRemaining: result.energyRemaining,
          maxEnergy: result.maxEnergy,
          durationSeconds: result.durationSeconds,
        });
      } catch (_err) {
        // Match saving failure should not block the game over modal.
      }
    },
    onResetModal() {
      renderer.hideGameOverModal(ui);
    },
  });

  function startMatchFromHome() {
    const { difficultyKey, costMode, timeLimitSeconds } = getSettings();
    const diffLabel = DIFFICULTY_LABELS[difficultyKey] || difficultyKey;
    const costLabel =
      costMode === "e"
        ? "Arestas Fixas (sem ranking)"
        : COST_LABELS[costMode] || costMode;
    const timeLabel =
      timeLimitSeconds === 0
        ? "Sem limite de tempo (sem ranking)"
        : `${timeLimitSeconds}s`;

    ui.gameModeSummary.textContent = `${diffLabel} · ${costLabel} · ${timeLabel}`;
    showView("game");
    game.startNewGame();
  }

  async function returnHome() {
    game.destroy();
    renderer.hideGameOverModal(ui);
    if (currentUser) {
      await enterHome(currentUser);
    } else {
      showView("auth");
    }
  }

  ui.authThemeBtn.addEventListener("click", cycleTheme);
  ui.homeThemeBtn.addEventListener("click", cycleTheme);
  ui.tabLogin.addEventListener("click", () => setAuthMode("login"));
  ui.tabRegister.addEventListener("click", () => setAuthMode("register"));

  ui.avatarPicker.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-avatar]");
    if (!btn) {
      return;
    }
    selectedAvatar = btn.dataset.avatar;
    ui.avatarPicker
      .querySelectorAll(".avatar-btn")
      .forEach((item) => item.classList.toggle("is-selected", item === btn));
  });

  ui.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    ui.authError.textContent = "";
    ui.authSubmitBtn.disabled = true;

    const username = ui.authUsername.value.trim();
    const password = ui.authPassword.value;

    try {
      const data =
        authMode === "register"
          ? await api.register(username, password, selectedAvatar)
          : await api.login(username, password);
      ui.authForm.reset();
      await enterHome(data.user);
    } catch (err) {
      ui.authError.textContent =
        err.message || "Não foi possível entrar agora. Tente novamente.";
    } finally {
      ui.authSubmitBtn.disabled = false;
    }
  });

  ui.logoutBtn.addEventListener("click", async () => {
    game.destroy();
    try {
      await api.logout();
    } catch (_err) {
      // Ignore network errors during logout.
    }
    currentUser = null;
    setAuthMode("login");
    showView("auth");
  });

  ui.startMatchBtn.addEventListener("click", startMatchFromHome);
  ui.backHomeBtn.addEventListener("click", returnHome);
  ui.modalHomeBtn.addEventListener("click", returnHome);

  ui.rankingTypeTabs.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-rank-type]");
    if (!btn) {
      return;
    }
    rankingType = btn.dataset.rankType;
    ui.rankingTypeTabs.querySelectorAll(".subtab").forEach((item) => {
      const active = item === btn;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    loadRankings();
  });

  ui.rankingDiffTabs.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-rank-diff]");
    if (!btn) {
      return;
    }
    rankingDifficulty = btn.dataset.rankDiff;
    ui.rankingDiffTabs.querySelectorAll(".subtab").forEach((item) => {
      const active = item === btn;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    loadRankings();
  });

  ui.graphBoard.addEventListener("click", (event) => {
    const nodeGroup = event.target.closest("[data-node-index]");
    if (nodeGroup) {
      game.handleNodeClick(Number(nodeGroup.dataset.nodeIndex));
    }
  });

  ui.confirmBtn.addEventListener("click", () => game.confirmPath());
  ui.clearBtn.addEventListener("click", () => game.clearPath());
  ui.playAgainBtn.addEventListener("click", () => game.startNewGame());

  async function bootstrap() {
    applyTheme(currentTheme);
    setAuthMode("login");
    try {
      const { user } = await api.getMe();
      await enterHome(user);
    } catch (_err) {
      showView("auth");
    }
  }

  bootstrap();
})();
