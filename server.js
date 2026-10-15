// =====================================================================
//  École de disciples · The Divine Arsenal Corporation
//  Serveur autonome : Node.js 22+, aucune dépendance externe.
//  Base de données SQLite dans DATA_DIR (volume persistant Coolify).
// =====================================================================
"use strict";
process.removeAllListeners("warning"); // masque l'avertissement « SQLite experimental »
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = +(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || "/data";
const PUBLIC = path.join(__dirname, "public");
const SESSION_DAYS = +(process.env.SESSION_DAYS || 30);
const COOKIE_SECURE = (process.env.COOKIE_SECURE || "auto").toLowerCase(); // auto | true | false
const ALLOW_SIGNUP = (process.env.ALLOW_SIGNUP || "true").toLowerCase() !== "false";
const COOKIE = "dac_session";

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "ecole.db"));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, pw TEXT NOT NULL, full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin','superadmin')),
  class_id TEXT, mentor_id TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, mentor_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS unlocks (id TEXT PRIMARY KEY, class_id TEXT, student_id TEXT, lesson TEXT NOT NULL, unlocked_by TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS answers (student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}',
  submitted INTEGER NOT NULL DEFAULT 0, submitted_at TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (student_id, lesson));
CREATE TABLE IF NOT EXISTS reviews (student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson TEXT NOT NULL, items TEXT NOT NULL DEFAULT '{}',
  general TEXT NOT NULL DEFAULT '', validated INTEGER NOT NULL DEFAULT 0, mentor_id TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (student_id, lesson));
CREATE TABLE IF NOT EXISTS quiz (id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson TEXT NOT NULL,
  score INTEGER NOT NULL, total INTEGER NOT NULL, detail TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson TEXT NOT NULL, item_key TEXT NOT NULL,
  author_id TEXT NOT NULL, body TEXT NOT NULL, read_by_student INTEGER NOT NULL DEFAULT 0, read_by_staff INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_msg_student ON messages(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_student ON quiz(student_id);
CREATE INDEX IF NOT EXISTS idx_users_mentor ON users(mentor_id);
`);

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const q = (sql) => db.prepare(sql);
const one = (sql, ...a) => q(sql).get(...a) || null;
const all = (sql, ...a) => q(sql).all(...a);
const run = (sql, ...a) => q(sql).run(...a);

// ---------- mots de passe (scrypt) ----------
function hashPw(pw) { const salt = crypto.randomBytes(16).toString("hex"); return "s1$" + salt + "$" + crypto.scryptSync(pw, salt, 64).toString("hex"); }
function checkPw(pw, stored) {
  const [v, salt, h] = String(stored).split("$"); if (v !== "s1" || !salt || !h) return false;
  const a = Buffer.from(h, "hex"), b = crypto.scryptSync(pw, salt, 64); return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- superadmin initial (variables d'environnement) ----------
(function bootstrap() {
  const u = (process.env.SUPERADMIN_USERNAME || "").trim().toLowerCase(), p = process.env.SUPERADMIN_PASSWORD || "";
  if (!u || !p) return;
  const existing = one("SELECT * FROM users WHERE username = ?", u);
  if (!existing) {
    run("INSERT INTO users (id, username, pw, full_name, role, active, created_at) VALUES (?,?,?,?,?,1,?)", uid(), u, hashPw(p), process.env.SUPERADMIN_NAME || "Superadmin", "superadmin", now());
    console.log("Superadmin créé :", u);
  } else if (existing.role !== "superadmin" || !existing.active) {
    run("UPDATE users SET role = 'superadmin', active = 1 WHERE id = ?", existing.id);
  }
  if ((process.env.SUPERADMIN_RESET_PASSWORD || "").toLowerCase() === "true") { run("UPDATE users SET pw = ? WHERE username = ?", hashPw(p), u); console.log("Mot de passe superadmin réinitialisé"); }
})();

// ---------- aides HTTP ----------
function send(res, code, obj, headers = {}) {
  const body = JSON.stringify(obj === undefined ? null : obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }); res.end(body);
}
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const fail = (code, msg) => { throw new HttpError(code, msg); };
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 2 * 1024 * 1024) { reject(new HttpError(413, "Données trop volumineuses")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (e) { reject(new HttpError(400, "JSON invalide")); } });
    req.on("error", reject);
  });
}
function cookies(req) { const o = {}; (req.headers.cookie || "").split(";").forEach(p => { const i = p.indexOf("="); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
function isSecure(req) { if (COOKIE_SECURE === "true") return true; if (COOKIE_SECURE === "false") return false; return (req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https"; }
function sessionCookie(req, token, maxAge) { return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isSecure(req) ? "; Secure" : ""}`; }

// ---------- représentation publique ----------
const pubUser = (u) => u && ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role, class_id: u.class_id, mentor_id: u.mentor_id, active: !!u.active, created_at: u.created_at });
const pubAns = (a) => a && ({ student_id: a.student_id, lesson: a.lesson, data: JSON.parse(a.data || "{}"), submitted: !!a.submitted, submitted_at: a.submitted_at, updated_at: a.updated_at });
const pubRev = (r) => r && ({ student_id: r.student_id, lesson: r.lesson, items: JSON.parse(r.items || "{}"), general: r.general, validated: !!r.validated, mentor_id: r.mentor_id, updated_at: r.updated_at });
const pubQuiz = (x) => ({ id: x.id, student_id: x.student_id, lesson: x.lesson, score: x.score, total: x.total, detail: JSON.parse(x.detail || "[]"), created_at: x.created_at });
const pubMsg = (m) => ({ ...m, read_by_student: !!m.read_by_student, read_by_staff: !!m.read_by_staff });

// ---------- droits ----------
const isSuper = (me) => me && me.role === "superadmin";
const isStaff = (me) => me && (me.role === "admin" || me.role === "superadmin");
function mentorOfClass(me, cid) { if (!cid) return false; if (isSuper(me)) return true; const c = one("SELECT mentor_id FROM classes WHERE id = ?", cid); return isStaff(me) && c && c.mentor_id === me.id; }
function staffFor(me, sid) {
  if (isSuper(me)) return true; if (!isStaff(me)) return false;
  const s = one("SELECT mentor_id, class_id FROM users WHERE id = ?", sid); if (!s) return false;
  return s.mentor_id === me.id || mentorOfClass(me, s.class_id);
}
const canSee = (me, sid) => me && (sid === me.id || staffFor(me, sid));
const idsParam = (url) => (url.searchParams.get("ids") || "").split(",").filter(Boolean).slice(0, 2000);
const LESSON_RE = /^[1-3]-\d{1,2}$/;
const checkLesson = (l) => { if (!LESSON_RE.test(String(l || ""))) fail(400, "Leçon invalide"); return l; };

// ---------- limitation des tentatives de connexion ----------
const attempts = new Map();
function throttle(key) {
  const t = Date.now(), a = (attempts.get(key) || []).filter(x => t - x < 10 * 60 * 1000);
  if (a.length >= 10) fail(429, "Trop de tentatives. Réessaie dans quelques minutes.");
  a.push(t); attempts.set(key, a);
}

// ---------- routes API ----------
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), handler });

route("GET", "/api/health", () => ({ ok: true }));

route("GET", "/api/me", ({ me }) => pubUser(me));

route("POST", "/api/login", ({ body, req, res }) => {
  const username = String(body.username || "").trim().toLowerCase(), password = String(body.password || "");
  throttle((req.headers["x-forwarded-for"] || req.socket.remoteAddress || "") + "|" + username);
  const u = one("SELECT * FROM users WHERE username = ?", username);
  if (!u || !checkPw(password, u.pw)) fail(401, "Identifiant ou mot de passe incorrect");
  if (!u.active) fail(403, "Ce compte est désactivé. Contacte ton responsable.");
  const token = crypto.randomBytes(32).toString("hex");
  run("INSERT INTO sessions (token, user_id, expires) VALUES (?,?,?)", token, u.id, Date.now() + SESSION_DAYS * 864e5);
  run("DELETE FROM sessions WHERE expires < ?", Date.now());
  res.setHeader("Set-Cookie", sessionCookie(req, token, SESSION_DAYS * 86400));
  return pubUser(u);
});

route("POST", "/api/signup", ({ body, req, res }) => {
  const username = String(body.username || "").trim().toLowerCase(), password = String(body.password || ""), full_name = String(body.full_name || "").trim().slice(0, 120);
  const code = String(body.class_code || "").trim().toUpperCase();
  throttle("signup|" + (req.headers["x-forwarded-for"] || req.socket.remoteAddress || ""));
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) fail(400, "Identifiant : 3 à 30 caractères (lettres, chiffres, . _ -)");
  if (password.length < 6) fail(400, "Mot de passe : 6 caractères minimum");
  if (!full_name) fail(400, "Écris ton nom complet");
  const first = !one("SELECT id FROM users LIMIT 1");
  if (!first && !ALLOW_SIGNUP) fail(403, "Les inscriptions sont fermées. Contacte ton responsable.");
  let cls = null;
  if (!first) { cls = one("SELECT * FROM classes WHERE upper(code) = ?", code); if (!cls) fail(400, "Code de classe invalide"); }
  if (one("SELECT id FROM users WHERE username = ?", username)) fail(409, "Cet identifiant est déjà pris");
  const id = uid();
  run("INSERT INTO users (id, username, pw, full_name, role, class_id, mentor_id, active, created_at) VALUES (?,?,?,?,?,?,?,1,?)",
    id, username, hashPw(password), full_name, first ? "superadmin" : "student", cls ? cls.id : null, cls ? cls.mentor_id : null, now());
  const token = crypto.randomBytes(32).toString("hex");
  run("INSERT INTO sessions (token, user_id, expires) VALUES (?,?,?)", token, id, Date.now() + SESSION_DAYS * 864e5);
  res.setHeader("Set-Cookie", sessionCookie(req, token, SESSION_DAYS * 86400));
  return pubUser(one("SELECT * FROM users WHERE id = ?", id));
});

route("POST", "/api/logout", ({ req, res }) => {
  const t = cookies(req)[COOKIE]; if (t) run("DELETE FROM sessions WHERE token = ?", t);
  res.setHeader("Set-Cookie", sessionCookie(req, "", 0)); return { ok: true };
});

route("POST", "/api/me/password", ({ me, body }) => {
  const pw = String(body.password || ""); if (pw.length < 6) fail(400, "6 caractères minimum");
  run("UPDATE users SET pw = ? WHERE id = ?", hashPw(pw), me.id); return { ok: true };
});

// utilisateurs
route("GET", "/api/users", ({ me }) => {
  if (!isStaff(me)) fail(403, "Non autorisé");
  if (isSuper(me)) return all("SELECT * FROM users ORDER BY full_name COLLATE NOCASE").map(pubUser);
  return all(`SELECT * FROM users WHERE role IN ('admin','superadmin') OR mentor_id = ? OR class_id IN (SELECT id FROM classes WHERE mentor_id = ?) OR id = ?
              ORDER BY full_name COLLATE NOCASE`, me.id, me.id, me.id).map(pubUser);
});
route("POST", "/api/users", ({ me, body }) => {
  if (!isSuper(me)) fail(403, "Seul le superadmin peut créer des comptes");
  const username = String(body.username || "").trim().toLowerCase(), password = String(body.password || ""), full_name = String(body.full_name || "").trim().slice(0, 120);
  const role = ["student", "admin", "superadmin"].includes(body.role) ? body.role : "student";
  if (!full_name) fail(400, "Nom complet requis");
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) fail(400, "Identifiant : 3 à 30 caractères (lettres sans accents, chiffres, . _ -)");
  if (password.length < 6) fail(400, "Mot de passe : 6 caractères minimum");
  if (one("SELECT id FROM users WHERE username = ?", username)) fail(409, "Cet identifiant est déjà pris");
  const class_id = body.class_id || null, mentor_id = role === "student" ? (body.mentor_id || null) : null;
  if (class_id && !one("SELECT id FROM classes WHERE id = ?", class_id)) fail(400, "Classe introuvable");
  if (mentor_id && !one("SELECT id FROM users WHERE id = ? AND role IN ('admin','superadmin')", mentor_id)) fail(400, "Mentor introuvable");
  const id = uid();
  run("INSERT INTO users (id, username, pw, full_name, role, class_id, mentor_id, active, created_at) VALUES (?,?,?,?,?,?,?,1,?)", id, username, hashPw(password), full_name, role, class_id, mentor_id, now());
  return pubUser(one("SELECT * FROM users WHERE id = ?", id));
});
route("GET", "/api/users/:id", ({ me, p }) => {
  const u = one("SELECT * FROM users WHERE id = ?", p.id); if (!u) return null;
  if (!(canSee(me, u.id) || (isStaff(me) && u.role !== "student"))) fail(403, "Non autorisé");
  return pubUser(u);
});
route("PATCH", "/api/users/:id", ({ me, p, body }) => {
  const u = one("SELECT * FROM users WHERE id = ?", p.id); if (!u) fail(404, "Utilisateur introuvable");
  const keys = Object.keys(body).filter(k => ["full_name", "role", "class_id", "mentor_id", "active"].includes(k));
  if (!isSuper(me)) {
    const own = u.id === me.id && keys.every(k => k === "full_name");
    const mentorEdit = staffFor(me, u.id) && keys.every(k => k === "full_name");
    if (!own && !mentorEdit) fail(403, "Action réservée au superadmin");
  } else if (u.id === me.id && (("role" in body && body.role !== "superadmin") || ("active" in body && !body.active))) fail(400, "Vous ne pouvez pas retirer vos propres droits de superadmin");
  for (const k of keys) {
    let v = body[k];
    if (k === "full_name") v = String(v || "").trim().slice(0, 120);
    if (k === "role" && !["student", "admin", "superadmin"].includes(v)) fail(400, "Rôle invalide");
    if (k === "active") v = v ? 1 : 0;
    if ((k === "class_id" || k === "mentor_id") && v) { if (!one(`SELECT id FROM ${k === "class_id" ? "classes" : "users"} WHERE id = ?`, v)) fail(400, "Référence invalide"); }
    if ((k === "class_id" || k === "mentor_id") && !v) v = null;
    run(`UPDATE users SET ${k} = ? WHERE id = ?`, v, u.id);
  }
  if ("active" in body && !body.active) run("DELETE FROM sessions WHERE user_id = ?", u.id);
  return pubUser(one("SELECT * FROM users WHERE id = ?", u.id));
});
route("POST", "/api/users/:id/password", ({ me, p, body }) => {
  const u = one("SELECT * FROM users WHERE id = ?", p.id); if (!u) fail(404, "Utilisateur introuvable");
  if (!(isSuper(me) || (staffFor(me, u.id) && u.role === "student"))) fail(403, "Non autorisé");
  const pw = String(body.password || ""); if (pw.length < 6) fail(400, "6 caractères minimum");
  run("UPDATE users SET pw = ? WHERE id = ?", hashPw(pw), u.id); run("DELETE FROM sessions WHERE user_id = ?", u.id); return { ok: true };
});
route("DELETE", "/api/users/:id", ({ me, p }) => {
  if (!isSuper(me)) fail(403, "Non autorisé"); if (p.id === me.id) fail(400, "Impossible de supprimer votre propre compte");
  run("UPDATE users SET mentor_id = NULL WHERE mentor_id = ?", p.id); run("UPDATE classes SET mentor_id = NULL WHERE mentor_id = ?", p.id);
  run("DELETE FROM users WHERE id = ?", p.id); return { ok: true };
});

// classes
route("GET", "/api/classes", ({ me }) => isStaff(me) ? all("SELECT * FROM classes ORDER BY name COLLATE NOCASE") : all("SELECT * FROM classes WHERE id = ?", me.class_id || ""));
route("POST", "/api/classes", ({ me, body }) => {
  if (!isSuper(me)) fail(403, "Non autorisé");
  const name = String(body.name || "").trim().slice(0, 100), code = String(body.code || "").trim().toUpperCase().slice(0, 30), mentor_id = body.mentor_id || null;
  if (!name) fail(400, "Nom requis"); if (!/^[A-Z0-9_-]{3,30}$/.test(code)) fail(400, "Code : 3 à 30 caractères (lettres, chiffres)");
  const dup = one("SELECT id FROM classes WHERE code = ?", code); if (dup && dup.id !== body.id) fail(409, "Ce code est déjà utilisé");
  if (body.id) { if (!one("SELECT id FROM classes WHERE id = ?", body.id)) fail(404, "Classe introuvable"); run("UPDATE classes SET name = ?, code = ?, mentor_id = ? WHERE id = ?", name, code, mentor_id, body.id); return one("SELECT * FROM classes WHERE id = ?", body.id); }
  const id = uid(); run("INSERT INTO classes (id, name, code, mentor_id, created_at) VALUES (?,?,?,?,?)", id, name, code, mentor_id, now()); return one("SELECT * FROM classes WHERE id = ?", id);
});
route("DELETE", "/api/classes/:id", ({ me, p }) => {
  if (!isSuper(me)) fail(403, "Non autorisé");
  run("UPDATE users SET class_id = NULL WHERE class_id = ?", p.id); run("DELETE FROM unlocks WHERE class_id = ?", p.id); run("DELETE FROM classes WHERE id = ?", p.id); return { ok: true };
});

// déblocages
route("GET", "/api/unlocks", ({ me }) => {
  if (isStaff(me)) return all("SELECT * FROM unlocks");
  return all("SELECT * FROM unlocks WHERE student_id = ? OR (class_id IS NOT NULL AND class_id = ?)", me.id, me.class_id || "");
});
route("POST", "/api/unlocks", ({ me, body }) => {
  const lesson = checkLesson(body.lesson), cid = body.class_id || null, sid = body.student_id || null;
  if (!!cid === !!sid) fail(400, "Classe ou élève requis");
  if (cid ? !mentorOfClass(me, cid) : !staffFor(me, sid)) fail(403, "Non autorisé");
  if (cid) run("DELETE FROM unlocks WHERE class_id = ? AND lesson = ?", cid, lesson); else run("DELETE FROM unlocks WHERE student_id = ? AND lesson = ?", sid, lesson);
  if (body.on) run("INSERT INTO unlocks (id, class_id, student_id, lesson, unlocked_by, created_at) VALUES (?,?,?,?,?,?)", uid(), cid, sid, lesson, me.id, now());
  return { ok: true };
});

// réponses
route("GET", "/api/answers/:sid/:lesson", ({ me, p }) => { if (!canSee(me, p.sid)) fail(403, "Non autorisé"); return pubAns(one("SELECT * FROM answers WHERE student_id = ? AND lesson = ?", p.sid, p.lesson)); });
route("PUT", "/api/answers/:sid/:lesson", ({ me, p, body }) => {
  if (p.sid !== me.id) fail(403, "Non autorisé"); checkLesson(p.lesson);
  const data = JSON.stringify(body.data && typeof body.data === "object" ? body.data : {}), t = now();
  const cur = one("SELECT * FROM answers WHERE student_id = ? AND lesson = ?", p.sid, p.lesson);
  if (!cur) run("INSERT INTO answers (student_id, lesson, data, submitted, submitted_at, updated_at) VALUES (?,?,?,?,?,?)", p.sid, p.lesson, data, body.submitted ? 1 : 0, body.submitted ? t : null, t);
  else run("UPDATE answers SET data = ?, updated_at = ?, submitted = ?, submitted_at = ? WHERE student_id = ? AND lesson = ?", data, t, body.submitted ? 1 : cur.submitted, body.submitted ? t : cur.submitted_at, p.sid, p.lesson);
  return pubAns(one("SELECT * FROM answers WHERE student_id = ? AND lesson = ?", p.sid, p.lesson));
});
route("GET", "/api/answers-meta", ({ me, url }) => idsParam(url).filter(id => canSee(me, id)).flatMap(id =>
  all("SELECT student_id, lesson, submitted, submitted_at, updated_at, length(data) AS sz FROM answers WHERE student_id = ?", id).map(a => ({ student_id: a.student_id, lesson: a.lesson, submitted: !!a.submitted, submitted_at: a.submitted_at, updated_at: a.updated_at, filled: a.sz > 2 ? 1 : 0 }))));

// corrections
route("GET", "/api/reviews/:sid/:lesson", ({ me, p }) => { if (!canSee(me, p.sid)) fail(403, "Non autorisé"); return pubRev(one("SELECT * FROM reviews WHERE student_id = ? AND lesson = ?", p.sid, p.lesson)); });
route("PUT", "/api/reviews/:sid/:lesson", ({ me, p, body }) => {
  if (!staffFor(me, p.sid)) fail(403, "Non autorisé"); checkLesson(p.lesson);
  const cur = pubRev(one("SELECT * FROM reviews WHERE student_id = ? AND lesson = ?", p.sid, p.lesson)) || { items: {}, general: "", validated: false };
  const items = JSON.stringify("items" in body ? (body.items || {}) : cur.items), general = String("general" in body ? body.general || "" : cur.general).slice(0, 4000), validated = ("validated" in body ? !!body.validated : cur.validated) ? 1 : 0;
  run(`INSERT INTO reviews (student_id, lesson, items, general, validated, mentor_id, updated_at) VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(student_id, lesson) DO UPDATE SET items = excluded.items, general = excluded.general, validated = excluded.validated, mentor_id = excluded.mentor_id, updated_at = excluded.updated_at`,
    p.sid, p.lesson, items, general, validated, me.id, now());
  return pubRev(one("SELECT * FROM reviews WHERE student_id = ? AND lesson = ?", p.sid, p.lesson));
});
route("GET", "/api/reviews", ({ me, url }) => idsParam(url).filter(id => canSee(me, id)).flatMap(id => all("SELECT * FROM reviews WHERE student_id = ?", id).map(pubRev)));

// tests
route("POST", "/api/quiz", ({ me, body }) => {
  const lesson = checkLesson(body.lesson), score = Math.max(0, Math.floor(+body.score || 0)), total = Math.max(1, Math.floor(+body.total || 1));
  run("INSERT INTO quiz (id, student_id, lesson, score, total, detail, created_at) VALUES (?,?,?,?,?,?,?)", uid(), me.id, lesson, Math.min(score, total), total, JSON.stringify(body.detail || []), now());
  return { ok: true };
});
route("GET", "/api/quiz", ({ me, url }) => idsParam(url).filter(id => canSee(me, id)).flatMap(id => all("SELECT * FROM quiz WHERE student_id = ? ORDER BY created_at", id).map(pubQuiz)));

// messages
route("GET", "/api/messages", ({ me, url }) => idsParam(url).filter(id => canSee(me, id)).flatMap(id => all("SELECT * FROM messages WHERE student_id = ?", id).map(pubMsg)).sort((a, b) => a.created_at.localeCompare(b.created_at)));
route("POST", "/api/messages", ({ me, body }) => {
  const sid = String(body.student_id || ""), lesson = checkLesson(body.lesson), key = String(body.item_key || "").slice(0, 20), text = String(body.body || "").trim();
  if (!canSee(me, sid)) fail(403, "Non autorisé"); if (!text || text.length > 4000) fail(400, "Message vide ou trop long"); if (!key) fail(400, "Question manquante");
  const id = uid(), mine = sid === me.id;
  run("INSERT INTO messages (id, student_id, lesson, item_key, author_id, body, read_by_student, read_by_staff, created_at) VALUES (?,?,?,?,?,?,?,?,?)", id, sid, lesson, key, me.id, text, mine ? 1 : 0, mine ? 0 : 1, now());
  return pubMsg(one("SELECT * FROM messages WHERE id = ?", id));
});
route("POST", "/api/messages/read", ({ me, body }) => {
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 1000) : [], staff = !!body.staff;
  for (const id of ids) { const m = one("SELECT student_id FROM messages WHERE id = ?", id); if (!m) continue;
    if (staff ? staffFor(me, m.student_id) : m.student_id === me.id) run(`UPDATE messages SET ${staff ? "read_by_staff" : "read_by_student"} = 1 WHERE id = ?`, id); }
  return { ok: true };
});

// ---------- fichiers statiques ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".pdf": "application/pdf", ".woff2": "font/woff2" };
function serveStatic(req, res, pathname) {
  if (pathname === "/js/config.js") { res.writeHead(200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-store" }); return res.end('window.APP_CONFIG = { server: true };'); }
  let rel; try { rel = decodeURIComponent(pathname); } catch (e) { rel = "/"; }
  let file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, "index.html");
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": [".html", ".js", ".css", ".webmanifest"].includes(ext) ? "no-cache" : "public, max-age=3600", "X-Content-Type-Options": "nosniff", ...(ext === ".js" && rel === "/sw.js" ? { "Service-Worker-Allowed": "/" } : {}) });
  fs.createReadStream(file).pipe(res);
}

// ---------- serveur ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/")) { if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); } return serveStatic(req, res, url.pathname); }
  try {
    const r = routes.find(x => x.method === req.method && x.re.test(url.pathname));
    if (!r) fail(404, "Introuvable");
    const p = url.pathname.match(r.re).groups || {};
    const body = ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : {};
    const token = cookies(req)[COOKIE];
    let me = null;
    if (token) { const s = one("SELECT * FROM sessions WHERE token = ? AND expires > ?", token, Date.now()); if (s) { me = one("SELECT * FROM users WHERE id = ? AND active = 1", s.user_id); } }
    const open = ["/api/health", "/api/login", "/api/signup", "/api/logout", "/api/me"].includes(url.pathname);
    if (!open && !me) fail(401, "Session expirée. Reconnecte-toi.");
    if (req.method !== "GET" && !open) { const o = req.headers.origin; if (o && req.headers.host && new URL(o).host !== req.headers.host) fail(403, "Origine refusée"); }
    send(res, 200, r.handler({ req, res, me, p, body, url }));
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    send(res, e instanceof HttpError ? e.code : 500, { error: e instanceof HttpError ? e.message : "Erreur interne du serveur" });
  }
});
server.listen(PORT, () => console.log(`École de disciples : http://0.0.0.0:${PORT}  (données : ${DATA_DIR})`));
const stop = () => { server.close(); try { db.close(); } catch (e) { } process.exit(0); };
process.on("SIGTERM", stop); process.on("SIGINT", stop);
