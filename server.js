const crypto = require("crypto");
const path = require("path");
const { promisify } = require("util");
const express = require("express");
const { Pool } = require("pg");

const scryptAsync = promisify(crypto.scrypt);

const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://pathmatch:pathmatch@localhost:5432/pathmatch";

const SESSION_COOKIE = "pm_session";
const SESSION_TTL_DAYS = 30;
const ALLOWED_AVATARS = new Set(["🧠", "🦊", "🚀", "🎲", "🐙", "🔥", "🐳", "🎸"]);
const ALLOWED_THEMES = new Set(["auto", "light", "dark"]);
const ALLOWED_DIFFICULTIES = new Set(["e", "m", "h"]);
const ALLOWED_COST_MODES = new Set(["w", "e"]);
const ALLOWED_TIME_LIMITS = new Set([120, 0]);
const ALLOWED_RANKING_TYPES = new Set(["best", "average"]);

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();

app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (
    origin === "null" ||
    (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(32) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar VARCHAR(16) NOT NULL DEFAULT '🧠',
      theme VARCHAR(10) NOT NULL DEFAULT 'auto',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(64) PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      difficulty VARCHAR(4) NOT NULL,
      cost_mode VARCHAR(4) NOT NULL,
      time_limit_seconds INTEGER NOT NULL,
      won BOOLEAN NOT NULL DEFAULT FALSE,
      graphs_completed INTEGER NOT NULL DEFAULT 0,
      pairs_matched INTEGER NOT NULL DEFAULT 0,
      energy_remaining INTEGER NOT NULL,
      max_energy INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE matches ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE matches ADD COLUMN IF NOT EXISTS graphs_completed INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE matches ADD COLUMN IF NOT EXISTS pairs_matched INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_matches_user_played ON matches(user_id, played_at DESC);
    CREATE INDEX IF NOT EXISTS idx_matches_endless_ranking
      ON matches(difficulty, time_limit_seconds, graphs_completed DESC, pairs_matched DESC, duration_seconds ASC);
  `);
}

function parseCookies(headerValue) {
  const cookies = {};
  if (!headerValue) {
    return cookies;
  }
  for (const part of headerValue.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const key = part.slice(0, eqIndex).trim();
    const val = decodeURIComponent(part.slice(eqIndex + 1).trim());
    cookies[key] = val;
  }
  return cookies;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, keyHex] = String(storedHash).split(":");
  if (!salt || !keyHex) {
    return false;
  }
  const keyBuffer = Buffer.from(keyHex, "hex");
  const derived = await scryptAsync(password, salt, 64);
  if (keyBuffer.length !== derived.length) {
    return false;
  }
  return crypto.timingSafeEqual(keyBuffer, derived);
}

function setSessionCookie(req, res, token, maxAgeMs) {
  const isHttps =
    req.secure || req.get("x-forwarded-proto") === "https";
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: maxAgeMs,
  });
}

async function createSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const maxAgeMs = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + maxAgeMs);

  await pool.query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt]
  );

  setSessionCookie(req, res, token, maxAgeMs);
  return token;
}

function getSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE]) {
    return cookies[SESSION_COOKIE];
  }
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim() || null;
  }
  return null;
}

async function getAuthenticatedUser(req) {
  const token = getSessionToken(req);
  if (!token) {
    return null;
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.avatar, u.theme, s.token
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );

  return rows[0] || null;
}

async function requireAuth(req, res, next) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Sessão expirada ou inválida." });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

function sanitizeUser(row) {
  return {
    id: row.id,
    username: row.username,
    avatar: row.avatar,
    theme: row.theme,
  };
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ ok: false, error: "Banco de dados indisponível." });
  }
});

app.get("/api/auth/me", async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    return next(err);
  }
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const avatar = ALLOWED_AVATARS.has(req.body?.avatar)
      ? req.body.avatar
      : "🧠";

    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) {
      return res.status(400).json({
        error:
          "Usuário deve ter entre 3 e 24 caracteres (letras, números, . _ -).",
      });
    }

    if (password.length < 4 || password.length > 100) {
      return res.status(400).json({
        error: "A senha deve ter pelo menos 4 caracteres.",
      });
    }

    const passwordHash = await hashPassword(password);

    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, avatar)
       VALUES ($1, $2, $3)
       RETURNING id, username, avatar, theme`,
      [username, passwordHash, avatar]
    );

    const user = rows[0];
    const token = await createSession(req, res, user.id);
    return res.status(201).json({ user: sanitizeUser(user), token });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Este nome de usuário já está em uso." });
    }
    return next(err);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Informe usuário e senha." });
    }

    const { rows } = await pool.query(
      `SELECT id, username, password_hash, avatar, theme
       FROM users
       WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res
        .status(401)
        .json({ error: "Usuário ou senha incorretos." });
    }

    const token = await createSession(req, res, user.id);
    return res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    return next(err);
  }
});

app.post("/api/auth/logout", async (req, res, next) => {
  try {
    const token = getSessionToken(req);
    if (token) {
      await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
    }
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

app.patch("/api/user/preferences", requireAuth, async (req, res, next) => {
  try {
    const updates = [];
    const values = [];

    if (req.body?.theme !== undefined) {
      if (!ALLOWED_THEMES.has(req.body.theme)) {
        return res.status(400).json({ error: "Tema inválido." });
      }
      values.push(req.body.theme);
      updates.push(`theme = $${values.length}`);
    }

    if (req.body?.avatar !== undefined) {
      if (!ALLOWED_AVATARS.has(req.body.avatar)) {
        return res.status(400).json({ error: "Avatar inválido." });
      }
      values.push(req.body.avatar);
      updates.push(`avatar = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.json({ user: sanitizeUser(req.user) });
    }

    values.push(req.user.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${values.length}
       RETURNING id, username, avatar, theme`,
      values
    );

    return res.json({ user: sanitizeUser(rows[0]) });
  } catch (err) {
    return next(err);
  }
});

app.get("/api/matches", requireAuth, async (req, res, next) => {
  try {
    const [statsRes, recentRes] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total_games,
           COALESCE(MAX(graphs_completed), 0)::int AS best_graphs,
           COALESCE(SUM(graphs_completed), 0)::int AS total_graphs,
           COALESCE(SUM(pairs_matched), 0)::int AS total_pairs
         FROM matches
         WHERE user_id = $1`,
        [req.user.id]
      ),
      pool.query(
        `SELECT id, difficulty, cost_mode, time_limit_seconds,
                graphs_completed, pairs_matched,
                energy_remaining, max_energy, duration_seconds, played_at
         FROM matches
         WHERE user_id = $1
         ORDER BY played_at DESC
         LIMIT 10`,
        [req.user.id]
      ),
    ]);

    const stats = statsRes.rows[0];

    return res.json({
      stats: {
        totalGames: stats.total_games,
        bestGraphs: stats.best_graphs,
        totalGraphs: stats.total_graphs,
        totalPairs: stats.total_pairs,
      },
      recent: recentRes.rows.map((row) => ({
        id: row.id,
        difficulty: row.difficulty,
        costMode: row.cost_mode,
        timeLimitSeconds: row.time_limit_seconds,
        graphsCompleted: row.graphs_completed,
        pairsMatched: row.pairs_matched,
        energyRemaining: row.energy_remaining,
        maxEnergy: row.max_energy,
        durationSeconds: row.duration_seconds,
        playedAt: row.played_at,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

app.post("/api/matches", requireAuth, async (req, res, next) => {
  try {
    const difficulty = String(req.body?.difficulty || "");
    const costMode = String(req.body?.costMode || "");
    const timeLimitSeconds = Number(req.body?.timeLimitSeconds);
    const graphsCompleted = Number(req.body?.graphsCompleted);
    const pairsMatched = Number(req.body?.pairsMatched);
    const energyRemaining = Number(req.body?.energyRemaining);
    const maxEnergy = Number(req.body?.maxEnergy);
    const durationSeconds = Math.max(
      0,
      Math.round(Number(req.body?.durationSeconds) || 0)
    );

    const safeTimeLimit = Math.round(timeLimitSeconds);

    if (
      !ALLOWED_DIFFICULTIES.has(difficulty) ||
      !ALLOWED_COST_MODES.has(costMode) ||
      !Number.isFinite(timeLimitSeconds) ||
      !ALLOWED_TIME_LIMITS.has(safeTimeLimit) ||
      !Number.isFinite(graphsCompleted) ||
      graphsCompleted < 0 ||
      !Number.isFinite(pairsMatched) ||
      pairsMatched < 0 ||
      !Number.isFinite(energyRemaining) ||
      !Number.isFinite(maxEnergy) ||
      maxEnergy <= 0
    ) {
      return res.status(400).json({ error: "Dados da partida inválidos." });
    }

    const safeGraphs = Math.max(0, Math.round(graphsCompleted));
    const safePairs = Math.max(0, Math.round(pairsMatched));
    const safeEnergy = Math.max(0, Math.round(energyRemaining));
    const safeMaxEnergy = Math.round(maxEnergy);

    const { rows } = await pool.query(
      `INSERT INTO matches (
         user_id, difficulty, cost_mode, time_limit_seconds,
         won, graphs_completed, pairs_matched,
         energy_remaining, max_energy, duration_seconds, score
       ) VALUES ($1, $2, $3, $4, FALSE, $5, $6, $7, $8, $9, 0)
       RETURNING id, graphs_completed, pairs_matched, duration_seconds, played_at`,
      [
        req.user.id,
        difficulty,
        costMode,
        safeTimeLimit,
        safeGraphs,
        safePairs,
        safeEnergy,
        safeMaxEnergy,
        durationSeconds,
      ]
    );

    return res.status(201).json({ match: rows[0] });
  } catch (err) {
    return next(err);
  }
});

app.get("/api/rankings", requireAuth, async (req, res, next) => {
  try {
    const type = ALLOWED_RANKING_TYPES.has(req.query.type)
      ? req.query.type
      : "best";
    const difficulty = ALLOWED_DIFFICULTIES.has(req.query.difficulty)
      ? req.query.difficulty
      : "m";

    const sql =
      type === "average"
        ? `SELECT u.id, u.username, u.avatar,
                  ROUND(AVG(m.graphs_completed)::numeric, 1)::float AS graphs_completed,
                  ROUND(AVG(m.pairs_matched)::numeric, 1)::float AS pairs_matched,
                  ROUND(AVG(m.duration_seconds))::int AS time_seconds,
                  COUNT(*)::int AS matches
           FROM matches m
           JOIN users u ON u.id = m.user_id
           WHERE m.difficulty = $1 AND m.time_limit_seconds > 0 AND m.cost_mode = 'w'
           GROUP BY u.id
           ORDER BY AVG(m.graphs_completed) DESC, AVG(m.pairs_matched) DESC, AVG(m.duration_seconds) ASC
           LIMIT 20`
        : `WITH ranked AS (
             SELECT m.user_id,
                    m.graphs_completed,
                    m.pairs_matched,
                    m.duration_seconds,
                    COUNT(*) OVER (PARTITION BY m.user_id)::int AS matches,
                    ROW_NUMBER() OVER (
                      PARTITION BY m.user_id
                      ORDER BY m.graphs_completed DESC, m.pairs_matched DESC, m.duration_seconds ASC
                    ) AS rn
             FROM matches m
             WHERE m.difficulty = $1 AND m.time_limit_seconds > 0 AND m.cost_mode = 'w'
           )
           SELECT u.id, u.username, u.avatar,
                  r.graphs_completed::int AS graphs_completed,
                  r.pairs_matched::int AS pairs_matched,
                  r.duration_seconds::int AS time_seconds,
                  r.matches
           FROM ranked r
           JOIN users u ON u.id = r.user_id
           WHERE r.rn = 1
           ORDER BY r.graphs_completed DESC, r.pairs_matched DESC, r.duration_seconds ASC
           LIMIT 20`;

    const { rows } = await pool.query(sql, [difficulty]);

    return res.json({
      type,
      difficulty,
      entries: rows.map((row, index) => ({
        rank: index + 1,
        userId: row.id,
        username: row.username,
        avatar: row.avatar,
        graphsCompleted: row.graphs_completed,
        pairsMatched: row.pairs_matched,
        timeSeconds: row.time_seconds,
        matches: row.matches,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

app.use("/styles", express.static(path.join(__dirname, "styles")));
app.use("/src", express.static(path.join(__dirname, "src")));
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res
    .status(500)
    .json({ error: "Ocorreu um erro inesperado. Tente novamente em instantes." });
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Memória em Grafo rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Falha ao inicializar banco de dados:", err);
    process.exit(1);
  });
