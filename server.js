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
const https = require("node:https");
const vm = require("node:vm");

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
CREATE TABLE IF NOT EXISTS community_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, author_id TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
  image TEXT, reply_to INTEGER, fwd_author TEXT, deleted INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cp_room ON community_posts(room, id);
CREATE INDEX IF NOT EXISTS idx_cp_rev ON community_posts(room, rev);
CREATE TABLE IF NOT EXISTS community_reactions (post_id INTEGER NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (post_id, user_id, emoji));
CREATE TABLE IF NOT EXISTS community_reads (user_id TEXT NOT NULL, room TEXT NOT NULL, last_id INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, room));
`);
db.exec(`
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '#/', read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, id);
CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL);
`);
if (!db.prepare("PRAGMA table_info(community_posts)").all().some(c => c.name === "mentions")) db.exec("ALTER TABLE community_posts ADD COLUMN mentions TEXT");
const UPLOADS = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });

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
    req.on("data", (c) => { size += c.length; if (size > 4 * 1024 * 1024) { reject(new HttpError(413, "Données trop volumineuses")); req.destroy(); } else chunks.push(c); });
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

// ---------- titres des leçons (lus dans public/js/content.js) ----------
const LESSON_TITLES = (() => { try { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(PUBLIC, "js", "content.js"), "utf8"), ctx); return Object.fromEntries((ctx.window.LESSONS || []).map(l => [l.n, l.t])); } catch (e) { return {}; } })();
const lessonName = (n) => "Leçon " + n + (LESSON_TITLES[n] ? " · " + LESSON_TITLES[n] : "");
const firstName = (u) => ((u && (u.full_name || u.username)) || "Quelqu'un").split(" ")[0];
const clip = (t, n = 120) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

// ---------- notifications : dans l'application + sur le téléphone (Web Push, sans dépendance) ----------
const VAPID = (() => {
  const f = path.join(DATA_DIR, "vapid.json");
  try { const v = JSON.parse(fs.readFileSync(f, "utf8")); if (v.jwk && v.pub) return { ...v, key: crypto.createPrivateKey({ key: v.jwk, format: "jwk" }) }; } catch (e) { }
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const j = publicKey.export({ format: "jwk" });
  const pub = Buffer.concat([Buffer.from([4]), Buffer.from(j.x, "base64url"), Buffer.from(j.y, "base64url")]).toString("base64url");
  const jwk = privateKey.export({ format: "jwk" });
  fs.writeFileSync(f, JSON.stringify({ jwk, pub }), { mode: 0o600 });
  return { jwk, pub, key: privateKey };
})();
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@divinearsenal.org";
const hmac = (k, d) => crypto.createHmac("sha256", k).update(d).digest();
function wpEncrypt(payload, p256dh, auth) { // RFC 8291 (aes128gcm)
  const uaPub = Buffer.from(p256dh, "base64url"), authSec = Buffer.from(auth, "base64url");
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys(); const asPub = ecdh.getPublicKey();
  const ikm = hmac(hmac(authSec, ecdh.computeSecret(uaPub)), Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub, Buffer.from([1])])).subarray(0, 32);
  const salt = crypto.randomBytes(16), prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01", "binary")).subarray(0, 12);
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}
function vapidHeader(endpoint) { // RFC 8292
  const aud = new URL(endpoint).origin;
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT });
  const sig = crypto.sign("sha256", Buffer.from(unsigned), { key: VAPID.key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `vapid t=${unsigned}.${sig}, k=${VAPID.pub}`;
}
function pushTo(sub, data) {
  let body; try { body = wpEncrypt(JSON.stringify(data), sub.p256dh, sub.auth); } catch (e) { run("DELETE FROM push_subs WHERE endpoint = ?", sub.endpoint); return; }
  let u; try { u = new URL(sub.endpoint); } catch (e) { return; }
  const req = https.request({ method: "POST", hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, timeout: 15000,
    headers: { "Content-Type": "application/octet-stream", "Content-Encoding": "aes128gcm", "Content-Length": body.length, TTL: "172800", Urgency: "normal", Authorization: vapidHeader(sub.endpoint) } }, (res) => {
    res.resume();
    if (res.statusCode === 404 || res.statusCode === 410) run("DELETE FROM push_subs WHERE endpoint = ?", sub.endpoint);
    else if (res.statusCode >= 400) console.warn("Notification refusée (" + res.statusCode + ") par " + u.hostname);
  });
  req.on("error", () => { }); req.on("timeout", () => req.destroy()); req.end(body);
}
function notify(userIds, n) {
  const ids = [...new Set(userIds.filter(Boolean))]; if (!ids.length) return;
  const t = now();
  for (const id of ids) {
    const u = one("SELECT id, active FROM users WHERE id = ?", id); if (!u || !u.active) continue;
    run("INSERT INTO notifications (user_id, kind, title, body, url, created_at) VALUES (?,?,?,?,?,?)", id, n.kind, n.title, clip(n.body, 200), n.url || "#/", t);
    const unread = one("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0", id).c;
    for (const sub of all("SELECT * FROM push_subs WHERE user_id = ?", id)) pushTo(sub, { title: n.title, body: clip(n.body, 200), url: n.url || "#/", tag: n.tag || n.kind, badge: unread });
  }
  run("DELETE FROM notifications WHERE created_at < ?", new Date(Date.now() - 90 * 864e5).toISOString());
}
// regroupement : une seule notification pour plusieurs événements rapprochés
const quiet = new Map();
const onceIn = (key, ms) => { const t = quiet.get(key); if (t && Date.now() - t < ms) return false; quiet.set(key, Date.now()); if (quiet.size > 5000) quiet.clear(); return true; };
const pendingUnlocks = new Map();
function queueUnlock(sid, lesson) {
  const p = pendingUnlocks.get(sid) || { lessons: new Set(), timer: null };
  p.lessons.add(lesson); clearTimeout(p.timer);
  p.timer = setTimeout(() => { pendingUnlocks.delete(sid);
    const ls = [...p.lessons].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
    if (ls.length === 1) notify([sid], { kind: "unlock", title: "🔓 Nouvelle leçon débloquée", body: lessonName(ls[0]) + " : ton cahier t'attend !", url: "#/lecon/" + ls[0], tag: "unlock" });
    else notify([sid], { kind: "unlock", title: "🔓 " + ls.length + " nouvelles leçons débloquées", body: "Leçons " + ls.join(", ") + " : à toi de jouer !", url: "#/", tag: "unlock" });
  }, 5000);
  pendingUnlocks.set(sid, p);
}
function staffOf(sid) { // mentors à prévenir pour un élève
  const s = one("SELECT mentor_id, class_id FROM users WHERE id = ?", sid); if (!s) return [];
  const c = s.class_id ? one("SELECT mentor_id FROM classes WHERE id = ?", s.class_id) : null;
  const ids = [s.mentor_id, c && c.mentor_id].filter(Boolean);
  return ids.length ? ids : all("SELECT id FROM users WHERE role = 'superadmin' AND active = 1").map(x => x.id);
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
  if (body.on) {
    run("INSERT INTO unlocks (id, class_id, student_id, lesson, unlocked_by, created_at) VALUES (?,?,?,?,?,?)", uid(), cid, sid, lesson, me.id, now());
    const targets = cid ? all("SELECT id FROM users WHERE class_id = ? AND role = 'student' AND active = 1", cid).map(x => x.id) : [sid];
    targets.forEach(t => queueUnlock(t, lesson));
  }
  return { ok: true };
});

// réponses
route("GET", "/api/answers/:sid/:lesson", ({ me, p }) => { if (!canSee(me, p.sid)) fail(403, "Non autorisé"); return pubAns(one("SELECT * FROM answers WHERE student_id = ? AND lesson = ?", p.sid, p.lesson)); });
route("PUT", "/api/answers/:sid/:lesson", ({ me, p, body }) => {
  if (p.sid !== me.id) fail(403, "Non autorisé"); checkLesson(p.lesson);
  const data = JSON.stringify(body.data && typeof body.data === "object" ? body.data : {}), t = now();
  const cur = one("SELECT * FROM answers WHERE student_id = ? AND lesson = ?", p.sid, p.lesson);
  if (body.submitted) notify(staffOf(me.id), { kind: "submit", title: "📩 Cahier envoyé par " + (me.full_name || me.username), body: lessonName(p.lesson) + (cur && cur.submitted ? " (mise à jour)" : "") + " : à corriger", url: "#/revue/" + me.id + "/" + p.lesson + "/cahier", tag: "submit-" + me.id + "-" + p.lesson });
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
  const url = "#/lecon/" + p.lesson + "/cahier";
  if (validated && !cur.validated) notify([p.sid], { kind: "validated", title: "⭐ Leçon validée !", body: firstName(me) + " a validé ta " + lessonName(p.lesson).replace(/^Leçon/, "leçon") + ". Bravo !", url, tag: "rev-" + p.lesson });
  else if (general && general !== cur.general) notify([p.sid], { kind: "review", title: "📝 Mot de ton mentor", body: lessonName(p.lesson) + " : " + general, url, tag: "rev-" + p.lesson });
  else if ("items" in body && items !== JSON.stringify(cur.items) && onceIn("rev|" + p.sid + "|" + p.lesson, 30 * 60e3)) notify([p.sid], { kind: "review", title: "✅ Ton cahier a été corrigé", body: firstName(me) + " corrige ton cahier · " + lessonName(p.lesson), url, tag: "rev-" + p.lesson });
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
  if (mine) notify(staffOf(sid).filter(x => x !== me.id), { kind: "question", title: "💬 Question de " + (me.full_name || me.username), body: "Leçon " + lesson + " : " + text, url: "#/revue/" + sid + "/" + lesson + "/cahier", tag: "q-" + sid + "-" + lesson });
  else notify([sid], { kind: "answer", title: "💬 Réponse de " + firstName(me) + " (mentor)", body: "Leçon " + lesson + " : " + text, url: "#/lecon/" + lesson + "/questions", tag: "q-" + lesson });
  return pubMsg(one("SELECT * FROM messages WHERE id = ?", id));
});
route("POST", "/api/messages/read", ({ me, body }) => {
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 1000) : [], staff = !!body.staff;
  for (const id of ids) { const m = one("SELECT student_id FROM messages WHERE id = ?", id); if (!m) continue;
    if (staff ? staffFor(me, m.student_id) : m.student_id === me.id) run(`UPDATE messages SET ${staff ? "read_by_staff" : "read_by_student"} = 1 WHERE id = ?`, id); }
  return { ok: true };
});

// ---------- communauté : un salon « Général » + un salon par leçon ----------
const ROOM_RE = /^(general|[1-3]-\d{1,2}|dm:[0-9a-f-]{36}:[0-9a-f-]{36})$/;
const dmPeer = (me, room) => { const [, a, b] = room.split(":"); return a === me.id ? b : b === me.id ? a : null; };
const dmRoom = (a, b) => "dm:" + [a, b].sort().join(":");
const EMOJIS = ["👍", "❤️", "🙏", "🔥", "😂", "👏"];
function canRoom(me, room) {
  if (!ROOM_RE.test(String(room || ""))) return false;
  if (room.startsWith("dm:")) { const peer = dmPeer(me, room); return !!(peer && peer !== me.id && room === dmRoom(me.id, peer) && one("SELECT 1 FROM users WHERE id = ?", peer)); }
  if (room === "general" || isStaff(me)) return true;
  return !!one("SELECT 1 FROM unlocks WHERE lesson = ? AND (student_id = ? OR (class_id IS NOT NULL AND class_id = ?))", room, me.id, me.class_id || "");
}
const needRoom = (me, room) => { if (!canRoom(me, room)) fail(403, "Ce salon s'ouvrira quand la leçon sera débloquée."); return room; };
const nextRev = () => one("SELECT COALESCE(MAX(rev), 0) + 1 AS r FROM community_posts").r;
const POST_SQL = `SELECT p.*, u.full_name AS a_name, u.username AS a_user, u.role AS a_role FROM community_posts p LEFT JOIN users u ON u.id = p.author_id`;
function pubPosts(rows, me) {
  if (!rows.length) return [];
  const ids = rows.map(r => r.id), marks = ids.map(() => "?").join(",");
  const reacts = all(`SELECT post_id, emoji, COUNT(*) AS n, SUM(user_id = ?) AS mine FROM community_reactions WHERE post_id IN (${marks}) GROUP BY post_id, emoji`, me.id, ...ids);
  const repIds = [...new Set(rows.map(r => r.reply_to).filter(Boolean))];
  const reps = repIds.length ? all(`${POST_SQL} WHERE p.id IN (${repIds.map(() => "?").join(",")})`, ...repIds) : [];
  return rows.map(r => {
    const rp = r.reply_to ? reps.find(x => x.id === r.reply_to) : null;
    return { id: r.id, room: r.room, author: { id: r.author_id, name: r.a_name || r.a_user || "Ancien membre", role: r.a_role || "student" },
      body: r.deleted ? "" : r.body, image: r.deleted ? null : r.image, deleted: !!r.deleted, mentions: r.deleted || !r.mentions ? [] : JSON.parse(r.mentions), fwd: r.deleted ? null : r.fwd_author, created_at: r.created_at, rev: r.rev,
      reply: rp ? { id: rp.id, room: rp.room, name: rp.a_name || rp.a_user || "Ancien membre", body: rp.deleted ? "Message supprimé" : rp.body.slice(0, 140), image: !rp.deleted && !!rp.image } : null,
      reactions: reacts.filter(x => x.post_id === r.id).map(x => ({ emoji: x.emoji, n: x.n, mine: !!x.mine })).sort((a, b) => EMOJIS.indexOf(a.emoji) - EMOJIS.indexOf(b.emoji)) };
  });
}
route("GET", "/api/community/rooms", ({ me }) => {
  const stats = all(`SELECT room, COUNT(*) AS n, MAX(id) AS last_id FROM community_posts WHERE deleted = 0 GROUP BY room`);
  const unread = all(`SELECT p.room, COUNT(*) AS n FROM community_posts p LEFT JOIN community_reads r ON r.room = p.room AND r.user_id = ?
    WHERE p.deleted = 0 AND p.author_id != ? AND p.id > COALESCE(r.last_id, 0) GROUP BY p.room`, me.id, me.id);
  const rooms = stats.filter(x => canRoom(me, x.room)).map(x => {
    const l = one(`${POST_SQL} WHERE p.id = ?`, x.last_id), un = unread.find(u => u.room === x.room);
    const peerId = x.room.startsWith("dm:") ? dmPeer(me, x.room) : null, peer = peerId ? one("SELECT id, full_name, username, role FROM users WHERE id = ?", peerId) : null;
    return { room: x.room, peer: peer && { id: peer.id, name: peer.full_name || peer.username, role: peer.role }, count: x.n, unread: un ? un.n : 0, last: l && { name: l.a_name || l.a_user, mine: l.author_id === me.id, body: l.body.slice(0, 90), image: !!l.image, created_at: l.created_at } };
  });
  return { rooms, unread: rooms.reduce((a, r) => a + r.unread, 0) };
});
route("GET", "/api/community/rooms/:room/posts", ({ me, p, url }) => {
  needRoom(me, p.room);
  const since = url.searchParams.get("since"), before = url.searchParams.get("before");
  const rev = one("SELECT COALESCE(MAX(rev), 0) AS r FROM community_posts WHERE room = ?", p.room).r;
  if (since != null) return { posts: pubPosts(all(`${POST_SQL} WHERE p.room = ? AND p.rev > ? ORDER BY p.id`, p.room, +since || 0), me), rev };
  const rows = before ? all(`${POST_SQL} WHERE p.room = ? AND p.id < ? ORDER BY p.id DESC LIMIT 51`, p.room, +before || 0) : all(`${POST_SQL} WHERE p.room = ? ORDER BY p.id DESC LIMIT 51`, p.room);
  return { posts: pubPosts(rows.slice(0, 50).reverse(), me), more: rows.length > 50, rev };
});
route("POST", "/api/community/rooms/:room/posts", ({ me, p, body }) => {
  needRoom(me, p.room);
  let text = String(body.body || "").trim().slice(0, 4000), image = body.image ? String(body.image) : null, fwd = null, reply = null;
  if (image && !/^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(image)) fail(400, "Image invalide");
  if (body.forward_of) {
    const o = one(`${POST_SQL} WHERE p.id = ?`, +body.forward_of);
    if (!o || o.deleted || !canRoom(me, o.room)) fail(404, "Message introuvable");
    text = o.body; image = o.image; fwd = o.fwd_author || o.a_name || o.a_user || "Membre";
  }
  if (body.reply_to) { const r = one("SELECT id, room FROM community_posts WHERE id = ?", +body.reply_to); if (r && (r.room === p.room || canRoom(me, r.room))) reply = r.id; }
  const mentions = [...new Set((Array.isArray(body.mentions) ? body.mentions : []).map(String))].slice(0, 20)
    .map(id => one("SELECT id, full_name, username FROM users WHERE id = ? AND active = 1", id)).filter(Boolean).filter(u => u.id !== me.id).map(u => ({ id: u.id, name: u.full_name || u.username }));
  if (!text && !image) fail(400, "Message vide");
  const t = now();
  const info = run("INSERT INTO community_posts (room, author_id, body, image, reply_to, fwd_author, mentions, rev, created_at) VALUES (?,?,?,?,?,?,?,?,?)", p.room, me.id, text, image, reply, fwd, mentions.length ? JSON.stringify(mentions) : null, nextRev(), t);
  const id = Number(info.lastInsertRowid);
  { // notifications : réponse directe + activité du salon pour ceux qui y ont déjà écrit
    const where = p.room === "general" ? "Général" : p.room.startsWith("dm:") ? "Message privé" : "Leçon " + p.room, url = "#/communaute/" + p.room, who = me.full_name || me.username;
    const preview = image && !text ? "📷 Photo" : (image ? "📷 " : "") + text;
    let replied = null;
    if (p.room.startsWith("dm:")) { replied = dmPeer(me, p.room); notify([replied], { kind: "dm", title: "✉️ " + who, body: preview, url, tag: "dm-" + me.id }); }
    const tagged = mentions.map(m => m.id).filter(id => id !== replied && canRoom(one("SELECT * FROM users WHERE id = ?", id) || {}, p.room));
    if (tagged.length && !p.room.startsWith("dm:")) notify(tagged, { kind: "mention", title: "📣 " + who + " t'a mentionné", body: where + " : " + preview, url, tag: "room-" + p.room });
    if (reply && !p.room.startsWith("dm:")) { const r = one("SELECT author_id FROM community_posts WHERE id = ?", reply); if (r && r.author_id !== me.id && !tagged.includes(r.author_id)) { replied = r.author_id; notify([replied], { kind: "reply", title: "↩️ " + who + " t'a répondu", body: where + " : " + preview, url, tag: "room-" + p.room }); } }
    const followers = p.room.startsWith("dm:") ? [] : all("SELECT DISTINCT author_id FROM community_posts WHERE room = ? AND deleted = 0 AND author_id != ?", p.room, me.id).map(x => x.author_id).filter(x => x !== replied && !tagged.includes(x) && canRoom(one("SELECT * FROM users WHERE id = ?", x) || {}, p.room));
    const toSend = followers.filter(f => onceIn("room|" + f + "|" + p.room, 10 * 60e3));
    if (toSend.length) notify(toSend, { kind: "community", title: "💬 Nouveau message · " + where, body: firstName(me) + " : " + preview, url, tag: "room-" + p.room });
  }
  run(`INSERT INTO community_reads (user_id, room, last_id) VALUES (?,?,?) ON CONFLICT(user_id, room) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)`, me.id, p.room, id);
  return pubPosts([one(`${POST_SQL} WHERE p.id = ?`, id)], me)[0];
});
route("GET", "/api/community/members", ({ me }) => all(`SELECT u.id, u.full_name, u.username, u.role, c.name AS class_name FROM users u LEFT JOIN classes c ON c.id = u.class_id
  WHERE u.active = 1 AND u.id != ? ORDER BY u.full_name COLLATE NOCASE`, me.id).map(u => ({ id: u.id, name: u.full_name || u.username, username: u.username, role: u.role, class_name: u.class_name || null })));
route("GET", "/api/community/posts/:id/reactions", ({ me, p }) => {
  const post = one("SELECT room FROM community_posts WHERE id = ?", +p.id); if (!post) fail(404, "Message introuvable"); needRoom(me, post.room);
  const rows = all("SELECT r.emoji, u.id, u.full_name, u.username FROM community_reactions r JOIN users u ON u.id = r.user_id WHERE r.post_id = ?", +p.id);
  return EMOJIS.map(e => ({ emoji: e, users: rows.filter(x => x.emoji === e).map(x => ({ id: x.id, name: x.id === me.id ? "Moi" : x.full_name || x.username })) })).filter(x => x.users.length);
});
route("POST", "/api/community/posts/:id/react", ({ me, p, body }) => {
  const post = one("SELECT * FROM community_posts WHERE id = ?", +p.id); if (!post || post.deleted) fail(404, "Message introuvable"); needRoom(me, post.room);
  const e = String(body.emoji || ""); if (!EMOJIS.includes(e)) fail(400, "Réaction inconnue");
  const has = one("SELECT 1 FROM community_reactions WHERE post_id = ? AND user_id = ? AND emoji = ?", post.id, me.id, e);
  if (has) run("DELETE FROM community_reactions WHERE post_id = ? AND user_id = ? AND emoji = ?", post.id, me.id, e);
  else {
    run("INSERT INTO community_reactions (post_id, user_id, emoji) VALUES (?,?,?)", post.id, me.id, e);
    if (post.author_id !== me.id && onceIn("react|" + post.id + "|" + me.id, 60 * 60e3)) notify([post.author_id], { kind: "reaction", title: e + " " + (me.full_name || me.username) + " a réagi à ton message", body: (post.room === "general" ? "Général" : post.room.startsWith("dm:") ? "Message privé" : "Leçon " + post.room) + " : " + (post.body || "📷 Photo"), url: "#/communaute/" + post.room, tag: "react-" + post.room });
  }
  run("UPDATE community_posts SET rev = ? WHERE id = ?", nextRev(), post.id);
  return pubPosts([one(`${POST_SQL} WHERE p.id = ?`, post.id)], me)[0];
});
route("DELETE", "/api/community/posts/:id", ({ me, p }) => {
  const post = one("SELECT * FROM community_posts WHERE id = ?", +p.id); if (!post) fail(404, "Message introuvable");
  if (post.author_id !== me.id && !isStaff(me)) fail(403, "Tu ne peux supprimer que tes propres messages");
  run("UPDATE community_posts SET deleted = 1, rev = ? WHERE id = ?", nextRev(), post.id);
  run("DELETE FROM community_reactions WHERE post_id = ?", post.id);
  return { ok: true };
});
route("POST", "/api/community/rooms/:room/read", ({ me, p, body }) => {
  needRoom(me, p.room);
  run(`INSERT INTO community_reads (user_id, room, last_id) VALUES (?,?,?) ON CONFLICT(user_id, room) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)`, me.id, p.room, Math.floor(+body.last_id || 0));
  return { ok: true };
});
route("POST", "/api/community/upload", ({ body }) => {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ""));
  if (!m) fail(400, "Image invalide (JPEG, PNG ou WebP)");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 3 * 1024 * 1024) fail(413, "Image trop lourde (3 Mo maximum)");
  const sig = buf.subarray(0, 12).toString("hex");
  const ok = (m[1] === "jpeg" && sig.startsWith("ffd8ff")) || (m[1] === "png" && sig.startsWith("89504e47")) || (m[1] === "webp" && sig.startsWith("52494646") && sig.slice(16, 24) === "57454250");
  if (!ok) fail(400, "Fichier image invalide");
  const name = crypto.randomBytes(16).toString("hex") + "." + (m[1] === "jpeg" ? "jpg" : m[1]);
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return { url: "/uploads/" + name };
});
function serveUpload(req, res, pathname) {
  const token = cookies(req)[COOKIE];
  const s = token && one("SELECT user_id FROM sessions WHERE token = ? AND expires > ?", token, Date.now());
  const name = pathname.slice("/uploads/".length);
  if (!s) { res.writeHead(401); return res.end(); }
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(name) || !fs.existsSync(path.join(UPLOADS, name))) { res.writeHead(404); return res.end(); }
  const ext = name.split(".").pop();
  res.writeHead(200, { "Content-Type": ext === "jpg" ? "image/jpeg" : "image/" + ext, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
  fs.createReadStream(path.join(UPLOADS, name)).pipe(res);
}

// notifications
route("GET", "/api/notifications", ({ me }) => ({
  items: all("SELECT id, kind, title, body, url, read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 60", me.id).map(n => ({ ...n, read: !!n.read })),
  unread: one("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0", me.id).c }));
route("POST", "/api/notifications/read", ({ me, body }) => {
  if (body.all) run("UPDATE notifications SET read = 1 WHERE user_id = ?", me.id);
  else for (const id of (Array.isArray(body.ids) ? body.ids : []).slice(0, 200)) run("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?", +id, me.id);
  return { unread: one("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0", me.id).c };
});
route("GET", "/api/push/key", () => ({ key: VAPID.pub }));
route("POST", "/api/push/subscribe", ({ me, body }) => {
  const ep = String(body.endpoint || ""), k = body.keys || {};
  if (!/^https:\/\//.test(ep) || ep.length > 1000 || !k.p256dh || !k.auth) fail(400, "Abonnement invalide");
  run(`INSERT INTO push_subs (endpoint, user_id, p256dh, auth, created_at) VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`, ep, me.id, String(k.p256dh), String(k.auth), now());
  return { ok: true };
});
route("POST", "/api/push/unsubscribe", ({ me, body }) => { run("DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?", String(body.endpoint || ""), me.id); return { ok: true }; });
route("POST", "/api/push/test", ({ me }) => { notify([me.id], { kind: "test", title: "🔔 Notifications activées", body: "Tu seras prévenu ici des nouvelles leçons, des messages et des réponses.", url: "#/notifications", tag: "test" }); return { ok: true }; });

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
  if (!url.pathname.startsWith("/api/")) { if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); } return url.pathname.startsWith("/uploads/") ? serveUpload(req, res, url.pathname) : serveStatic(req, res, url.pathname); }
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
