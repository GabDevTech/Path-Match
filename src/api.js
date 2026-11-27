(() => {
  const PathMatch = (window.PathMatch = window.PathMatch || {});
  const isFileProtocol = window.location.protocol === "file:";
  const API_BASE = isFileProtocol ? "http://localhost:3000" : "";
  const TOKEN_STORAGE_KEY = "pm_session_token";

  function getStoredToken() {
    if (!isFileProtocol) {
      return null;
    }
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function setStoredToken(token) {
    if (!isFileProtocol) {
      return;
    }
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors.
    }
  }

  async function request(url, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    const token = getStoredToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response;
    try {
      response = await fetch(`${API_BASE}${url}`, {
        credentials: isFileProtocol ? "omit" : "same-origin",
        ...options,
        headers,
      });
    } catch (err) {
      console.error("[PathMatch] Falha de conexão com a API:", err);
      throw new Error(
        "Não foi possível conectar ao servidor no momento. Tente novamente em instantes."
      );
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        data.error || "Não foi possível concluir a ação. Tente novamente."
      );
      error.status = response.status;
      throw error;
    }
    return data;
  }

  PathMatch.api = {
    getMe() {
      return request("/api/auth/me");
    },
    async login(username, password) {
      const data = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (data.token) {
        setStoredToken(data.token);
      }
      return data;
    },
    async register(username, password, avatar) {
      const data = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password, avatar }),
      });
      if (data.token) {
        setStoredToken(data.token);
      }
      return data;
    },
    async logout() {
      try {
        return await request("/api/auth/logout", { method: "POST" });
      } finally {
        setStoredToken(null);
      }
    },
    updatePreferences(preferences) {
      return request("/api/user/preferences", {
        method: "PATCH",
        body: JSON.stringify(preferences),
      });
    },
    getMatches() {
      return request("/api/matches");
    },
    saveMatch(match) {
      return request("/api/matches", {
        method: "POST",
        body: JSON.stringify(match),
      });
    },
    getRankings(type, difficulty) {
      const params = new URLSearchParams({ type, difficulty });
      return request(`/api/rankings?${params.toString()}`);
    },
  };
})();
