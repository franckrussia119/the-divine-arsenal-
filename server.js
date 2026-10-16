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
const DB_FILE = path.join(DATA_DIR, "ecole.db");
const BACKUPS = path.join(DATA_DIR, "backups");
fs.mkdirSync(BACKUPS, { recursive: true });
// restauration demandée depuis l'application : le fichier préparé remplace la base au démarrage
function applyPendingRestore() {
  const r = path.join(DATA_DIR, "restore.db"); if (!fs.existsSync(r)) return;
  try {
    if (fs.readFileSync(r).subarray(0, 16).toString("latin1") !== "SQLite format 3\u0000") throw new Error("fichier invalide");
    if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, path.join(BACKUPS, "avant-restauration-" + new Date().toISOString().replace(/[:.]/g, "-") + ".db"));
    for (const x of ["-wal", "-shm"]) { try { fs.unlinkSync(DB_FILE + x); } catch (e) { } }
    fs.renameSync(r, DB_FILE); console.log("Sauvegarde restaurée.");
  } catch (e) { console.error("Restauration impossible :", e.message); try { fs.unlinkSync(r); } catch (x) { } }
}
let db;
function openDb() {
  applyPendingRestore();
  db = new DatabaseSync(DB_FILE);
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
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS activity (user_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user_id, day));
  CREATE TABLE IF NOT EXISTS certificates (code TEXT PRIMARY KEY, student_id TEXT NOT NULL, phase INTEGER NOT NULL, issued_at TEXT NOT NULL, UNIQUE (student_id, phase));
  CREATE TABLE IF NOT EXISTS reminder_log (student_id TEXT NOT NULL, lesson TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, last_at TEXT NOT NULL, PRIMARY KEY (student_id, lesson));
  CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'cours', class_id TEXT, starts_at TEXT NOT NULL, duration INTEGER NOT NULL DEFAULT 60,
    recur TEXT NOT NULL DEFAULT 'none', until TEXT, link TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', remind TEXT NOT NULL DEFAULT '[1440,15]', created_by TEXT, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS event_log (key TEXT PRIMARY KEY, sent_at TEXT NOT NULL);
  `);
  if (!db.prepare("PRAGMA table_info(users)").all().some(c => c.name === "phone")) db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
  if (!db.prepare("PRAGMA table_info(community_posts)").all().some(c => c.name === "mentions")) db.exec("ALTER TABLE community_posts ADD COLUMN mentions TEXT");
}
openDb();
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
function bootstrap() {
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
}
bootstrap();

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
const pubUser = (u) => u && ({ id: u.id, username: u.username, full_name: u.full_name, phone: u.phone || "", role: u.role, class_id: u.class_id, mentor_id: u.mentor_id, active: !!u.active, created_at: u.created_at });
const pubAns = (a) => a && ({ student_id: a.student_id, lesson: a.lesson, data: JSON.parse(a.data || "{}"), submitted: !!a.submitted, submitted_at: a.submitted_at, updated_at: a.updated_at });
const pubRev = (r) => r && ({ student_id: r.student_id, lesson: r.lesson, items: JSON.parse(r.items || "{}"), general: r.general, validated: !!r.validated, mentor_id: r.mentor_id, updated_at: r.updated_at });
const pubQuiz = (x) => ({ id: x.id, student_id: x.student_id, lesson: x.lesson, score: x.score, total: x.total, detail: JSON.parse(x.detail || "[]"), created_at: x.created_at });
const pubMsg = (m) => ({ ...m, read_by_student: !!m.read_by_student, read_by_staff: !!m.read_by_staff });

// ---------- droits ----------
const isSuper = (me) => me && me.role === "superadmin";
const isStaff = (me) => me && (me.role === "admin" || me.role === "superadmin");
function mentorOfClass(me, cid) { if (!cid) return false; if (isSuper(me)) return true; const c = one("SELECT mentor_id FROM classes WHERE id = ?", cid); return !!(isStaff(me) && c && (c.mentor_id === me.id || me.class_id === cid)); }
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
const CONTENT = (() => { try { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(PUBLIC, "js", "content.js"), "utf8"), ctx); return ctx.window; } catch (e) { return {}; } })();
const LESSONS = CONTENT.LESSONS || [], PHASES = CONTENT.PHASES || [];
const LESSON_TITLES = Object.fromEntries(LESSONS.map(l => [l.n, l.t]));
const LESSON_BY = Object.fromEntries(LESSONS.map(l => [l.n, l]));
// part du cahier déjà remplie (0 à 100)
function completion(n, data) {
  const l = LESSON_BY[n]; if (!l) return 0; data = data || {};
  const f = (v) => typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.some(r => Array.isArray(r) ? r.some(c => String(c || "").trim()) : String(r || "").trim()) : v != null && v !== "" && v !== false;
  const checks = ["V", ...l.wb.q.map((_, i) => "A" + (i + 1)), ...l.wb.vf.map((_, i) => "B" + (i + 1)), ...l.wb.ex.map(e => e.k), "EJ", "Z1", "Z2"].map(k => f(data[k]));
  checks.push(Object.values(data.D || {}).some(Boolean), [1, 2, 3, 4, 5, 6, 7].some(i => f(data["E" + i])));
  return Math.round(100 * checks.filter(Boolean).length / checks.length);
}
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
const stripEmoji = (t) => String(t || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2190}-\u{21FF}\u{23E9}-\u{23FA}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}/g, " ").trim();
function notify(userIds, n) {
  n = { ...n, title: stripEmoji(n.title) };
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

// ---------- réglages ----------
const TIMEZONE = process.env.TIMEZONE || "Africa/Lagos";
const DEFAULTS = { rem_on: "1", rem_delay: "2", rem_every: "2", rem_hour: "18", rem_max: "6", meet_link: "" };
const getSet = (k) => { const r = one("SELECT value FROM settings WHERE key = ?", k); return r ? r.value : DEFAULTS[k]; };
const allSettings = () => Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, getSet(k)]));
const localParts = (d) => Object.fromEntries(new Intl.DateTimeFormat("fr-FR", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "long" }).formatToParts(d).map(p => [p.type, p.value]));
const fmtLocal = (d) => { const p = localParts(d); return p.hour + ":" + p.minute; };
const fmtDayLocal = (d) => { const p = localParts(d); return p.weekday + " " + (+p.day) + "/" + p.month + " à " + p.hour + ":" + p.minute; };

// ---------- rappels « remplis ton cahier » ----------
function pendingFor(stu) {
  const unl = all("SELECT lesson, MIN(created_at) AS at FROM unlocks WHERE student_id = ? OR (class_id IS NOT NULL AND class_id = ?) GROUP BY lesson", stu.id, stu.class_id || "");
  return unl.map(u => { const a = one("SELECT data, submitted FROM answers WHERE student_id = ? AND lesson = ?", stu.id, u.lesson);
    return { lesson: u.lesson, title: LESSON_TITLES[u.lesson] || "", unlocked_at: u.at, submitted: !!(a && a.submitted), pct: a ? completion(u.lesson, JSON.parse(a.data || "{}")) : 0 }; })
    .filter(x => !x.submitted && LESSON_BY[x.lesson]).sort((a, b) => a.lesson.localeCompare(b.lesson, "fr", { numeric: true }));
}
function runWorkbookReminders(force) {
  if (getSet("rem_on") !== "1" && !force) return 0;
  const delay = +getSet("rem_delay") * 864e5, every = Math.max(1, +getSet("rem_every")) * 864e5 - 3600e3, max = +getSet("rem_max"), nowT = Date.now();
  let sent = 0;
  for (const stu of all("SELECT * FROM users WHERE role = 'student' AND active = 1")) {
    const due = pendingFor(stu).filter(x => nowT - Date.parse(x.unlocked_at) >= delay).filter(x => {
      const log = one("SELECT * FROM reminder_log WHERE student_id = ? AND lesson = ?", stu.id, x.lesson);
      return !log || (log.count < max && nowT - Date.parse(log.last_at) >= every); });
    if (!due.length) continue;
    const first = (stu.full_name || stu.username).split(" ")[0];
    if (due.length === 1) { const x = due[0]; notify([stu.id], { kind: "reminder", title: "📝 " + first + ", ton cahier t'attend", body: lessonName(x.lesson) + (x.pct ? " : rempli à " + x.pct + " %. Termine-le et envoie-le à ton mentor !" : " : pas encore commencé. Prends 15 minutes aujourd'hui !"), url: "#/lecon/" + x.lesson + "/cahier", tag: "reminder" }); }
    else notify([stu.id], { kind: "reminder", title: "📝 " + due.length + " cahiers à terminer", body: due.map(x => x.lesson + " (" + x.pct + " %)").join(" · ") + " : courage, une question à la fois !", url: "#/", tag: "reminder" });
    for (const x of due) run(`INSERT INTO reminder_log (student_id, lesson, count, last_at) VALUES (?,?,1,?) ON CONFLICT(student_id, lesson) DO UPDATE SET count = count + 1, last_at = excluded.last_at`, stu.id, x.lesson, now());
    sent++;
  }
  return sent;
}

// ---------- agenda : cours en ligne, prière, étude biblique… ----------
const KINDS = { cours: "Cours en ligne", priere: "Prière", bible: "Étude biblique", culte: "Culte", autre: "Rendez-vous" };
const STEP = { daily: 864e5, weekly: 7 * 864e5, none: 0 };
function occurrences(ev, from, to) {
  const start = Date.parse(ev.starts_at), dur = (ev.duration || 60) * 60e3, step = STEP[ev.recur] || 0, until = ev.until ? Date.parse(ev.until) + 864e5 : Infinity, out = [];
  if (!step) { if (start + dur >= from && start <= to) out.push(start); return out; }
  let k = Math.max(0, Math.ceil((from - dur - start) / step));
  for (let t = start + k * step; t <= to && t <= until && out.length < 400; t += step) out.push(t);
  return out;
}
const eventTargets = (ev) => ev.class_id
  ? [...all("SELECT id FROM users WHERE class_id = ? AND role = 'student' AND active = 1", ev.class_id).map(x => x.id), (one("SELECT mentor_id FROM classes WHERE id = ?", ev.class_id) || {}).mentor_id]
  : all("SELECT id FROM users WHERE active = 1").map(x => x.id);
function runEventReminders() {
  const nowT = Date.now();
  for (const ev of all("SELECT * FROM events")) {
    let rem = []; try { rem = JSON.parse(ev.remind || "[]"); } catch (e) { }
    for (const off of rem) {
      for (const t of occurrences(ev, nowT + off * 60e3 - 3 * 60e3, nowT + off * 60e3)) {
        if (t - off * 60e3 > nowT || t - off * 60e3 < nowT - 3 * 60e3) continue;
        const key = ev.id + "|" + new Date(t).toISOString() + "|" + off;
        if (one("SELECT 1 FROM event_log WHERE key = ?", key)) continue;
        run("INSERT INTO event_log (key, sent_at) VALUES (?,?)", key, now());
        const d = new Date(t), label = KINDS[ev.kind] || KINDS.autre;
        const when = off >= 1440 ? "Demain à " + fmtLocal(d) : off >= 60 ? "Dans " + Math.round(off / 60) + " h (" + fmtLocal(d) + ")" : off > 0 ? "Dans " + off + " min (" + fmtLocal(d) + ")" : "C'est maintenant !";
        notify(eventTargets(ev), { kind: "event", title: (off === 0 ? "🔴 " : "⏰ ") + ev.title, body: label + " · " + when + (ev.link ? " · Touchez pour rejoindre." : ""), url: "#/agenda", tag: "event-" + ev.id });
      }
    }
  }
  run("DELETE FROM event_log WHERE sent_at < ?", new Date(nowT - 30 * 864e5).toISOString());
}
let lastRemDay = "";
setInterval(() => {
  try { runEventReminders(); } catch (e) { console.error("Rappels agenda :", e.message); }
  try { const p = localParts(new Date()), day = p.year + p.month + p.day; if (+p.hour === +getSet("rem_hour") && day !== lastRemDay) { lastRemDay = day; const n = runWorkbookReminders(false); if (n) console.log("Rappels cahier envoyés :", n); } } catch (e) { console.error("Rappels cahier :", e.message); }
}, 60e3);

// ---------- certificat PDF (générateur sans dépendance) ----------
const PDF_W = JSON.parse('{"H":[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,750,556,278,222,556,333,1000,556,556,333,1000,667,333,1000,278,611,278,278,222,222,333,333,350,556,1000,333,1000,500,333,944,278,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,0,737,552,400,549,333,333,333,576,537,333,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,549,611,556,556,556,556,500,556,500],"HB":[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,750,556,278,278,556,500,1000,556,556,333,1000,667,333,1000,278,611,278,278,278,278,500,500,350,556,1000,333,1000,556,333,944,278,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,0,737,552,400,549,333,333,333,576,556,333,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,549,611,611,611,611,611,556,611,556],"TBI":[250,389,555,500,500,833,778,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,832,667,667,667,722,667,667,722,778,389,500,667,611,889,722,722,611,722,667,556,611,722,667,889,667,611,611,333,278,333,570,500,333,500,500,444,500,444,333,500,556,278,278,500,278,778,556,500,500,500,389,389,278,556,444,667,500,444,389,348,220,348,570,778,500,250,333,500,500,1000,500,500,333,1000,556,333,944,250,611,250,250,333,333,500,500,350,500,1000,333,1000,389,333,722,250,389,611,250,389,500,500,500,500,220,500,333,747,266,500,606,0,747,500,400,549,300,300,333,576,500,250,333,300,300,500,750,750,750,500,667,667,667,667,667,667,944,667,667,667,667,667,389,389,389,389,722,722,722,722,722,722,722,570,722,722,722,722,722,611,611,500,500,500,500,500,500,500,722,444,444,444,444,444,278,278,278,278,500,556,500,500,500,500,500,549,500,556,556,556,556,444,500,444],"TI":[250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541,778,500,250,333,500,556,889,500,500,333,1000,500,333,944,250,556,250,250,333,333,556,556,350,500,889,333,980,389,333,667,250,389,556,250,389,500,500,500,500,275,500,333,760,276,500,675,0,760,500,400,549,300,300,333,576,523,250,333,300,310,500,750,750,750,500,611,611,611,611,611,611,889,667,611,611,611,611,333,333,333,333,722,667,722,722,722,722,722,675,722,722,722,722,722,556,611,500,500,500,500,500,500,500,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,549,500,500,500,500,500,444,500,444]}');
function winAnsi(str) {
  const special = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "œ": 0x9c, "Œ": 0x8c, "Ÿ": 0x9f, " ": 0x20, " ": 0x20 };
  const out = [];
  for (const ch of String(str)) { const c = ch.codePointAt(0); out.push(special[ch] != null ? special[ch] : c < 256 ? c : 0x3f); }
  return Buffer.from(out);
}
const pdfStr = (s) => "(" + winAnsi(s).toString("latin1").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") + ")";
const textW = (s, font, size, spacing = 0) => { const b = winAnsi(s); let w = 0; for (const c of b) w += (PDF_W[font][c - 32] || 500); return w * size / 1000 + spacing * b.length; };
function certificatePdf({ name, phaseLabel, phaseTitle, lessons, mentor, date, code, verifyUrl, logo }) {
  const W = 842, H = 595, FONTS = { H: "Helvetica", HB: "Helvetica-Bold", TBI: "Times-BoldItalic", TI: "Times-Italic" };
  const C = { pur: "0.180 0.102 0.278", pur2: "0.357 0.227 0.549", gold: "0.788 0.635 0.153", goldd: "0.541 0.427 0.071", mut: "0.42 0.37 0.50", cream: "0.984 0.965 0.906" };
  let s = "";
  const txt = (t, x, y, font, size, color, opt = {}) => {
    const sp = opt.spacing || 0, w = textW(t, font, size, sp);
    const xx = opt.align === "center" ? x - w / 2 : opt.align === "right" ? x - w : x;
    s += `BT /${font} ${size} Tf ${sp ? sp + " Tc " : ""}${C[color] || color} rg ${xx.toFixed(2)} ${y.toFixed(2)} Td ${pdfStr(t)} Tj ${sp ? "0 Tc " : ""}ET\n`;
    return w;
  };
  const fit = (t, font, size, max) => { while (size > 10 && textW(t, font, size) > max) size -= 1; return size; };
  const rect = (x, y, w, h, color, stroke, lw) => { s += stroke ? `${C[color]} RG ${lw || 1} w ${x} ${y} ${w} ${h} re S\n` : `${C[color]} rg ${x} ${y} ${w} ${h} re f\n`; };
  const line = (x1, y1, x2, y2, color, lw) => { s += `${C[color]} RG ${lw} w ${x1} ${y1} m ${x2} ${y2} l S\n`; };
  const circle = (cx, cy, r, color, fill, lw) => { const k = 0.5523 * r;
    s += `${C[color]} ${fill ? "rg" : "RG"} ${fill ? "" : (lw || 1) + " w "}${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c ${fill ? "f" : "S"}\n`; };
  // fond et cadres
  rect(0, 0, W, H, "cream");
  rect(16, 16, W - 32, H - 32, "pur", true, 7);
  rect(30, 30, W - 60, H - 60, "gold", true, 1.6);
  rect(36, 36, W - 72, H - 72, "gold", true, 0.5);
  for (const [x, y] of [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]]) { circle(x, y, 7, "gold", true); circle(x, y, 3, "pur", true); }
  // logo
  const lw = 132, lh = Math.round(lw * logo.h / logo.w);
  s += `q ${lw} 0 0 ${lh} ${(W - lw) / 2} ${H - 52 - lh} cm /Logo Do Q\n`;
  let y = H - 52 - lh - 22;
  txt("THE DIVINE ARSENAL CORPORATION · ÉCOLE DE DISCIPLES", W / 2, y, "HB", 9, "goldd", { align: "center", spacing: 2.2 });
  y -= 46; txt("Certificat de fin de phase", W / 2, y, "TBI", 38, "pur", { align: "center" });
  y -= 30; txt("décerné à", W / 2, y, "H", 12.5, "mut", { align: "center" });
  y -= 44; const ns = fit(name, "TBI", 36, 560); txt(name, W / 2, y, "TBI", ns, "pur2", { align: "center" });
  y -= 14; line(W / 2 - 200, y, W / 2 + 200, y, "gold", 1.2);
  y -= 28; txt("pour avoir achevé avec fidélité la", W / 2, y, "H", 13, "mut", { align: "center" });
  y -= 26; const pt = phaseLabel + " · " + phaseTitle; txt(pt, W / 2, y, "HB", fit(pt, "HB", 19, 600), "pur", { align: "center" });
  y -= 22; txt(lessons + " leçons étudiées, cahiers complétés et validés par son mentor", W / 2, y, "H", 11.5, "mut", { align: "center" });
  y -= 30; txt("« Croissez dans la grâce et dans la connaissance de notre seigneur et sauveur Jésus Christ. »", W / 2, y, "TI", 12.5, "pur2", { align: "center" });
  y -= 16; txt("2 Pierre 3.18", W / 2, y, "HB", 9.5, "goldd", { align: "center", spacing: 1 });
  // signatures, sceau
  const by = 92;
  line(110, by, 300, by, "pur", 0.8); txt(mentor || "Le mentor", 205, by - 15, "HB", 11, "pur", { align: "center" }); txt("Mentor", 205, by - 28, "H", 9.5, "mut", { align: "center" });
  line(W - 300, by, W - 110, by, "pur", 0.8); txt("Le responsable de l'école", W - 205, by - 15, "HB", 11, "pur", { align: "center" }); txt("The Divine Arsenal Corporation", W - 205, by - 28, "H", 9.5, "mut", { align: "center" });
  circle(W / 2, by + 6, 38, "gold", true); circle(W / 2, by + 6, 33, "cream", false, 1.2); circle(W / 2, by + 6, 29, "pur", true);
  txt(phaseLabel.toUpperCase(), W / 2, by + 9, "HB", 10, "1 1 1", { align: "center", spacing: 1 }); txt("ACHEVÉE", W / 2, by - 4, "HB", 7.5, "gold", { align: "center", spacing: 1.2 });
  txt("Délivré le " + date + "  ·  Code de vérification : " + code, W / 2, 50, "H", 8.5, "mut", { align: "center" });
  txt(verifyUrl, W / 2, 40, "H", 7.5, "goldd", { align: "center" });
  // assemblage
  const content = Buffer.from(s, "latin1");
  const objs = [];
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << ${Object.keys(FONTS).map((k, i) => `/${k} ${5 + i} 0 R`).join(" ")} >> /XObject << /Logo 9 0 R >> >> /Contents 4 0 R >>`);
  objs.push([`<< /Length ${content.length} >>\nstream\n`, content, "\nendstream"]);
  for (const k of Object.keys(FONTS)) objs.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS[k]} /Encoding /WinAnsiEncoding >>`);
  objs.push([`<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.data.length} >>\nstream\n`, logo.data, "\nendstream"]);
  objs.push(`<< /Title ${pdfStr("Certificat · " + name + " · " + phaseLabel)} /Author ${pdfStr("The Divine Arsenal Corporation")} /Producer (Ecole de disciples) >>`);
  const parts = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")], offs = [];
  let len = parts[0].length;
  objs.forEach((o, i) => { offs.push(len); const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), ...(Array.isArray(o) ? o.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x, "latin1")) : [Buffer.from(o, "latin1")]), Buffer.from("\nendobj\n")]); parts.push(chunk); len += chunk.length; });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${objs.length} 0 R >>\nstartxref\n${len}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
}
function jpegSize(buf) { let i = 2; while (i < buf.length) { if (buf[i] !== 0xff) { i++; continue; } const m = buf[i + 1], l = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }; i += 2 + l; } return { w: 1, h: 1 }; }

const CERT_LOGO = (() => { try { const data = fs.readFileSync(path.join(PUBLIC, "img", "cert-logo.jpg")); return { ...jpegSize(data), data }; } catch (e) { return null; } })();
const cleanPhone = (p) => { const d = String(p || "").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, ""); return d.length >= 8 ? d.slice(0, 20) : null; };
const phaseOf = (n) => +String(n).split("-")[0];
function certStatus(sid) {
  const val = new Set(all("SELECT lesson FROM reviews WHERE student_id = ? AND validated = 1", sid).map(r => r.lesson));
  return PHASES.map(ph => { const ls = LESSONS.filter(l => l.ph === ph.n), done = ls.filter(l => val.has(l.n)).length, c = one("SELECT * FROM certificates WHERE student_id = ? AND phase = ?", sid, ph.n);
    return { phase: ph.n, title: ph.t, total: ls.length, validated: done, eligible: ls.length > 0 && done === ls.length, code: c ? c.code : null, issued_at: c ? c.issued_at : null }; });
}
function issueCert(sid, phase) {
  const c = one("SELECT * FROM certificates WHERE student_id = ? AND phase = ?", sid, phase); if (c) return c;
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let code;
  do { code = Array.from(crypto.randomBytes(8), b => A[b % A.length]).join("").replace(/^(.{4})/, "$1-"); } while (one("SELECT 1 FROM certificates WHERE code = ?", code));
  run("INSERT INTO certificates (code, student_id, phase, issued_at) VALUES (?,?,?,?)", code, sid, phase, now());
  return one("SELECT * FROM certificates WHERE code = ?", code);
}
function sendCertificate(req, res, url) {
  const me = currentUser(req); if (!me) return send(res, 401, { error: "Session expirée" });
  const sid = url.searchParams.get("sid") || me.id, phase = +url.searchParams.get("phase");
  if (!canSee(me, sid)) return send(res, 403, { error: "Non autorisé" });
  const st = certStatus(sid).find(x => x.phase === phase); if (!st) return send(res, 404, { error: "Phase inconnue" });
  if (!st.eligible) return send(res, 400, { error: "Toutes les leçons de la phase doivent être validées par le mentor (" + st.validated + "/" + st.total + ")" });
  const stu = one("SELECT * FROM users WHERE id = ?", sid), c = issueCert(sid, phase), m = stu.mentor_id ? one("SELECT full_name FROM users WHERE id = ?", stu.mentor_id) : null;
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim(), proto = isSecure(req) ? "https" : (req.headers["x-forwarded-proto"] || "http").split(",")[0];
  const pdf = certificatePdf({ name: stu.full_name || stu.username, phaseLabel: "Phase " + phase, phaseTitle: st.title, lessons: st.total, mentor: m && m.full_name, code: c.code,
    date: new Date(c.issued_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TIMEZONE }), verifyUrl: proto + "://" + host + "/#/verifier/" + c.code, logo: CERT_LOGO || { w: 1, h: 1, data: Buffer.alloc(0) } });
  const fname = "Certificat-Phase-" + phase + "-" + (stu.full_name || stu.username).normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") + ".pdf";
  res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": pdf.length, "Content-Disposition": `${url.searchParams.get("dl") ? "attachment" : "inline"}; filename="${fname}"`, "Cache-Control": "no-store" });
  res.end(pdf);
}

// ---------- activité (statistiques) ----------
const seen = new Set();
function trackActivity(id) { const day = new Date().toISOString().slice(0, 10), k = id + "|" + day; if (seen.has(k)) return; if (seen.size > 20000) seen.clear(); seen.add(k); run("INSERT OR IGNORE INTO activity (user_id, day) VALUES (?,?)", id, day); }
function monthRange(m) { const [y, mo] = m.split("-").map(Number); return [new Date(Date.UTC(y, mo - 1, 1)).toISOString(), new Date(Date.UTC(y, mo, 1)).toISOString()]; }
function statsFor(ids, month) {
  const [a, b] = monthRange(month), set = new Set(ids), inM = (d) => d && d >= a && d < b;
  const ph = ids.map(() => "?").join(",") || "''";
  const act = ids.length ? all(`SELECT user_id, COUNT(*) AS days FROM activity WHERE user_id IN (${ph}) AND day >= ? AND day < ? GROUP BY user_id`, ...ids, a.slice(0, 10), b.slice(0, 10)) : [];
  const sent = ids.length ? all(`SELECT student_id, lesson FROM answers WHERE student_id IN (${ph}) AND submitted = 1 AND submitted_at >= ? AND submitted_at < ?`, ...ids, a, b) : [];
  const val = ids.length ? all(`SELECT student_id FROM reviews WHERE student_id IN (${ph}) AND validated = 1 AND updated_at >= ? AND updated_at < ?`, ...ids, a, b) : [];
  const qz = ids.length ? all(`SELECT student_id, score, total FROM quiz WHERE student_id IN (${ph}) AND created_at >= ? AND created_at < ?`, ...ids, a, b) : [];
  const msgs = ids.length ? one(`SELECT COUNT(*) AS c FROM messages WHERE author_id IN (${ph}) AND created_at >= ? AND created_at < ?`, ...ids, a, b).c : 0;
  const posts = ids.length ? one(`SELECT COUNT(*) AS c FROM community_posts WHERE author_id IN (${ph}) AND deleted = 0 AND created_at >= ? AND created_at < ?`, ...ids, a, b).c : 0;
  const avg = qz.length ? Math.round(100 * qz.reduce((s, q) => s + q.score / q.total, 0) / qz.length) : null;
  return { active: act.length, active_days: act, sent: sent.length, senders: new Set(sent.map(x => x.student_id)).size, validated: val.length, tests: qz.length, test_avg: avg,
    test_pass: qz.length ? Math.round(100 * qz.filter(q => q.score / q.total >= 0.7).length / qz.length) : null, questions: msgs, posts, qz, sentRows: sent, valRows: val };
}
// ---------- stockage persistant et sauvegardes ----------
const PERSISTENT = (() => {
  if ((process.env.DATA_PERSISTENT || "").toLowerCase() === "true") return true;
  try { const dir = fs.realpathSync(DATA_DIR); return fs.readFileSync("/proc/self/mountinfo", "utf8").split("\n").some(l => { const f = l.split(" "); return f[4] === dir || (f[4] && f[4] !== "/" && dir.startsWith(f[4] + "/")); }); }
  catch (e) { return true; } // impossible de vérifier (ordinateur local) : pas d'alerte
})();
if (!PERSISTENT) console.warn("\n⚠️  ATTENTION : " + DATA_DIR + " n'est pas un stockage persistant.\n   Les comptes et les cahiers seront EFFACÉS au prochain déploiement.\n   Dans Coolify : Persistent Storage → Add → Volume Mount → Destination Path : " + DATA_DIR + "\n");
function makeBackup(file) { const f = file || path.join(BACKUPS, "ecole-" + new Date().toISOString().slice(0, 10) + ".db"); try { fs.unlinkSync(f); } catch (e) { } db.exec("VACUUM INTO '" + f.replace(/'/g, "''") + "'"); return f; }
function dailyBackup() {
  try {
    const today = path.join(BACKUPS, "ecole-" + new Date().toISOString().slice(0, 10) + ".db");
    if (!fs.existsSync(today)) makeBackup(today);
    fs.readdirSync(BACKUPS).filter(f => /^ecole-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().reverse().slice(14).forEach(f => fs.unlinkSync(path.join(BACKUPS, f)));
  } catch (e) { console.error("Sauvegarde automatique impossible :", e.message); }
}
setTimeout(dailyBackup, 60e3); setInterval(dailyBackup, 3 * 3600e3);
const lastBackup = () => { try { const f = fs.readdirSync(BACKUPS).filter(x => x.endsWith(".db")).map(x => ({ x, t: fs.statSync(path.join(BACKUPS, x)).mtimeMs })).sort((a, b) => b.t - a.t)[0]; return f ? new Date(f.t).toISOString() : null; } catch (e) { return null; } };

// ---------- routes API ----------
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), handler });

route("GET", "/api/health", () => ({ ok: true }));
route("GET", "/api/stats", ({ me, url }) => {
  if (!isStaff(me)) fail(403, "Non autorisé");
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") || "") ? url.searchParams.get("month") : new Date().toISOString().slice(0, 7);
  const classId = url.searchParams.get("class_id") || "";
  const students = all("SELECT * FROM users WHERE role = 'student'").filter(u => staffFor(me, u.id) && (!classId || u.class_id === classId));
  const ids = students.map(u => u.id), [a, b] = monthRange(month);
  const cur = statsFor(ids, month);
  const months = []; { const [y, m] = month.split("-").map(Number); for (let i = 5; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); months.push(d.toISOString().slice(0, 7)); } }
  const trend = months.map(mo => { const s = statsFor(ids, mo); return { month: mo, active: s.active, sent: s.sent, test_avg: s.test_avg, validated: s.validated }; });
  const classes = all("SELECT * FROM classes").filter(c => isSuper(me) || c.mentor_id === me.id);
  const byClass = classes.map(c => { const cid = students.filter(u => u.class_id === c.id).map(u => u.id); const s = statsFor(cid, month); return { id: c.id, name: c.name, students: cid.length, active: s.active, sent: s.sent, validated: s.validated, test_avg: s.test_avg }; }).filter(x => !classId || x.id === classId);
  const per = students.map(u => { const d = cur.active_days.find(x => x.user_id === u.id), q = cur.qz.filter(x => x.student_id === u.id);
    return { id: u.id, name: u.full_name || u.username, class_name: (classes.find(c => c.id === u.class_id) || {}).name || "", active_days: d ? d.days : 0, sent: cur.sentRows.filter(x => x.student_id === u.id).length,
      validated: cur.valRows.filter(x => x.student_id === u.id).length, tests: q.length, test_avg: q.length ? Math.round(100 * q.reduce((s, x) => s + x.score / x.total, 0) / q.length) : null }; });
  return { month, students: students.filter(u => u.active).length, new_students: students.filter(u => u.created_at >= a && u.created_at < b).length,
    active: cur.active, sent: cur.sent, senders: cur.senders, validated: cur.validated, tests: cur.tests, test_avg: cur.test_avg, test_pass: cur.test_pass, questions: cur.questions, posts: cur.posts,
    certificates: ids.length ? one(`SELECT COUNT(*) AS c FROM certificates WHERE student_id IN (${ids.map(() => "?").join(",")}) AND issued_at >= ? AND issued_at < ?`, ...ids, a, b).c : 0,
    trend, classes: byClass, per };
});

// ---------- certificats et WhatsApp ----------
route("GET", "/api/certificates/:sid", ({ me, p }) => { if (!canSee(me, p.sid)) fail(403, "Non autorisé"); return certStatus(p.sid); });
route("GET", "/api/verify/:code", ({ p }) => {
  const c = one("SELECT c.*, u.full_name, u.username FROM certificates c LEFT JOIN users u ON u.id = c.student_id WHERE c.code = ?", String(p.code).toUpperCase());
  if (!c) fail(404, "Aucun certificat ne correspond à ce code");
  return { name: c.full_name || c.username, phase: c.phase, title: (PHASES.find(x => x.n === c.phase) || {}).t || "", issued_at: c.issued_at, code: c.code };
});
route("GET", "/api/whatsapp", ({ me, url }) => {
  if (!isStaff(me)) fail(403, "Non autorisé");
  const classId = url.searchParams.get("class_id") || "";
  const students = all("SELECT * FROM users WHERE role = 'student' AND active = 1").filter(u => staffFor(me, u.id) && (!classId || u.class_id === classId));
  const nowT = Date.now(), week = new Date(nowT - 7 * 864e5).toISOString();
  const recent = classId ? all("SELECT lesson, created_at FROM unlocks WHERE class_id = ? AND created_at >= ? ORDER BY created_at", classId, week).map(u => ({ lesson: u.lesson, title: LESSON_TITLES[u.lesson] || "" })) : [];
  const evs = all("SELECT * FROM events").filter(e => !e.class_id || !classId || e.class_id === classId).flatMap(e => occurrences(e, nowT, nowT + 8 * 864e5).map(t => ({ title: e.title, kind: e.kind, at: new Date(t).toISOString(), when: fmtDayLocal(new Date(t)), link: e.link }))).sort((x, y) => x.at.localeCompare(y.at)).slice(0, 6);
  return { recent, events: evs, students: students.map(u => ({ id: u.id, name: u.full_name || u.username, phone: u.phone || "", class_id: u.class_id,
    push: !!one("SELECT 1 FROM push_subs WHERE user_id = ?", u.id), last_seen: (one("SELECT MAX(day) AS d FROM activity WHERE user_id = ?", u.id) || {}).d || null, pending: pendingFor(u) })) };
});


route("GET", "/api/settings", ({ me }) => { if (!isStaff(me)) fail(403, "Non autorisé"); return { ...allSettings(), timezone: TIMEZONE }; });
route("PUT", "/api/settings", ({ me, body }) => {
  if (!isSuper(me)) fail(403, "Non autorisé");
  const clean = { rem_on: body.rem_on ? "1" : "0", rem_delay: String(Math.min(30, Math.max(0, +body.rem_delay || 0))), rem_every: String(Math.min(30, Math.max(1, +body.rem_every || 1))),
    rem_hour: String(Math.min(23, Math.max(0, Math.floor(+body.rem_hour || 0)))), rem_max: String(Math.min(30, Math.max(1, +body.rem_max || 1))), meet_link: String(body.meet_link || "").trim().slice(0, 300) };
  for (const [k, v] of Object.entries(clean)) run("INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", k, v);
  return { ...allSettings(), timezone: TIMEZONE };
});
route("POST", "/api/reminders/run", ({ me }) => { if (!isSuper(me)) fail(403, "Non autorisé"); return { sent: runWorkbookReminders(true) }; });
route("GET", "/api/reminders/me", ({ me }) => me.role === "student" ? pendingFor(me) : []);
route("POST", "/api/reminders/nudge", ({ me, body }) => {
  const sid = String(body.student_id || ""); if (!staffFor(me, sid)) fail(403, "Non autorisé");
  const stu = one("SELECT * FROM users WHERE id = ?", sid), pend = stu ? pendingFor(stu) : []; if (!pend.length) fail(400, "Rien à rappeler : tout est envoyé");
  notify([sid], { kind: "reminder", title: "📝 Un petit mot de " + firstName(me), body: "N'oublie pas ton cahier : " + pend.map(x => x.lesson + " (" + x.pct + " %)").join(" · ") + ". Je compte sur toi !", url: pend.length === 1 ? "#/lecon/" + pend[0].lesson + "/cahier" : "#/", tag: "reminder" });
  return { ok: true };
});
route("GET", "/api/reminders/class", ({ me }) => { // mentors : qui n'a pas encore envoyé son cahier
  if (!isStaff(me)) fail(403, "Non autorisé");
  return all("SELECT * FROM users WHERE role = 'student' AND active = 1").filter(u => staffFor(me, u.id)).map(u => ({ id: u.id, name: u.full_name || u.username, pending: pendingFor(u) })).filter(x => x.pending.length);
});
// agenda
const canEditEvent = (me, classId) => isSuper(me) || (isStaff(me) && classId && mentorOfClass(me, classId));
const pubEvent = (e) => ({ ...e, remind: JSON.parse(e.remind || "[]"), class_name: e.class_id ? ((one("SELECT name FROM classes WHERE id = ?", e.class_id) || {}).name || "Classe supprimée") : null });
route("GET", "/api/events", ({ me, url }) => {
  const from = Date.parse(url.searchParams.get("from") || "") || Date.now() - 3 * 3600e3, to = Math.min(Date.parse(url.searchParams.get("to") || "") || from + 31 * 864e5, from + 400 * 864e5);
  const evs = all("SELECT * FROM events").filter(e => isSuper(me) || !e.class_id || e.class_id === me.class_id || (isStaff(me) && mentorOfClass(me, e.class_id)));
  const occ = [];
  for (const e of evs) for (const t of occurrences(e, from, to)) occ.push({ ...pubEvent(e), at: new Date(t).toISOString(), ends: new Date(t + e.duration * 60e3).toISOString(), can_edit: canEditEvent(me, e.class_id) });
  return occ.sort((a, b) => a.at.localeCompare(b.at));
});
function eventFromBody(me, body, cur) {
  const classId = body.class_id || null;
  if (!canEditEvent(me, classId)) fail(403, classId ? "Vous ne pouvez programmer que pour vos classes" : "Seul le superadmin programme pour toute l'école");
  const title = String(body.title || "").trim().slice(0, 120); if (!title) fail(400, "Titre requis");
  const start = Date.parse(body.starts_at || ""); if (!start) fail(400, "Date et heure requises");
  const recur = ["none", "daily", "weekly"].includes(body.recur) ? body.recur : "none";
  const remind = (Array.isArray(body.remind) ? body.remind : [1440, 15]).map(Number).filter(x => [0, 15, 60, 1440].includes(x));
  return { title, kind: KINDS[body.kind] ? body.kind : "autre", class_id: classId, starts_at: new Date(start).toISOString(), duration: Math.min(600, Math.max(5, +body.duration || 60)), recur,
    until: recur !== "none" && body.until ? String(body.until).slice(0, 10) : null, link: String(body.link || "").trim().slice(0, 300), description: String(body.description || "").trim().slice(0, 1000), remind: JSON.stringify([...new Set(remind)]) };
}
route("POST", "/api/events", ({ me, body }) => {
  const e = eventFromBody(me, body), id = uid();
  run("INSERT INTO events (id, title, kind, class_id, starts_at, duration, recur, until, link, description, remind, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", id, e.title, e.kind, e.class_id, e.starts_at, e.duration, e.recur, e.until, e.link, e.description, e.remind, me.id, now());
  const ev = one("SELECT * FROM events WHERE id = ?", id);
  notify(eventTargets(ev).filter(x => x !== me.id), { kind: "event", title: "📅 Nouveau : " + e.title, body: (KINDS[e.kind] || "") + " · " + fmtDayLocal(new Date(e.starts_at)) + (e.recur === "weekly" ? " (chaque semaine)" : e.recur === "daily" ? " (chaque jour)" : ""), url: "#/agenda", tag: "event-" + id });
  return pubEvent(ev);
});
route("PUT", "/api/events/:id", ({ me, p, body }) => {
  const cur = one("SELECT * FROM events WHERE id = ?", p.id); if (!cur) fail(404, "Rendez-vous introuvable"); if (!canEditEvent(me, cur.class_id)) fail(403, "Non autorisé");
  const e = eventFromBody(me, body);
  run("UPDATE events SET title = ?, kind = ?, class_id = ?, starts_at = ?, duration = ?, recur = ?, until = ?, link = ?, description = ?, remind = ? WHERE id = ?", e.title, e.kind, e.class_id, e.starts_at, e.duration, e.recur, e.until, e.link, e.description, e.remind, p.id);
  return pubEvent(one("SELECT * FROM events WHERE id = ?", p.id));
});
route("DELETE", "/api/events/:id", ({ me, p }) => {
  const cur = one("SELECT * FROM events WHERE id = ?", p.id); if (!cur) fail(404, "Rendez-vous introuvable"); if (!canEditEvent(me, cur.class_id)) fail(403, "Non autorisé");
  run("DELETE FROM events WHERE id = ?", p.id); return { ok: true };
});
route("GET", "/api/admin/status", ({ me }) => {
  if (!isSuper(me)) fail(403, "Non autorisé");
  let size = 0; try { size = fs.statSync(DB_FILE).size; } catch (e) { }
  return { persistent: PERSISTENT, data_dir: DATA_DIR, db_size: size, users: one("SELECT COUNT(*) AS c FROM users").c, last_backup: lastBackup(),
    backups: fs.readdirSync(BACKUPS).filter(x => /^ecole-.*\.db$/.test(x)).sort().reverse() };
});

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
  run("INSERT INTO users (id, username, pw, full_name, role, class_id, mentor_id, active, created_at, phone) VALUES (?,?,?,?,?,?,?,1,?,?)", id, username, hashPw(password), full_name, role, class_id, mentor_id, now(), cleanPhone(body.phone));
  if (role === "admin" && class_id) run("UPDATE classes SET mentor_id = ? WHERE id = ? AND (mentor_id IS NULL OR mentor_id = '')", id, class_id);
  return pubUser(one("SELECT * FROM users WHERE id = ?", id));
});
route("GET", "/api/users/:id", ({ me, p }) => {
  const u = one("SELECT * FROM users WHERE id = ?", p.id); if (!u) return null;
  if (!(canSee(me, u.id) || (isStaff(me) && u.role !== "student"))) fail(403, "Non autorisé");
  return pubUser(u);
});
route("PATCH", "/api/users/:id", ({ me, p, body }) => {
  const u = one("SELECT * FROM users WHERE id = ?", p.id); if (!u) fail(404, "Utilisateur introuvable");
  const keys = Object.keys(body).filter(k => ["full_name", "phone", "role", "class_id", "mentor_id", "active"].includes(k));
  if (!isSuper(me)) {
    const own = u.id === me.id && keys.every(k => k === "full_name" || k === "phone");
    const mentorEdit = staffFor(me, u.id) && keys.every(k => k === "full_name" || k === "phone");
    if (!own && !mentorEdit) fail(403, "Action réservée au superadmin");
  } else if (u.id === me.id && (("role" in body && body.role !== "superadmin") || ("active" in body && !body.active))) fail(400, "Vous ne pouvez pas retirer vos propres droits de superadmin");
  for (const k of keys) {
    let v = body[k];
    if (k === "full_name") v = String(v || "").trim().slice(0, 120);
    if (k === "role" && !["student", "admin", "superadmin"].includes(v)) fail(400, "Rôle invalide");
    if (k === "active") v = v ? 1 : 0;
    if (k === "phone") v = cleanPhone(v);
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
  if (validated && !cur.validated) { const st = certStatus(p.sid).find(x => x.phase === phaseOf(p.lesson)); if (st && st.eligible) { issueCert(p.sid, st.phase); notify([p.sid], { kind: "certificate", title: "🎓 Ton certificat de la Phase " + st.phase + " est prêt !", body: "Félicitations ! Tu as achevé « " + st.title + " ». Télécharge ton certificat.", url: "#/", tag: "cert-" + st.phase }); notify(staffOf(p.sid).filter(x => x !== me.id), { kind: "certificate", title: "🎓 Phase " + st.phase + " achevée", body: (one("SELECT full_name FROM users WHERE id = ?", p.sid) || {}).full_name + " a validé toute la phase « " + st.title + " ».", url: "#/eleve/" + p.sid }); } }
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
    const preview = image && !text ? "Photo" : (image ? "Photo · " : "") + text;
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
    if (post.author_id !== me.id && onceIn("react|" + post.id + "|" + me.id, 60 * 60e3)) notify([post.author_id], { kind: "reaction", title: e + " " + (me.full_name || me.username) + " a réagi à ton message", body: (post.room === "general" ? "Général" : post.room.startsWith("dm:") ? "Message privé" : "Leçon " + post.room) + " : " + (post.body || "Photo"), url: "#/communaute/" + post.room, tag: "react-" + post.room });
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

// sauvegarde (téléchargement) et restauration (envoi d'un fichier .db) : superadmin uniquement
function currentUser(req) { const token = cookies(req)[COOKIE]; if (!token) return null; const s = one("SELECT * FROM sessions WHERE token = ? AND expires > ?", token, Date.now()); return s ? one("SELECT * FROM users WHERE id = ? AND active = 1", s.user_id) : null; }
function rawAdmin(req, res, url) {
  const me = currentUser(req);
  if (!isSuper(me)) return send(res, 403, { error: "Réservé au superadmin" });
  if (url.pathname === "/api/admin/backup" && req.method === "GET") {
    const tmp = path.join(BACKUPS, "telechargement-" + Date.now() + ".db");
    try { makeBackup(tmp); } catch (e) { return send(res, 500, { error: "Sauvegarde impossible : " + e.message }); }
    res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": fs.statSync(tmp).size, "Content-Disposition": `attachment; filename="ecole-de-disciples-${new Date().toISOString().slice(0, 10)}.db"`, "Cache-Control": "no-store" });
    const st = fs.createReadStream(tmp); st.pipe(res); st.on("close", () => fs.unlink(tmp, () => { }));
    return;
  }
  if (url.pathname === "/api/admin/restore" && req.method === "POST") {
    const o = req.headers.origin; if (o && req.headers.host && new URL(o).host !== req.headers.host) return send(res, 403, { error: "Origine refusée" });
    const tmp = path.join(DATA_DIR, "restore-upload.tmp"), out = fs.createWriteStream(tmp); let size = 0, aborted = false;
    req.on("data", (c) => { size += c.length; if (size > 500 * 1024 * 1024 && !aborted) { aborted = true; out.destroy(); req.destroy(); fs.unlink(tmp, () => { }); } });
    req.pipe(out);
    out.on("finish", () => {
      if (aborted) return;
      try {
        if (fs.readFileSync(tmp).subarray(0, 16).toString("latin1") !== "SQLite format 3\u0000") throw new Error("Ce fichier n'est pas une sauvegarde de l'école (.db)");
        const test = new DatabaseSync(tmp); const ok = test.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get(); const n = ok ? test.prepare("SELECT COUNT(*) AS c FROM users").get().c : 0; test.close();
        if (!ok) throw new Error("Sauvegarde invalide : aucune table des comptes");
        try { makeBackup(path.join(BACKUPS, "avant-restauration-" + new Date().toISOString().replace(/[:.]/g, "-") + ".db")); } catch (e) { }
        fs.renameSync(tmp, path.join(DATA_DIR, "restore.db"));
        db.close(); openDb(); bootstrap();
        send(res, 200, { ok: true, users: n });
      } catch (e) { fs.unlink(tmp, () => { }); try { db.prepare("SELECT 1").get(); } catch (x) { openDb(); } send(res, 400, { error: e.message }); }
    });
    return;
  }
  send(res, 404, { error: "Introuvable" });
}

// ---------- serveur ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/")) { if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); } return url.pathname.startsWith("/uploads/") ? serveUpload(req, res, url.pathname) : serveStatic(req, res, url.pathname); }
  if (url.pathname === "/api/admin/backup" || url.pathname === "/api/admin/restore") return rawAdmin(req, res, url);
  if (url.pathname === "/api/certificate.pdf") return sendCertificate(req, res, url);
  try {
    const r = routes.find(x => x.method === req.method && x.re.test(url.pathname));
    if (!r) fail(404, "Introuvable");
    const p = url.pathname.match(r.re).groups || {};
    const body = ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : {};
    const token = cookies(req)[COOKIE];
    let me = null;
    if (token) { const s = one("SELECT * FROM sessions WHERE token = ? AND expires > ?", token, Date.now()); if (s) { me = one("SELECT * FROM users WHERE id = ? AND active = 1", s.user_id); } }
    const open = ["/api/health", "/api/login", "/api/signup", "/api/logout", "/api/me"].includes(url.pathname) || url.pathname.startsWith("/api/verify/");
    if (!open && !me) fail(401, "Session expirée. Reconnecte-toi.");
    if (me) trackActivity(me.id);
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
