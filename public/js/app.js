// =====================================================================
//  THE DIVINE ARSENAL CORPORATION · École de disciples — application
// =====================================================================
(function () {
  const API = window.API, LESSONS = window.LESSONS, PHASES = window.PHASES;
  const L = Object.fromEntries(LESSONS.map(l => [l.n, l]));
  const app = document.getElementById("app");
  const S = { me: null };
  const PASS = 0.7;

  // ---------- utilitaires DOM ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "style") el.setAttribute("style", v);
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k in el && typeof v !== "string") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else if (c.nodeType) el.append(c); else iconize(el, String(c)); };
    kids.forEach(add);
    return el;
  }
  const fill = (el, ...k) => el.replaceChildren(...k.flat(Infinity).filter(x => x != null && x !== false));
  const add = (el, ...k) => el.append(...k.flat(Infinity).filter(x => x != null && x !== false));
  const IC = {
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
    chat: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/></svg>',
    lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/></svg>',
    user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    out: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    dl: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  };
  IC.book = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM20 19v3H6"/></svg>';
  IC.back = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  IC.send = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2z"/></svg>';
  IC.chev = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';
  IC.people = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M17 9a6 6 0 0 1-8.7 5.4L4 16l1.3-3.6A6 6 0 1 1 17 9z"/><path d="M20.5 20 19.3 16.9A5.5 5.5 0 0 0 17 8.8M9.5 15.6A5.5 5.5 0 0 0 17.7 19l2.8 1"/></svg>';
  IC.bell = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>';
  IC.cal = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  IC.cam = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>';
  const ic = (n) => h("span", { html: IC[n] || "", class: "ico" });
  // Icônes vectorielles (style iOS / WhatsApp) à la place des émojis dans l'interface.
  // Le texte écrit par les membres (messages, réactions…) passe par U() et n'est jamais transformé.
  const sv = (d, extra) => '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (extra || "") + '>' + d + '</svg>';
  const V = {
    check: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>'), x: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
    lock: sv('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>'), unlock: sv('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 7.6-1.7"/>'),
    cap: sv('<path d="M2 9.5 12 5l10 4.5-10 4.5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9.5v5"/>'),
    bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'), belloff: sv('<path d="M8.7 3.6A6 6 0 0 1 18 8c0 3 .5 5 1.2 6.5M17 17H3s3-2 3-9c0-.6.1-1.2.3-1.8M10.3 21a1.9 1.9 0 0 0 3.4 0M3 3l18 18"/>'),
    book: sv('<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM20 19v3H6"/>'), camera: sv('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>'),
    calendar: sv('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>'), pencil: sv('<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="M14.5 5.5l3 3"/>'),
    star: sv('<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"/>'), video: sv('<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5 21.5 7v10l-6-3.5"/>'),
    sparkle: sv('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'), pin: sv('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
    chat: sv('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>'), people: sv('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>'),
    mail: sv('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5 12 13l8.5-6.5"/>'), target: sv('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>'),
    trophy: sv('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8.5 20h7M10 17h4v3h-4z"/>'),
    heart: sv('<path d="M12 20.5S3.5 15.4 3.5 9.3A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8.5 2.6c0 6.1-8.5 11.2-8.5 11.2z"/>'), eye: sv('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    bulb: sv('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>'), cross: sv('<path d="M12 3v18M7 8h10"/>'),
    flame: sv('<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 3-5.6 3.8-9.3 2.7 1.6 4.2 4 4.2 6.3 1-.6 1.8-1.7 2-3 1.9 1.6 3 3.7 3 6 0 3.6-2.6 6.2-6.5 6.2z"/>'),
    church: sv('<path d="M12 2v5M10 4h4M5 21V12l7-5 7 5v9M3 21h18M10 21v-4a2 2 0 0 1 4 0v4"/>'), phone: sv('<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
    copy: sv('<rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8"/>'), globe: sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'),
    reply: sv('<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 6 6v1"/>'), forward: sv('<path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 0 0-6 6v1"/>'),
    crown: sv('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>'), key: sv('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>'),
    clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'), megaphone: sv('<path d="M3 10v4a1 1 0 0 0 1 1h3l8 5V4L7 9H4a1 1 0 0 0-1 1zM19 9a4 4 0 0 1 0 6"/>'),
    inbox: sv('<path d="M3 13h5l1.5 3h5L16 13h5M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>'), scroll: sv('<path d="M8 3h11v15a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1h11v1a3 3 0 0 0 3 3M8 3a3 3 0 0 0-3 3v11M11 8h5M11 12h5"/>'),
    ban: sv('<circle cx="12" cy="12" r="9"/><path d="M5.7 5.7l12.6 12.6"/>'), image: sv('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
    trash: sv('<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'), chart: sv('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    warning: sv('<path d="M12 3.5 22 20H2z"/><path d="M12 10v4.5M12 17.5v.1"/>'), save: sv('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'), user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    sun: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'), moon: sv('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
    dot: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>', plus: sv('<path d="M12 5v14M5 12h14"/>'), diamond: sv('<path d="M12 3l8 9-8 9-8-9z"/>'),
    hands: sv('<path d="M12 21V11.5L9 6.5a1.6 1.6 0 0 1 2.8-1.6L12 5.3l.2-.4A1.6 1.6 0 0 1 15 6.5l-3 5M8 21l-3-4.5V10a1.5 1.5 0 0 1 3 0v3M16 21l3-4.5V10a1.5 1.5 0 0 0-3 0v3"/>'),
  };
  const EMO = { "✓": "check", "✅": "check", "✔": "check", "✗": "x", "❌": "x", "🔓": "unlock", "🔒": "lock", "🎓": "cap", "🔔": "bell", "📵": "belloff", "📖": "book", "📷": "camera", "📅": "calendar", "📝": "pencil", "✍": "pencil",
    "⭐": "star", "★": "star", "🎥": "video", "✦": "sparkle", "✨": "sparkle", "📌": "pin", "💬": "chat", "👥": "people", "✉": "mail", "📩": "inbox", "🎯": "target", "🏆": "trophy", "🙏": "hands", "👁": "eye", "👀": "eye",
    "💡": "bulb", "✝": "cross", "🔥": "flame", "⛪": "church", "📲": "phone", "📱": "phone", "📋": "copy", "🌍": "globe", "↩": "reply", "↪": "forward", "❤": "heart", "♥": "heart", "♛": "crown", "⚿": "key",
    "⏳": "clock", "⏰": "clock", "📣": "megaphone", "📜": "scroll", "🚫": "ban", "🖼": "image", "🗑": "trash", "📊": "chart", "⚠": "warning", "💾": "save", "👤": "user", "☀": "sun", "🌙": "moon", "🔴": "dot", "◆": "diamond",
    "🎉": "", "💪": "", "😉": "", "👋": "", "👉": "", "😊": "" };
  const EMO_RE = new RegExp("(" + Object.keys(EMO).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")[\uFE0F\u200D]?\s?", "gu");
  const U = (t) => document.createTextNode(t == null ? "" : String(t)); // texte des membres : jamais transformé
  function iconize(el, str) {
    if (!EMO_RE.test(str)) { el.append(document.createTextNode(str)); return; }
    EMO_RE.lastIndex = 0;
    const plain = el.tagName === "OPTION" || el.tagName === "OPTGROUP" || el.tagName === "TEXTAREA";
    let last = 0, m;
    while ((m = EMO_RE.exec(str))) {
      if (m.index > last) el.append(document.createTextNode(str.slice(last, m.index)));
      const name = EMO[m[1]];
      if (!plain && name) { const s = document.createElement("span"); s.className = "ico"; s.innerHTML = V[name]; el.append(s); }
      else if (m[0].endsWith(" ") && m.index > 0 && last < m.index) el.append(document.createTextNode(" "));
      last = m.index + m[0].length;
    }
    if (last < str.length) el.append(document.createTextNode(str.slice(last)));
    EMO_RE.lastIndex = 0;
  }
  const toast = (t) => { const el = h("div", { class: "toast" }, t); document.body.append(el); setTimeout(() => el.remove(), 2600); };
  const getTheme = () => { try { return localStorage.getItem("dac-theme") || "auto"; } catch (e) { return "auto"; } };
  function setTheme(t) { try { localStorage.setItem("dac-theme", t); } catch (e) { } applyTheme(); }
  function applyTheme() { const t = getTheme(), dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light"; const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark ? "#120D19" : "#2E1A47"; }
  applyTheme(); matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  const fmt = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const initials = (n) => (n || "?").split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();
  const isMyClass = (c) => S.me.role === "superadmin" || c.mentor_id === S.me.id || (S.me.role === "admin" && c.id === S.me.class_id);
  const isStaff = () => S.me && S.me.role !== "student";
  const go = (p) => { location.hash = p; };
  function confetti() {
    const c = h("canvas", { class: "confetti" }); document.body.append(c); const x = c.getContext("2d");
    c.width = innerWidth; c.height = innerHeight; const cols = ["#C9A227", "#E8C860", "#5B3A8C", "#2E1A47", "#3BB273", "#F6EDCB"];
    const P = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * .5, r: 4 + Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)], vy: 2 + Math.random() * 3, vx: -1.5 + Math.random() * 3, a: Math.random() * 6 }));
    let t = 0; (function f() { x.clearRect(0, 0, c.width, c.height); P.forEach(p => { p.y += p.vy; p.x += p.vx; p.a += .1; x.fillStyle = p.c; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * .6); x.restore(); }); if (++t < 170) requestAnimationFrame(f); else c.remove(); })();
  }
  function modal(title, body, actions) {
    const m = h("div", { class: "modal" });
    // Pas de fermeture en touchant le fond : sur téléphone, le clavier qui s'ouvre ou se ferme déplace
    // la fenêtre et un simple toucher sur un champ pouvait la fermer. On ferme avec × ou « Annuler ».
    const close = m.remove.bind(m);
    m.remove = () => { document.body.classList.remove("noscroll"); close(); };
    m.append(h("div", { class: "card sheet" }, h("div", { class: "grab" }), h("div", { class: "shead" }, h("h2", null, title), h("button", { class: "sx", type: "button", "aria-label": "Fermer", onclick: () => m.remove() }, "×")), h("div", { class: "sbody" }, body), h("div", { class: "row actions" }, actions(m))));
    document.body.append(m); document.body.classList.add("noscroll"); return m;
  }

  // fenêtre de confirmation : renvoie true si l'on confirme
  function ask(title, body, ok, danger) {
    return new Promise((res) => { let done = false; const m = modal(title, body, (mm) => [h("button", { class: "btn ghost", onclick: () => { done = true; mm.remove(); res(false); } }, "Annuler"), h("button", { class: "btn " + (danger ? "bad" : "gold"), onclick: () => { done = true; mm.remove(); res(true); } }, ok)]);
      const rm = m.remove; m.remove = () => { rm(); if (!done) { done = true; res(false); } }; });
  }
  // débloquer / verrouiller UNE leçon : on choisit la ou les classes concernées
  async function unlockSheet(l) {
    const [classes, users] = await Promise.all([API.listClasses(), API.listUsers()]); let unlocks = await API.listUnlocks();
    const mine = classes.filter(isMyClass);
    const list = h("div", { class: "ulist" });
    const draw = () => fill(list, mine.length ? mine.map(c => { const on = unlocks.some(u => u.class_id === c.id && u.lesson === l.n), n = users.filter(u => u.role === "student" && u.class_id === c.id).length;
      return h("div", { class: "urow" + (on ? " on" : "") }, h("div", { style: "flex:1;min-width:0" }, h("b", null, c.name), h("small", null, n + " élève" + (n > 1 ? "s" : "") + " · " + (on ? "🔓 ouverte" : "🔒 fermée"))),
        h("button", { class: "btn sm " + (on ? "ghost" : "gold"), onclick: async () => {
          if (!await ask((on ? "Verrouiller" : "Débloquer") + " pour « " + c.name + " » ?", h("p", null, "Leçon " + l.n + " · ", h("b", null, l.t), h("br"), (on ? "Fermer" : "Ouvrir") + " cette leçon pour la classe ", h("b", null, c.name), " (" + n + " élève" + (n > 1 ? "s" : "") + ")."), on ? "🔒 Verrouiller" : "🔓 Débloquer", on)) return;
          await API.setUnlock({ class_id: c.id }, l.n, !on); toast((on ? "Verrouillée pour " : "Débloquée pour ") + c.name); unlocks = await API.listUnlocks(); draw(); } }, on ? "Verrouiller" : "Débloquer")); })
      : h("div", { class: "note" }, S.me.role === "superadmin" ? "Aucune classe. Créez-en une dans Administration → Classes." : "Aucune classe ne vous est confiée."));
    draw();
    modal("Leçon " + l.n + " · pour quelle classe ?", h("div", null, h("p", { class: "muted", style: "margin-top:0" }, "Chaque classe avance à son rythme. Choisissez la classe à qui ouvrir (ou fermer) « " + l.t + " »."), list), (m) => [h("button", { class: "btn", onclick: () => m.remove() }, "Terminé")]);
  }

  // ---------- données : déblocages et progression ----------
  const unlockedFor = (u, unlocks) => new Set(unlocks.filter(x => x.student_id === u.id || (x.class_id && x.class_id === u.class_id)).map(x => x.lesson));
  function lessonStatus(n, unl, meta, rev, quiz) {
    if (!unl.has(n)) return "lk";
    if (rev && rev.validated) return "vd";
    if (meta && meta.submitted) return "sb";
    if (meta || quiz) return "ip";
    return "op";
  }
  const bestQuiz = (arr, sid, n) => arr.filter(q => q.student_id === sid && q.lesson === n).reduce((b, q) => !b || q.score / q.total > b.score / b.total ? q : b, null);

  // ---------- barre du haut ----------
  const logout = async () => { if (!confirm("Se déconnecter ?")) return;
    try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if (sub) await API.pushUnsubscribe(sub.endpoint); } catch (e) { }
    await API.signOut(); S.me = null; go("#/"); route(); };
  function topbar(active, unread) {
    const nav = [];
    if (S.me.role === "student") nav.push(["#/", "home", "Mon parcours", "Parcours"], ["#/communaute", "people", "Communauté", "Communauté"], ["#/agenda", "cal", "Agenda", "Agenda"], ["#/questions", "chat", "Mes questions", "Mentor"]);
    else { nav.push(["#/mentor", "grid", "Tableau de bord", "Accueil"], ["#/lecons", "book", "Leçons", "Leçons"], ["#/communaute", "people", "Communauté", "Communauté"], ["#/agenda", "cal", "Agenda", "Agenda"], ["#/inbox", "chat", "Questions", "Questions"]); if (S.me.role === "superadmin") nav.push(["#/admin", "users", "Administration", "Admin"]); }
    nav.push(["#/profil", "user", "Profil", "Profil"]);
    let tabs = nav.length > 5 ? nav.filter(x => x[0] !== "#/profil") : nav;
    const calTop = tabs.length > 5; if (calTop) tabs = tabs.filter(x => x[0] !== "#/agenda");
    const deep = S.deep; // écran secondaire : flèche retour (téléphone)
    return [
      API.mode === "demo" ? h("div", { class: "demo" }, "Mode démonstration : les données restent dans ce navigateur.") : null,
      h("header", { class: "top" + (deep ? " deep" : "") }, h("div", { class: "wrap" },
        deep ? h("a", { class: "backbtn mobile", href: deep.back, "aria-label": "Retour" }, ic("back")) : null,
        h("a", { class: "brand" + (deep ? " desk" : ""), href: "#/" }, h("img", { src: "img/logo.png", alt: "" }), h("div", null, h("b", null, "The Divine Arsenal Corporation"), h("small", null, "ÉCOLE DE DISCIPLES"))),
        deep ? h("div", { class: "toptitle mobile" }, h("b", null, deep.title), deep.sub ? h("small", null, deep.sub) : null) : null,
        h("nav", { class: "nav" }, nav.map(([href, i, t]) => h("a", { href, class: active === href ? "on" : null, title: t }, ic(i), h("span", { class: "navlabel" }, t), (i === "chat" && unread) ? h("i", { class: "dot" }) : null, i === "people" ? h("i", { class: "dot cdot" + (S.cun ? "" : " hide") }) : null)),
          h("a", { href: "#/notifications", class: active === "#/notifications" ? "on" : null, title: "Notifications" }, ic("bell"), h("i", { class: "nbadge" + (S.nun ? "" : " hide") }, S.nun > 9 ? "9+" : S.nun || "")),
          h("button", { title: "Déconnexion", onclick: logout }, ic("out"))),
        deep && deep.action ? h("a", { class: "iconbtn mobile", href: deep.action.href, title: deep.action.title, "aria-label": deep.action.title }, ic(deep.action.icon)) : null,
        !deep && calTop ? h("a", { class: "bellbtn calbtn mobile", href: "#/agenda", "aria-label": "Agenda" }, ic("cal")) : null,
        !deep ? h("a", { class: "bellbtn mobile", href: "#/notifications", "aria-label": "Notifications" }, ic("bell"), h("i", { class: "nbadge" + (S.nun ? "" : " hide") }, S.nun > 9 ? "9+" : S.nun || "")) : null,
        !deep ? h("a", { class: "meavatar mobile", href: "#/profil", "aria-label": "Mon profil" }, initials(S.me.full_name || S.me.username)) : null)),
      deep ? null : h("nav", { class: "tabbar" }, tabs.map(([href, i, t, short]) => h("a", { href, class: active === href ? "on" : null }, h("span", { class: "ti" }, ic(i), (i === "chat" && unread) ? h("i", { class: "badge" }, unread > 9 ? "9+" : unread) : null, i === "people" ? h("i", { class: "badge cbadge" + (S.cun ? "" : " hide") }, S.cun > 9 ? "9+" : S.cun || "") : null), h("span", { class: "tl" }, short)))) ];
  }
  async function unreadCount() {
    try {
      if (S.me.role === "student") return (await API.listMessages([S.me.id])).filter(m => !m.read_by_student).length;
      const us = await myStudents(); return (await API.listMessages(us.map(u => u.id))).filter(m => !m.read_by_staff).length;
    } catch (e) { return 0; }
  }
  async function myStudents() {
    const all = await API.listUsers();
    return all.filter(u => u.role === "student" && (S.me.role === "superadmin" || u.mentor_id === S.me.id));
  }
  function shell(active, unread, ...content) {
    const deep = !!S.deep;
    document.body.classList.toggle("is-deep", deep);
    fill(app, ...topbar(active, unread), h("main", { class: "screen" }, ...content));
    S.deep = null; scrollTo(0, 0);
    refreshCBadge();
  }
  function refreshCBadge() {
    if (!S.me) return;
    API.notifications().then(r => { S.nun = r.unread;
      document.querySelectorAll(".nbadge").forEach(b => { b.textContent = r.unread > 9 ? "9+" : r.unread; b.classList.toggle("hide", !r.unread); });
      try { if (navigator.setAppBadge) r.unread ? navigator.setAppBadge(r.unread) : navigator.clearAppBadge(); } catch (e) { } }).catch(() => { });
    API.communityRooms().then(r => {
      S.cun = r.unread; S.crooms = r.rooms;
      document.querySelectorAll(".cbadge").forEach(b => { b.textContent = r.unread > 9 ? "9+" : r.unread; b.classList.toggle("hide", !r.unread); });
      document.querySelectorAll(".cdot").forEach(b => b.classList.toggle("hide", !r.unread));
      document.querySelectorAll(".dc[data-room]").forEach(el => { const x = r.rooms.find(y => y.room === el.dataset.room); el.textContent = x ? (x.unread ? x.unread + " nouveau" + (x.unread > 1 ? "x" : "") : x.count + " message" + (x.count > 1 ? "s" : "")) : ""; el.classList.toggle("new", !!(x && x.unread)); });
    }).catch(() => { });
  }
  // tableaux : chaque cellule reçoit l'intitulé de sa colonne (affichage en fiches sur téléphone)
  function labelize(t) {
    const heads = [...t.querySelectorAll("tr:first-child th")].map(x => x.textContent);
    t.classList.add("rt");
    t.querySelectorAll("tr").forEach((tr, i) => { if (!i && tr.querySelector("th")) { tr.classList.add("hd"); return; } [...tr.children].forEach((td, k) => { if (heads[k]) td.dataset.label = heads[k]; }); });
    return t;
  }
  // ---------- installation de l'application (PWA) ----------
  let installEvt = null;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; document.querySelectorAll(".installcard").forEach(x => x.classList.remove("hide")); });
  addEventListener("appinstalled", () => { installEvt = null; document.querySelectorAll(".installcard").forEach(x => x.remove()); toast("Application installée ✓"); });
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  async function doInstall() {
    if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice; installEvt = null; if (r.outcome === "accepted") document.querySelectorAll(".installcard").forEach(x => x.remove()); return; }
    modal("Installer l'application", h("div", { class: "steps" }, isIOS()
      ? [h("p", null, "Sur iPhone / iPad, avec ", h("b", null, "Safari"), " :"), h("ol", null, h("li", null, "Touchez le bouton ", h("b", null, "Partager"), " (le carré avec une flèche ↑) en bas de l'écran."), h("li", null, "Faites défiler et touchez ", h("b", null, "« Sur l'écran d'accueil »"), "."), h("li", null, "Touchez ", h("b", null, "Ajouter"), " : l'icône apparaît sur votre téléphone."))]
      : [h("p", null, "Sur Android, avec ", h("b", null, "Chrome"), " :"), h("ol", null, h("li", null, "Touchez le menu ", h("b", null, "⋮"), " en haut à droite."), h("li", null, "Touchez ", h("b", null, "« Installer l'application »"), " ou ", h("b", null, "« Ajouter à l'écran d'accueil »"), "."), h("li", null, "Confirmez : l'icône apparaît avec vos autres applications."))]),
      (m) => [h("button", { class: "btn", onclick: () => m.remove() }, "J'ai compris")]);
  }
  function installCard() {
    if (standalone()) return null;
    let dismissed = false; try { dismissed = localStorage.getItem("dac-install-x") === "1"; } catch (e) { }
    if (dismissed) return null;
    const c = h("div", { class: "installcard" + (installEvt || isIOS() || matchMedia("(max-width:820px)").matches ? "" : " hide") },
      h("img", { src: "img/icon-192.png", alt: "" }),
      h("div", { class: "ic-t" }, h("b", null, "Installe l'application"), h("span", null, "Sur ton écran d'accueil, comme WhatsApp.")),
      h("button", { class: "btn gold sm", onclick: doInstall }, "Installer"),
      h("button", { class: "x", "aria-label": "Fermer", onclick: () => { try { localStorage.setItem("dac-install-x", "1"); } catch (e) { } c.remove(); } }, "×"));
    return c;
  }

  // =============================== CONNEXION ===============================
  function viewLogin() {
    let mode = "in";
    const err = h("div", { class: "err hide" });
    const f = { u: h("input", { class: "in", autocomplete: "username", placeholder: "ex. grace.mbala" }), p: h("input", { class: "in", type: "password", autocomplete: "current-password" }),
      n: h("input", { class: "in", placeholder: "Prénom et nom" }), c: h("input", { class: "in", placeholder: "Donné par ton mentor", style: "text-transform:uppercase" }) };
    const signupOnly = h("div", { class: "hide" }, h("label", { class: "f" }, "Ton nom complet"), f.n, h("label", { class: "f" }, "Code de ta classe"), f.c);
    const btn = h("button", { class: "btn gold", style: "width:100%;margin-top:18px", type: "submit" }, "Entrer");
    const tabs = h("div", { class: "tabs" });
    const setMode = (m) => { mode = m; fill(tabs, h("button", { type: "button", class: m === "in" ? "on" : null, onclick: () => setMode("in") }, "Connexion"), h("button", { type: "button", class: m === "up" ? "on" : null, onclick: () => setMode("up") }, "Créer mon compte"));
      signupOnly.classList.toggle("hide", m === "in"); btn.textContent = m === "in" ? "Entrer" : "Créer mon compte"; f.p.autocomplete = m === "in" ? "current-password" : "new-password"; err.classList.add("hide"); };
    setMode("in");
    const form = h("form", { onsubmit: async (e) => { e.preventDefault(); err.classList.add("hide"); btn.disabled = true;
      try { if (mode === "up" && !f.n.value.trim()) throw new Error("Écris ton nom complet");
        S.me = mode === "in" ? await API.signIn(f.u.value, f.p.value) : await API.signUp({ username: f.u.value, password: f.p.value, full_name: f.n.value.trim(), class_code: f.c.value });
        go(S.me.role === "student" ? "#/" : "#/mentor"); route(); try { if (pushState() === "granted") subscribePush(true).catch(() => { }); } catch (e) { } }
      catch (x) { err.textContent = x.message; err.classList.remove("hide"); } finally { btn.disabled = false; } } },
      h("label", { class: "f" }, "Identifiant"), f.u, h("label", { class: "f" }, "Mot de passe"), f.p, signupOnly, btn, err);
    fill(app, h("div", { class: "login" },
      h("div", { class: "hero" }, h("img", { class: "herologo", src: "img/logo.png", alt: "The Divine Arsenal Corporation" }), h("div", { class: "k", style: "color:var(--gold2);font-weight:800;letter-spacing:3px;font-size:13px" }, "THE DIVINE ARSENAL CORPORATION"),
        h("h1", null, "Ton cahier de disciple, ", h("span", { class: "gold" }, "toujours avec toi.")),
        h("p", null, "Relis tes résumés de cours, remplis ton cahier en ligne, pose tes questions à ton mentor et teste-toi à la fin de chaque leçon."),
        h("div", { class: "v" }, "« Croissez dans la grâce et dans la connaissance de notre seigneur et sauveur Jésus Christ. » — 2 Pierre 3.18")),
      h("div", { class: "panel" }, h("div", { class: "card", style: "box-shadow:none;background:transparent" },
        h("img", { class: "logo", src: "img/logo.png", alt: "The Divine Arsenal Corporation" }), tabs, form,
        API.mode === "demo" ? h("div", { class: "note", style: "margin-top:16px" }, h("b", null, "Comptes de démonstration : "), "etudiant / etudiant123 · mentor / mentor123 · admin / admin123 · code de classe : DEMO2026") : null,
        h("div", { style: "margin-top:16px" }, installCard())))));
  }

  // =============================== ÉLÈVE : ACCUEIL ===============================
  async function viewStudentHome() {
    const [unlocks, meta, revs, quiz, unread] = await Promise.all([API.listUnlocks(), API.listAnswersMeta([S.me.id]), API.listReviews([S.me.id]), API.listQuiz([S.me.id]), unreadCount()]);
    const unl = unlockedFor(S.me, unlocks);
    const st = Object.fromEntries(LESSONS.map(l => [l.n, lessonStatus(l.n, unl, meta.find(m => m.lesson === l.n), revs.find(r => r.lesson === l.n), quiz.find(q => q.lesson === l.n))]));
    const done = LESSONS.filter(l => st[l.n] === "vd").length, opened = [...unl].length;
    const pct = opened ? Math.round(100 * LESSONS.filter(l => ["sb", "vd"].includes(st[l.n])).length / opened) : 0;
    const current = LESSONS.find(l => ["op", "ip"].includes(st[l.n])) || LESSONS.find(l => st[l.n] !== "lk");
    const C = 2 * Math.PI * 52;
    const passes = LESSONS.filter(l => { const b = bestQuiz(quiz, S.me.id, l.n); return b && b.score / b.total >= PASS; }).length;
    const [agCard, pdCard, certs] = await Promise.all([agendaCard(), pendingCard(), API.certs(S.me.id).catch(() => [])]);
    shell("#/", unread, h("div", { class: "wrap page" }, installCard(), pushCard(),
      h("div", { class: "welcome" },
        h("div", { class: "ring", html: `<svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" stroke="rgba(255,255,255,.15)" stroke-width="12" fill="none"/><circle cx="60" cy="60" r="52" stroke="#C9A227" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"/></svg><b>${pct}%<small>CAHIERS ENVOYÉS</small></b>` }),
        h("div", null, h("div", { class: "k" }, "BIENVENUE"), h("h1", null, "Shalom, " + (S.me.full_name || S.me.username).split(" ")[0] + " !"),
          current ? [h("p", null, "Ta leçon du moment : ", h("b", { style: "color:#fff" }, current.n + " · " + current.t)), h("a", { class: "btn gold", style: "margin-top:14px", href: "#/lecon/" + current.n }, "Continuer ma leçon →")] : h("p", null, "Ton mentor va bientôt débloquer ta première leçon. Reste connecté !"))),
      pdCard, agCard,
      h("div", { class: "stats" },
        h("div", { class: "stat" }, h("b", null, opened), h("span", null, "Leçons ouvertes")),
        h("div", { class: "stat" }, h("b", null, done), h("span", null, "Leçons validées ⭐")),
        h("div", { class: "stat" }, h("b", null, passes), h("span", null, "Tests réussis")),
        h("div", { class: "stat" }, h("b", null, unread), h("span", null, "Réponses non lues"))),
      PHASES.map(p => { const ls = LESSONS.filter(l => l.ph === p.n);
        const cs = certs.find(c => c.phase === p.n);
        return h("section", { class: "phase" }, h("h2", null, "Phase " + p.n + " · " + p.t, h("small", null, ls.filter(l => st[l.n] === "vd").length + " / " + ls.length)), cs && (cs.eligible || cs.validated) ? certBlock(cs, S.me.id) : null,
          h("div", { class: "grid" }, ls.map(l => lessonCard(l, st[l.n], bestQuiz(quiz, S.me.id, l.n))))); })));
  }
  function lessonCard(l, s, q) {
    const chips = { op: [h("span", { class: "chip w" }, "À commencer")], ip: [h("span", { class: "chip" }, "En cours")], sb: [h("span", { class: "chip g" }, "Envoyé au mentor")], vd: [h("span", { class: "chip ok" }, "✓ Validée")] }[s] || [];
    if (q) chips.push(h("span", { class: "chip" }, "Test " + q.score + "/" + q.total));
    if (s === "lk") return h("button", { class: "lcard locked", type: "button", onclick: () => lessonPreview(l) }, h("div", { class: "n" }, "LEÇON " + l.n), h("h3", null, l.t), h("div", { class: "hk" }, l.hook), h("div", { class: "foot" }, h("span", { class: "chip l" }, ic("lock"), "Bientôt débloquée"), h("span", { class: "chip l" }, "👁 Aperçu")), h("div", { class: "wm" }, l.n));
    return h("a", { class: "lcard p" + l.ph, href: "#/lecon/" + l.n }, h("div", { class: "n" }, "LEÇON " + l.n), h("h3", null, l.t), h("div", { class: "hk" }, l.hook), h("div", { class: "foot" }, chips), h("div", { class: "wm" }, l.n));
  }

  // aperçu d'une leçon encore verrouillée
  function lessonPreview(l) {
    const ph = PHASES.find(p => p.n === l.ph) || {};
    modal("Leçon " + l.n + " · " + l.t, h("div", { class: "preview" },
      h("div", { class: "pv-band p" + l.ph }, h("div", { class: "k" }, "PHASE " + l.ph + (ph.t ? " · " + ph.t.toUpperCase() : "") + " · " + l.etape.toUpperCase()), h("div", { class: "pv-hook" }, "« " + l.hook + " »"), h("div", { class: "pv-fil" }, l.fil)),
      h("h4", null, "🎯 À la fin de cette leçon, tu sauras"), h("p", { class: "pv-goal" }, l.wb.but),
      h("h4", null, "✦ Ce que tu vas découvrir"), h("ul", { class: "pv-list" }, l.sup.dec.map(d => h("li", null, d))),
      h("h4", null, "📌 Les grands points"), h("ol", { class: "pv-list" }, l.sup.pts.map(p => h("li", null, p[0]))),
      h("h4", null, "📖 Pour te préparer"), h("p", null, "À lire : ", h("b", null, l.lire || l.wb.ref), h("br"), "Verset de la semaine : ", h("b", null, l.wb.ref)),
      h("div", { class: "note", style: "margin-top:12px" }, "🔒 Cette leçon s'ouvrira quand ton mentor la débloquera. Tu pourras alors lire le résumé complet, remplir ton cahier, passer le test et rejoindre la discussion de la leçon.")),
      (m) => [h("button", { class: "btn", onclick: () => m.remove() }, "J'ai hâte !")]);
  }

  // =============================== LEÇON ===============================
  async function viewLesson(n, tab, sid) {
    const l = L[n]; if (!l) return go("#/");
    const student = sid ? await API.getUser(sid) : S.me;
    const review = !!sid; // mentor qui corrige
    const preview = !sid && isStaff(); // superadmin / mentor qui consulte la leçon
    if (!review && S.me.role === "student") { const unl = unlockedFor(S.me, await API.listUnlocks()); if (!unl.has(n)) { toast("Cette leçon n'est pas encore débloquée"); return go("#/"); } }
    const [ans, rev, msgs, quiz, unread] = preview ? [null, null, [], [], await unreadCount()] : await Promise.all([API.getAnswers(student.id, n), API.getReview(student.id, n), API.listMessages([student.id]), API.listQuiz([student.id]), unreadCount()]);
    const lm = msgs.filter(m => m.lesson === n);
    const base = review ? `#/revue/${sid}/${n}` : `#/lecon/${n}`;
    const tabs = review ? [["cahier", "Cahier de " + (student.full_name || student.username).split(" ")[0]], ["test", "Tests"], ["support", "Résumé du cours"]]
      : preview ? [["support", "📖 Résumé du cours"], ["cahier", "✍️ Cahier d'exercices"], ["test", "🏆 Test final"]]
      : [["support", "📖 Résumé du cours"], ["cahier", "✍️ Mon cahier"], ["test", "🏆 Test final"], ["questions", "💬 Mes questions"]];
    const unreadL = lm.filter(m => review ? !m.read_by_staff : !m.read_by_student).length;
    tab = tab || (review ? "cahier" : "support");
    const backHref = review ? "#/eleve/" + sid : preview ? "#/lecons" : "#/";
    const head = h("div", { class: "lhead p" + l.ph }, h("div", { class: "wrap" },
      h("a", { class: "back desk", href: backHref }, "← " + (review ? (student.full_name || student.username) : preview ? "Toutes les leçons" : "Mon parcours")),
      h("div", { class: "k" }, "LEÇON " + l.n + " · " + l.etape.toUpperCase()), h("h1", null, l.t), h("div", { class: "fil" }, l.fil),
      h("div", { class: "row", style: "gap:8px" }, h("a", { class: "discuss", href: "#/communaute/" + l.n }, ic("people"), "Discussion de la leçon", h("span", { class: "dc", "data-room": l.n })),
        preview ? h("button", { class: "discuss gold", onclick: () => unlockSheet(l) }, "🔓 Débloquer pour une classe…") : null)));
    const short = { support: "Résumé", cahier: review ? "Cahier" : "Cahier", test: "Test", questions: "Questions" };
    const tabsBar = h("div", { class: "ltabs" }, h("div", { class: "wrap" }, tabs.map(([k, t]) => h("a", { href: base + "/" + k, class: tab === k ? "on" : null, onclick: (e) => { e.preventDefault(); location.replace(base + "/" + k); } }, h("span", { class: "lt-long" }, t), h("span", { class: "lt-short" }, short[k]), (k === "questions" || (review && k === "cahier")) && unreadL ? h("span", { class: "c" }, unreadL) : null))));
    const body = h("div", { class: "wrap page lpage" });
    S.deep = { back: backHref, title: "Leçon " + l.n + " · " + l.t, sub: review ? (student.full_name || student.username) : preview ? "Aperçu" : null };
    shell(review ? "#/mentor" : preview ? "#/lecons" : "#/", unread, head, tabsBar, body);
    if (tab === "support") renderSupport(body, l);
    else if (tab === "cahier") renderCahier(body, l, student, ans, rev, lm, review, preview);
    else if (tab === "test") renderTest(body, l, student, quiz.filter(q => q.lesson === n), review, preview);
    else if (tab === "questions") renderMyQuestions(body, l, lm);
  }

  // ---------- résumé du cours ----------
  function renderSupport(el, l) {
    const s = l.sup;
    const sec = (L_, t, p) => h("div", { class: "sec" }, h("div", { class: "L" }, L_), h("div", null, h("h2", null, t), p ? h("p", null, p) : null));
    let schema;
    if (s.schema.type === "flow") schema = h("div", { class: "flow" }, s.schema.items.map(i => h("div", null, h("b", null, i[0]), h("span", { style: "font-weight:700" }, i[1]), h("i", null, i[2]))));
    else if (s.schema.type === "grid") schema = h("div", { class: "flow" }, s.schema.items.map((i, k) => Array.isArray(i) ? h("div", null, h("b", null, i[0]), h("i", null, i[1])) : h("div", null, h("b", null, k + 1), h("i", null, i))));
    else if (s.schema.type === "pyramid") schema = h("div", null, s.schema.items.map((i, k) => h("div", { style: `margin:6px auto;width:${45 + 55 * k / (s.schema.items.length - 1)}%;background:${k % 2 ? "var(--pur2)" : "var(--pur)"};color:#fff;border-radius:12px;padding:10px 14px;text-align:center` }, h("b", { style: "color:var(--gold2)" }, "Niveau " + i[0] + " · "), i[1], i[2] ? h("div", { style: "font-size:13px;color:#E4DAF2" }, i[2]) : null)));
    else schema = tableOf(s.schema);
    add(el, 
      h("div", { class: "row noprint dlrow", style: "justify-content:flex-end;margin-top:14px" },
        h("button", { class: "btn ghost sm", onclick: () => print() }, ic("dl"), "Résumé (PDF)"),
        h("a", { class: "btn ghost sm", href: "files/Mon-support-de-cours-Phase-" + l.ph + ".docx", download: true }, ic("dl"), "Support (Word)")),
      sec("★", "L'idée clé"), h("div", { class: "idea" }, s.phrase),
      sec("✦", "Ce que tu vas découvrir"), h("div", { class: "card" }, s.dec.map(d => h("div", { style: "margin:4px 0" }, h("b", { style: "color:var(--gold)" }, "✦ "), d))),
      sec("1", "L'essentiel"), s.pts.map((p, k) => h("div", { class: "pt" }, h("div", { class: "nb" }, k + 1), h("div", null, h("h3", null, p[0]), h("p", null, p[1]), p[2] ? h("div", { class: "rd" }, "📖 À lire : " + p[2]) : null))),
      sec("◆", s.schema.titre.replace(/^Le schéma à retenir : /, "Le schéma : ")), h("div", { class: "scroll" }, schema),
      s.table ? [sec("◆", s.table.titre), h("div", { class: "scroll" }, tableOf(s.table))] : null,
      sec("!", "Attention, piège !"), h("div", { class: "trap" }, h("div", { class: "h1" }, "✗ Ce qu'on croit souvent"), h("div", { class: "h2" }, "✓ Ce que dit la Parole"), s.piege.map(p => [h("div", { class: "a" }, p[0]), h("div", { class: "b" }, p[1])])),
      sec("♥", "À graver dans mon cœur"), h("div", { class: "verse" }, h("div", { class: "ref" }, l.wb.ref), h("q", null, l.wb.verse), h("div", { class: "muted", style: "font-size:14px" }, "💡 " + s.astuce)),
      sec("✝", "Aller plus profond : devenir comme Jésus"), h("div", { class: "cols3" }, h("div", { class: "c3" }, h("h3", null, "✝ Regarde Jésus"), s.jesus), h("div", { class: "c3 d" }, h("h3", null, "♛ Le Royaume"), s.royaume), h("div", { class: "c3 g" }, h("h3", null, "? À méditer"), s.mediter)),
      sec("⚿", "Les mots-clés"), h("div", { class: "mots" }, s.mots.map(m => [h("div", { class: "w" }, m[0]), h("div", null, m[1])])),
      h("p", { class: "muted", style: "font-size:12px;margin-top:20px" }, "Les encadrés « Le Royaume » résument l'enseignement du Dr Myles Munroe (résumés, non des citations). Versets : version Darby."),
      h("div", { class: "row noprint", style: "margin-top:20px" }, h("a", { class: "btn gold", href: "#/lecon/" + l.n + "/cahier" }, "J'ai lu, je remplis mon cahier →")));
  }
  function tableOf(t) { return labelize(h("table", { class: "t" }, h("tr", null, t.head.map(c => h("th", null, c))), t.rows.map(r => h("tr", null, r.map((c, i) => h("td", { style: i ? null : "font-weight:700;color:var(--tp)" }, c)))))); }

  // ---------- cahier ----------
  function renderCahier(el, l, student, ans, rev, msgs, review, preview) {
    const data = JSON.parse(JSON.stringify((ans && ans.data) || {}));
    const items = (rev && rev.items) || {};
    const ro = review || preview; // le mentor ne modifie pas les réponses
    const saveEl = h("div", { class: "save" }, "Enregistré ✓"); document.body.querySelectorAll(".save").forEach(x => x.remove()); document.body.append(saveEl);
    let timer = null;
    const persist = (submitted) => API.saveAnswers(student.id, l.n, data, submitted).then(() => { saveEl.textContent = "Enregistré"; saveEl.classList.add("show"); setTimeout(() => saveEl.classList.remove("show"), 1400); }).catch(e => toast("Erreur d'enregistrement : " + e.message));
    const changed = () => { if (ro) return; saveEl.textContent = "Enregistrement…"; saveEl.classList.add("show"); clearTimeout(timer); timer = setTimeout(() => persist(false), 900); };
    const reviewState = JSON.parse(JSON.stringify(items));
    let rvTimer = null;
    const saveRev = () => { clearTimeout(rvTimer); rvTimer = setTimeout(() => API.saveReview(student.id, l.n, { items: reviewState }).then(() => { saveEl.textContent = "Correction enregistrée"; saveEl.classList.add("show"); setTimeout(() => saveEl.classList.remove("show"), 1400); }), 700); };

    const text = (key, rows, ph) => { const t = h("textarea", { class: "in", rows: rows || 3, placeholder: ph || "Écris ta réponse ici…", disabled: ro }); t.value = data[key] || ""; t.addEventListener("input", () => { data[key] = t.value; changed(); }); return t; };
    function itemFoot(key, title) {
      if (preview) return [];
      const th = msgs.filter(m => m.item_key === key), un = th.filter(m => review ? !m.read_by_staff : !m.read_by_student).length;
      const bar = h("div", { class: "bar" }, h("button", { class: "askbtn" + (th.length ? " has" : ""), type: "button", onclick: () => openThread(student, l, key, title, review) }, ic("chat"), th.length ? th.length + " message" + (th.length > 1 ? "s" : "") : (review ? "Écrire à l'élève" : "Poser une question au mentor"), un ? h("i", { class: "u" }) : null));
      const r = items[key];
      const out = [bar];
      if (!review && r && (r.ok != null || r.comment)) out.push(h("div", { class: "rv " + (r.ok === false ? "no" : "ok") }, h("b", null, r.ok === false ? "✗ À revoir" : "✓ Bien"), r.comment ? [" · ", U(r.comment)] : ""));
      if (review) {
        const st = reviewState[key] = reviewState[key] || {};
        const okb = h("button", { class: "okb" + (st.ok === true ? " on" : ""), type: "button" }, "✓ Bien"), nob = h("button", { class: "nob" + (st.ok === false ? " on" : ""), type: "button" }, "✗ À revoir");
        okb.onclick = () => { st.ok = st.ok === true ? null : true; okb.classList.toggle("on", st.ok === true); nob.classList.remove("on"); saveRev(); };
        nob.onclick = () => { st.ok = st.ok === false ? null : false; nob.classList.toggle("on", st.ok === false); okb.classList.remove("on"); saveRev(); };
        const cm = h("input", { class: "in", placeholder: "Commentaire pour l'élève (facultatif)" }); cm.value = st.comment || ""; cm.oninput = () => { st.comment = cm.value; saveRev(); };
        out.push(h("div", { class: "rvbar" }, okb, nob, cm));
      }
      return out;
    }
    const item = (key, num, q, input, title) => h("div", { class: "item", id: "it-" + key }, h("div", { class: "q" }, num ? h("span", { class: "num" }, num) : null, h("span", null, q)), input, itemFoot(key, title || q));
    const sec = (L_, t, p) => h("div", { class: "sec" }, h("div", { class: "L" }, L_), h("div", null, h("h2", null, t), p ? h("p", null, p) : null));

    if (review) add(el, h("div", { class: "card", style: "margin-top:14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap" },
      h("div", { class: "avatar" }, initials(student.full_name)), h("div", null, h("b", null, student.full_name || student.username), h("div", { class: "muted", style: "font-size:14px" }, ans ? (ans.submitted ? "Cahier envoyé le " + fmt(ans.submitted_at) : "En cours · modifié le " + fmt(ans.updated_at)) : "Pas encore commencé")),
      h("div", { class: "spacer" }), h("span", { class: "muted", style: "font-size:13px" }, "Cliquez ✓ ou ✗ sous chaque réponse : tout est enregistré automatiquement.")));
    else if (preview) add(el, h("div", { class: "note", style: "margin-top:14px" }, "👁 ", h("b", null, "Aperçu du cahier : "), "voici exactement ce que les élèves rempliront pour cette leçon. Pour qu'ils y aient accès, débloquez la leçon dans Administration → Déblocage des leçons (ou dans votre tableau de bord).", h("br"), "🎯 ", h("b", null, "Objectif : "), l.wb.but));
    else add(el, h("div", { class: "note", style: "margin-top:14px" }, "🎯 ", h("b", null, "Mon objectif : "), l.wb.but, h("br"), "Tes réponses s'enregistrent automatiquement. Une question ? Clique sur « Poser une question au mentor » sous la question concernée."));

    // verset
    add(el, sec("★", "Mon verset de la semaine", l.wb.ref), h("div", { class: "verse" }, h("div", { class: "ref" }, l.wb.ref), h("q", null, l.wb.verse)),
      item("V", null, "Je l'écris de mémoire, sans regarder :", text("V", 3, "Écris le verset de mémoire…"), "Mon verset"));
    // A
    add(el, sec("A", "Je vérifie ma compréhension", "Réponds avec tes mots, et cite un verset."));
    l.wb.q.forEach((q, i) => add(el, item("A" + (i + 1), (i + 1) + ".", q, text("A" + (i + 1), 3))));
    // B
    add(el, sec("B", "Vrai ou faux", "Coche, puis corrige les phrases fausses."));
    l.wb.vf.forEach((s, i) => {
      const k = "B" + (i + 1), name = k + "-" + Math.random().toString(36).slice(2, 6);
      const tf = h("div", { class: "tf" }, ["V", "F"].map(v => { const inp = h("input", { type: "radio", name, value: v, disabled: ro }); inp.checked = data[k] === v; inp.onchange = () => { data[k] = v; changed(); }; return h("label", null, inp, h("span", null, v === "V" ? "Vrai" : "Faux")); }));
      const corr = text(k + "c", 2, "Si c'est faux, la bonne réponse :");
      const keyInfo = review && data[k] ? h("div", { class: "key " + ((data[k] === "V") === l.wb.vfKey[i] ? "good" : "bad") }, "Réponse attendue : " + (l.wb.vfKey[i] ? "Vrai" : "Faux") + ((data[k] === "V") === l.wb.vfKey[i] ? " · correct" : " · incorrect")) : null;
      add(el, item(k, (i + 1) + ".", s, [tf, h("div", { style: "margin-top:8px" }, corr), keyInfo]));
    });
    // C
    add(el, sec("C", "Je mets en pratique", "Exercices"));
    l.wb.ex.forEach((e, i) => {
      let input;
      if (e.type === "table") {
        const rows = (data[e.k] = Array.isArray(data[e.k]) ? data[e.k] : []);
        input = h("div", { class: "scroll" }, h("table", { class: "tbl" }, h("tr", { class: "hd" }, e.cols.map(c => h("th", null, c))), Array.from({ length: e.rows }, (_, r) => h("tr", null, e.cols.map((_, c) => { const inp = h("input", { disabled: ro }); inp.value = (rows[r] || [])[c] || ""; inp.oninput = () => { rows[r] = rows[r] || []; rows[r][c] = inp.value; changed(); }; return h("td", { "data-label": e.cols[c] }, inp); })))));
      } else input = [e.hint ? h("div", { class: "muted", style: "font-size:13px;margin-bottom:6px" }, e.hint) : null, text(e.k, e.rows)];
      add(el, item(e.k, (i + 1) + ".", e.q, input));
    });
    // D
    const days = ["L", "M", "M", "J", "V", "S", "D"];
    const D = (data.D = data.D || {});
    const streakEl = h("b");
    const streak = () => { let best = 0, cur = 0; for (let d = 0; d < 7; d++) { const any = l.wb.d.some((_, t) => D[t + "-" + d]); cur = any ? cur + 1 : 0; best = Math.max(best, cur); } streakEl.textContent = best + " jour" + (best > 1 ? "s" : "") + " d'affilée"; };
    add(el, sec("D", "Mon défi de la semaine", "Une case par jour : ne casse pas la chaîne !"),
      h("div", { class: "item", id: "it-D" }, h("div", { class: "scroll" }, h("table", { class: "week" }, h("tr", { class: "hd" }, h("th", null, "Mon défi"), days.map(d => h("th", null, d))),
        l.wb.d.map((t, ti) => h("tr", null, h("td", { class: "t" }, t), days.map((_, di) => { const b = h("button", { type: "button", class: "tick" + (D[ti + "-" + di] ? " on" : ""), disabled: ro }, "✓"); b.onclick = () => { D[ti + "-" + di] = !D[ti + "-" + di]; b.classList.toggle("on"); streak(); changed(); }; return h("td", { class: "c", "data-d": ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][di] }, b); }))))),
        h("div", { style: "margin-top:8px" }, "🔥 Ma meilleure série : ", streakEl), itemFoot("D", "Mon défi de la semaine")));
    streak();
    // E
    add(el, sec("E", "Mon journal de la semaine", "Une ligne par jour : ce que Dieu m'a montré."),
      h("div", { class: "item", id: "it-E" }, Array.from({ length: 7 }, (_, i) => { const inp = h("input", { class: "in", placeholder: "Jour " + (i + 1), disabled: ro, style: "margin:4px 0" }); inp.value = data["E" + (i + 1)] || ""; inp.oninput = () => { data["E" + (i + 1)] = inp.value; changed(); }; return inp; }),
        h("div", { class: "q", style: "margin-top:14px" }, h("span", null, "La grande question de la semaine : ", h("i", { style: "font-weight:500" }, l.wb.j))), text("EJ", 3), itemFoot("E", "Mon journal")));
    // bilan
    const stars = h("div", { class: "stars" });
    const drawStars = () => fill(stars, ...[1, 2, 3, 4, 5].map(v => h("button", { type: "button", class: (data.Z2 || 0) >= v ? "on" : null, disabled: ro, onclick: () => { data.Z2 = v; drawStars(); changed(); } }, "★")));
    drawStars();
    add(el, sec("✓", "Mon bilan"), h("div", { class: "item", id: "it-Z" }, h("div", { class: "q" }, "Ce que je retiens en une phrase :"), text("Z1", 2), h("div", { class: "q", style: "margin-top:12px" }, "Ma semaine, de 1 à 5 étoiles :"), stars, itemFoot("Z", "Mon bilan")));

    if (preview) { /* aperçu : pas d'envoi */ }
    else if (!review) {
      const sent = ans && ans.submitted;
      add(el, h("div", { class: "sendbox" }, h("div", { style: "flex:1;min-width:220px" }, h("h3", null, sent ? "Cahier envoyé ✓" : "Tu as terminé ?"), h("p", null, sent ? "Ton mentor a reçu ton cahier. Tu peux encore le modifier : il verra la dernière version." : "Envoie ton cahier à ton mentor pour qu'il le corrige, puis passe le test final.")),
        h("button", { class: "btn gold", onclick: async () => { clearTimeout(timer); await persist(true); confetti(); toast("Cahier envoyé à ton mentor 🎉"); go("#/lecon/" + l.n + "/test"); } }, sent ? "Renvoyer la mise à jour" : "Envoyer à mon mentor"),
        rev && rev.validated ? h("span", { class: "chip ok", style: "font-size:14px" }, "⭐ Leçon validée par ton mentor") : null),
        rev && rev.general ? h("div", { class: "card", style: "margin-top:14px;border-left:6px solid var(--gold)" }, h("b", null, "Mot de ton mentor : "), U(rev.general)) : null);
    } else {
      const gen = h("textarea", { class: "in", rows: 3, placeholder: "Un mot d'encouragement ou une remarque générale…" }); gen.value = (rev && rev.general) || "";
      const valid = !!(rev && rev.validated);
      add(el, h("div", { class: "sendbox" }, h("div", { style: "flex:1;min-width:240px" }, h("h3", null, "Appréciation générale"), gen),
        h("div", { class: "row" }, h("button", { class: "btn ghost", style: "color:#fff;box-shadow:inset 0 0 0 2px rgba(255,255,255,.4)", onclick: async () => { await API.saveReview(student.id, l.n, { items: reviewState, general: gen.value }); toast("Appréciation enregistrée"); } }, "Enregistrer"),
          h("button", { class: "btn gold", onclick: async () => { await API.saveReview(student.id, l.n, { items: reviewState, general: gen.value, validated: !valid }); toast(valid ? "Validation retirée" : "Leçon validée ⭐"); if (!valid) confetti(); route(); } }, valid ? "Retirer la validation" : "⭐ Valider la leçon"))));
      // lu par le mentor
      API.markRead(msgs.filter(m => !m.read_by_staff).map(m => m.id), true).catch(() => { });
    }
  }

  // ---------- fil de questions sur un élément ----------
  async function openThread(student, l, key, title, asStaff) {
    const all = (await API.listMessages([student.id])).filter(m => m.lesson === l.n && m.item_key === key);
    const users = isStaff() ? await API.listUsers() : [];
    const nameOf = (id) => id === S.me.id ? "Moi" : id === student.id ? (student.full_name || "Élève") : ((users.find(u => u.id === id) || {}).full_name || "Mentor");
    const list = h("div", { class: "msgs" });
    const draw = (ms) => fill(list, ...(ms.length ? ms.map(m => h("div", { class: "msg" + (m.author_id === S.me.id ? " mine" : "") }, U(m.body), h("small", null, nameOf(m.author_id) + " · " + fmt(m.created_at)))) : [h("div", { class: "empty" }, asStaff ? "Aucun message. Écrivez un mot à l'élève sur cette question." : "Pose ta question : ton mentor te répondra ici.")]));
    draw(all);
    const ta = h("textarea", { class: "in", placeholder: "Écris ton message…", rows: 1 });
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; });
    const send = async () => { const b = ta.value.trim(); if (!b) return; ta.value = ""; const m = await API.postMessage(student.id, l.n, key, b); all.push(m); draw(all); list.scrollTop = 1e6; };
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer:coarse)").matches) { e.preventDefault(); send(); } });
    let downOnBg = false;
    const d = h("div", { class: "drawer", onpointerdown: (e) => { downOnBg = e.target === d; }, onclick: (e) => { if (e.target === d && downOnBg) close(); } }, h("div", { class: "in2" },
      h("header", null, h("button", { class: "dback", "aria-label": "Retour", onclick: () => close() }, ic("back")), h("div", { class: "avatar" }, asStaff ? initials(student.full_name) : "M"), h("div", { style: "min-width:0;flex:1" }, h("h3", null, asStaff ? (student.full_name || student.username) : "Mon mentor"), h("p", null, "Leçon " + l.n + " · " + title.slice(0, 80) + (title.length > 80 ? "…" : ""))), h("button", { class: "dx", "aria-label": "Fermer", onclick: () => close() }, "×")),
      list, h("footer", null, ta, h("button", { class: "sendbtn", "aria-label": "Envoyer", onclick: send }, ic("send")))));
    const close = () => { d.remove(); document.body.classList.remove("noscroll"); route(); };
    document.body.append(d); document.body.classList.add("noscroll"); list.scrollTop = 1e6; if (!matchMedia("(pointer:coarse)").matches) ta.focus();
    const unreadIds = all.filter(m => asStaff ? !m.read_by_staff : !m.read_by_student).map(m => m.id);
    if (unreadIds.length) API.markRead(unreadIds, asStaff).catch(() => { });
  }

  // ---------- test final ----------
  function renderTest(el, l, student, attempts, review, preview) {
    const best = attempts.reduce((b, q) => !b || q.score / q.total > b.score / b.total ? q : b, null);
    if (review) {
      add(el, h("div", { class: "card", style: "margin-top:14px" }, h("h2", null, "Résultats du test"), attempts.length ? labelize(h("table", { class: "t" }, h("tr", null, h("th", null, "Date"), h("th", null, "Score"), h("th", null, "Résultat")),
        attempts.map(a => h("tr", null, h("td", null, fmt(a.created_at)), h("td", null, a.score + " / " + a.total), h("td", null, a.score / a.total >= PASS ? h("span", { class: "chip v" }, "Réussi") : h("span", { class: "chip r" }, "À refaire")))))) : h("p", { class: "muted" }, "Pas encore de tentative.")));
      return;
    }
    const answers = {};
    const intro = h("div", { class: "card", style: "margin-top:14px;display:flex;gap:16px;align-items:center;flex-wrap:wrap" },
      h("div", { style: "font-size:40px" }, "🏆"), h("div", { style: "flex:1;min-width:200px" }, h("h2", { style: "margin:0" }, "Test de fin de leçon"), h("div", { class: "muted" }, l.quiz.length + " questions · réussi à partir de " + Math.ceil(l.quiz.length * PASS) + " bonnes réponses · tu peux le refaire autant de fois que tu veux")),
      best ? h("span", { class: "chip " + (best.score / best.total >= PASS ? "v" : "c"), style: "font-size:14px" }, "Ton meilleur score : " + best.score + "/" + best.total) : null);
    add(el, intro);
    const qs = l.quiz.map((q, i) => {
      const opts = q.type === "tf" ? ["Vrai", "Faux"] : q.opts;
      const box = h("div", { class: "qz" }, h("div", { class: "qq" }, (i + 1) + ". " + (q.type === "tf" ? "Vrai ou faux ? " : "") + q.q));
      const os = opts.map((o, k) => { const d = h("div", { class: "opt" }, h("b", { style: "color:var(--goldd)" }, String.fromCharCode(65 + k)), o); d.onclick = () => { if (box.dataset.done) return; answers[i] = k; os.forEach(x => x.classList.remove("sel")); d.classList.add("sel"); }; return d; });
      box.append(...os); add(el, box); return { box, os, q };
    });
    const btn = h("button", { class: "btn gold", style: "margin-top:10px" }, "Voir mon résultat");
    const res = h("div");
    btn.onclick = async () => {
      if (Object.keys(answers).length < l.quiz.length) { toast("Réponds à toutes les questions 😉"); return; }
      let score = 0; const detail = [];
      qs.forEach(({ box, os, q }, i) => { const good = q.type === "tf" ? (q.a ? 0 : 1) : q.a; const ok = answers[i] === good; if (ok) score++; detail.push(answers[i]);
        box.dataset.done = 1; os[good].classList.add("good"); if (!ok) os[answers[i]].classList.add("wrong");
        if (q.why) box.append(h("div", { class: "why" }, "✓ " + q.why)); });
      if (!preview) await API.addQuiz(student.id, l.n, score, l.quiz.length, detail);
      const passed = score / l.quiz.length >= PASS;
      fill(res, h("div", { class: "score", style: "margin-top:18px" }, h("b", null, score + " / " + l.quiz.length), h("h2", null, passed ? (score === l.quiz.length ? "Parfait ! Bravo 🎉" : "Test réussi, bravo ! 🎉") : "Presque ! Relis le résumé et réessaie 💪"),
        h("p", { style: "color:#E4DAF2" }, passed ? l.wb.go : "Les bonnes réponses sont en vert ci-dessus."),
        h("div", { class: "row", style: "justify-content:center;margin-top:12px" }, h("button", { class: "btn gold", onclick: () => route() }, "Refaire le test"), h("a", { class: "btn ghost", style: "color:#fff;box-shadow:inset 0 0 0 2px rgba(255,255,255,.4)", href: "#/" }, "Retour à mon parcours"))));
      btn.remove(); if (passed) confetti(); res.scrollIntoView({ behavior: "smooth" });
    };
    add(el, btn, res);
  }

  // ---------- mes questions (dans une leçon) ----------
  function renderMyQuestions(el, l, msgs) {
    const keys = [...new Set(msgs.map(m => m.item_key))];
    add(el, h("div", { style: "margin-top:14px" }, keys.length ? keys.map(k => { const th = msgs.filter(m => m.item_key === k), last = th[th.length - 1], un = th.filter(m => !m.read_by_student).length;
      return h("div", { class: "inbox" }, h("a", { href: "javascript:void 0", onclick: () => openThread(S.me, l, k, itemTitle(l, k), false) }, h("div", { class: "avatar" }, k), h("div", { style: "flex:1" }, h("b", null, itemTitle(l, k)), h("div", { class: "muted", style: "font-size:14px" }, U(last.body.slice(0, 90)))), un ? h("span", { class: "chip g" }, un + " nouveau" + (un > 1 ? "x" : "")) : null)); })
      : h("div", { class: "empty" }, "Tu n'as pas encore posé de question sur cette leçon.", h("br"), "Dans « Mon cahier », clique sur « Poser une question au mentor » sous n'importe quelle question.")));
  }
  function itemTitle(l, k) {
    if (k === "V") return "Mon verset (" + l.wb.ref + ")";
    if (k === "D") return "Mon défi de la semaine"; if (k === "E") return "Mon journal"; if (k === "Z") return "Mon bilan";
    const n = +k.slice(1) - 1;
    if (k[0] === "A") return "Question A" + (n + 1) + " : " + (l.wb.q[n] || "");
    if (k[0] === "B") return "Vrai/faux " + (n + 1) + " : " + (l.wb.vf[n] || "");
    if (k[0] === "C") return "Exercice " + (n + 1) + " : " + ((l.wb.ex[n] || {}).q || "");
    return k;
  }

  // ---------- toutes mes questions (élève) ----------
  async function viewStudentQuestions() {
    const msgs = await API.listMessages([S.me.id]); const unread = msgs.filter(m => !m.read_by_student).length;
    const groups = {}; msgs.forEach(m => { (groups[m.lesson + "|" + m.item_key] = groups[m.lesson + "|" + m.item_key] || []).push(m); });
    const arr = Object.entries(groups).sort((a, b) => b[1][b[1].length - 1].created_at.localeCompare(a[1][a[1].length - 1].created_at));
    shell("#/questions", unread, h("div", { class: "wrap page" }, h("h1", null, "Mes questions"), h("p", { class: "muted" }, "Toutes tes conversations avec ton mentor, question par question."),
      arr.length ? h("div", { class: "inbox" }, arr.map(([k, th]) => { const [n, key] = k.split("|"), l = L[n], last = th[th.length - 1], un = th.filter(m => !m.read_by_student).length;
        return h("a", { href: "javascript:void 0", onclick: () => openThread(S.me, l, key, itemTitle(l, key), false) }, h("div", { class: "avatar" }, n), h("div", { style: "flex:1;min-width:0" }, h("b", null, "Leçon " + n + " · " + itemTitle(l, key).slice(0, 80)), h("div", { class: "muted", style: "font-size:14px" }, (last.author_id === S.me.id ? "Moi : " : "Mentor : ") + U(last.body.slice(0, 90)))), un ? h("span", { class: "chip g" }, "Nouvelle réponse") : null); }))
        : h("div", { class: "empty card" }, "Aucune question pour l'instant. Pendant que tu remplis ton cahier, clique sur « Poser une question au mentor » sous une question.")));
  }

  // =============================== STATISTIQUES ===============================
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const monthLabel = (m, short) => { const [y, mo] = m.split("-").map(Number); return short ? ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][mo - 1] : MOIS[mo - 1] + " " + y; };
  const shiftMonth = (m, d) => { const [y, mo] = m.split("-").map(Number); const t = new Date(Date.UTC(y, mo - 1 + d, 1)); return t.toISOString().slice(0, 7); };
  function barChart(title, unit, data, key, sel, fmtv) {
    const vals = data.map(d => d[key] == null ? 0 : d[key]), max = Math.max(1, ...vals);
    return h("div", { class: "chart" }, h("div", { class: "ch-t" }, title),
      h("div", { class: "bars", role: "img", "aria-label": title + " : " + data.map(d => monthLabel(d.month) + " " + (d[key] == null ? "aucune donnée" : fmtv(d[key]))).join(", ") },
        data.map((d, i) => { const v = d[key], on = d.month === sel;
          return h("div", { class: "bcolw" + (on ? " on" : ""), tabindex: 0 },
            h("div", { class: "tip" }, monthLabel(d.month), h("b", null, v == null ? "—" : fmtv(v) + (unit ? " " + unit : ""))),
            h("span", { class: "bv" }, on || vals[i] === max && v ? (v == null ? "—" : fmtv(v)) : ""),
            h("div", { class: "bar", style: "height:" + (v ? Math.max(4, Math.round(100 * vals[i] / max)) : 0) + "%" }),
            h("small", null, monthLabel(d.month, true))); })));
  }
  async function viewStats(month, classId) {
    if (!isStaff()) return go("#/");
    month = month || new Date().toISOString().slice(0, 7);
    const [st, classes, unread] = await Promise.all([API.stats(month, classId), API.listClasses(), unreadCount()]);
    const mine = classes.filter(isMyClass);
    const goTo = (m, c) => go("#/stats/" + m + (c ? "/" + c : ""));
    const cls = h("select", { class: "in" }, h("option", { value: "" }, "Toutes " + (S.me.role === "superadmin" ? "les classes" : "mes classes")), mine.map(c => h("option", { value: c.id }, c.name))); cls.value = classId || ""; cls.onchange = () => goTo(month, cls.value);
    const pct = (v) => v == null ? "—" : v + " %";
    const tile = (v, lab, sub, tone) => h("div", { class: "kpi" + (tone ? " " + tone : "") }, h("b", null, v), h("span", null, lab), sub ? h("small", null, sub) : null);
    let sortK = "sent", rows = st.per.slice();
    const tbl = h("div");
    const drawT = () => { rows.sort((a, b) => (b[sortK] || 0) - (a[sortK] || 0) || a.name.localeCompare(b.name));
      fill(tbl, rows.length ? labelize(h("table", { class: "t" }, h("tr", null, [["name", "Élève"], ["class_name", "Classe"], ["active_days", "Jours actifs"], ["sent", "Cahiers envoyés"], ["validated", "Leçons validées"], ["tests", "Tests"], ["test_avg", "Moyenne"]].map(([k, t]) => h("th", { class: "sortable" + (sortK === k ? " on" : ""), onclick: () => { if (k !== "name" && k !== "class_name") { sortK = k; drawT(); } } }, t))),
        rows.map(r => h("tr", null, h("td", null, h("a", { href: "#/eleve/" + r.id, style: "font-weight:700;text-decoration:none" }, r.name)), h("td", null, r.class_name || "—"), h("td", null, r.active_days), h("td", null, r.sent), h("td", null, r.validated), h("td", null, r.tests), h("td", null, pct(r.test_avg)))))) : h("p", { class: "muted" }, "Aucun élève.")); };
    drawT();
    const csv = () => { const lines = [["Élève", "Classe", "Jours actifs", "Cahiers envoyés", "Leçons validées", "Tests", "Moyenne (%)"], ...st.per.map(r => [r.name, r.class_name, r.active_days, r.sent, r.validated, r.tests, r.test_avg == null ? "" : r.test_avg])];
      const a = h("a", { href: URL.createObjectURL(new Blob(["﻿" + lines.map(l => l.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(";")).join("\r\n")], { type: "text/csv" })), download: "statistiques-" + month + ".csv" }); document.body.append(a); a.click(); setTimeout(() => a.remove(), 500); };
    const cur = new Date().toISOString().slice(0, 7);
    shell(S.me.role === "superadmin" ? "#/admin" : "#/mentor", unread, h("div", { class: "wrap page" },
      h("div", { class: "row", style: "align-items:flex-end" }, h("h1", { style: "margin:0;flex:1" }, "Statistiques"), h("button", { class: "btn ghost sm", onclick: csv }, ic("dl"), "Exporter (Excel)")),
      h("div", { class: "statbar" }, h("div", { class: "mnav" }, h("button", { class: "btn ghost sm", "aria-label": "Mois précédent", onclick: () => goTo(shiftMonth(month, -1), classId) }, "‹"), h("b", null, monthLabel(month)), h("button", { class: "btn ghost sm", "aria-label": "Mois suivant", disabled: month >= cur, onclick: () => goTo(shiftMonth(month, 1), classId) }, "›")), cls),
      h("div", { class: "kpis" },
        tile(st.active + " / " + st.students, "Élèves actifs", st.students ? Math.round(100 * st.active / st.students) + " % de connectés ce mois" : null, "hero"),
        tile(st.sent, "Cahiers envoyés", st.senders + " élève" + (st.senders > 1 ? "s" : "")),
        tile(st.validated, "Leçons validées"),
        tile(pct(st.test_avg), "Moyenne aux tests", st.tests ? st.tests + " tentative" + (st.tests > 1 ? "s" : "") + " · " + pct(st.test_pass) + " réussies" : "aucun test ce mois"),
        tile(st.questions, "Questions au mentor"), tile(st.posts, "Messages communauté"), tile(st.new_students, "Nouveaux élèves"), tile(st.certificates, "Certificats délivrés")),
      h("div", { class: "charts" },
        barChart("Élèves actifs par mois", "élèves", st.trend, "active", month, (v) => v),
        barChart("Cahiers envoyés par mois", "cahiers", st.trend, "sent", month, (v) => v),
        barChart("Moyenne aux tests", "", st.trend, "test_avg", month, (v) => v + " %")),
      st.classes.length > 1 || !classId ? h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "Par classe · " + monthLabel(month)), labelize(h("table", { class: "t" }, h("tr", null, ["Classe", "Élèves", "Actifs", "Cahiers envoyés", "Leçons validées", "Moyenne tests"].map(t => h("th", null, t))),
        st.classes.map(c => h("tr", null, h("td", null, h("a", { href: "#/stats/" + month + "/" + c.id, style: "font-weight:700;text-decoration:none" }, c.name)), h("td", null, c.students), h("td", null, c.active), h("td", null, c.sent), h("td", null, c.validated), h("td", null, pct(c.test_avg))))))) : null,
      h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "Par élève · " + monthLabel(month)), h("p", { class: "muted", style: "margin-top:-4px;font-size:13px" }, "Touchez un titre de colonne pour trier."), h("div", { class: "scroll" }, tbl))));
  }

  // =============================== CERTIFICATS ===============================
  const certUrl = (sid, phase, dl) => "/api/certificate.pdf?sid=" + sid + "&phase=" + phase + (dl ? "&dl=1" : "");
  function certBlock(c, sid) {
    if (c.eligible) return h("div", { class: "certok" }, h("div", { class: "seal" }, "🎓"), h("div", { style: "flex:1;min-width:0" }, h("b", null, "Phase " + c.phase + " achevée !"), h("small", null, "Ton certificat · code " + (c.code || "créé au téléchargement"))),
      h("a", { class: "btn gold sm", href: certUrl(sid, c.phase, true), download: true }, ic("dl"), "Certificat (PDF)"));
    return h("div", { class: "certwait" }, h("span", null, "🎓 Certificat de la phase " + c.phase), h("div", { class: "cprog" }, h("i", { style: "width:" + Math.round(100 * c.validated / c.total) + "%" })), h("small", null, c.validated + " / " + c.total + " leçons validées par ton mentor"));
  }
  async function viewVerify(code) {
    let r = null, err = null; try { r = await API.verify(code); } catch (e) { err = e.message; }
    fill(app, h("div", { class: "verify" }, h("img", { src: "img/logo.png", alt: "The Divine Arsenal Corporation" }),
      r ? h("div", { class: "card vok" }, h("div", { class: "seal big" }, "✓"), h("h1", null, "Certificat authentique"), h("p", null, "Délivré à ", h("b", null, r.name)), h("p", null, "Phase " + r.phase + " · " + r.title), h("p", { class: "muted" }, "Le " + new Date(r.issued_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) + " · code " + r.code))
        : h("div", { class: "card vbad" }, h("h1", null, "Certificat introuvable"), h("p", null, err || "Ce code ne correspond à aucun certificat.")),
      h("p", { class: "muted", style: "margin-top:16px" }, "The Divine Arsenal Corporation · École de disciples"), h("a", { class: "btn ghost sm", href: "#/" }, "Aller à l'application")));
  }

  // =============================== WHATSAPP ===============================
  const waNum = (p) => String(p || "").replace(/[^\d]/g, "");
  const waLink = (phone, text) => "https://wa.me/" + (phone ? waNum(phone) : "") + "?text=" + encodeURIComponent(text);
  async function viewWhatsApp(classId) {
    if (!isStaff()) return go("#/");
    const [classes, unread] = await Promise.all([API.listClasses(), unreadCount()]);
    const mine = classes.filter(isMyClass);
    if (!classId && mine.length) classId = mine[0].id;
    const d = await API.whatsapp(classId);
    const c = classes.find(x => x.id === classId);
    const cls = h("select", { class: "in" }, mine.map(x => h("option", { value: x.id }, x.name))); cls.value = classId || ""; cls.onchange = () => go("#/whatsapp/" + cls.value);
    const pendingN = d.students.filter(s => s.pending.length).length, me1 = (S.me.full_name || S.me.username);
    const kind = { cours: "🎓", priere: "🙏", bible: "📖", culte: "⛪", autre: "📌" };
    const group = ["📖 *École de disciples" + (c ? " · " + c.name : "") + "*", "_The Divine Arsenal Corporation_", "",
      d.recent.length ? ["🔓 *Ouvert cette semaine*", ...d.recent.map(r => "• Leçon " + r.lesson + " · " + r.title), ""] : null,
      d.events.length ? ["📅 *Prochains rendez-vous*", ...d.events.map(e => "• " + e.when.charAt(0).toUpperCase() + e.when.slice(1) + " · " + (kind[e.kind] || "📌") + " " + e.title + (e.link ? "\n   🎥 " + e.link : "")), ""] : null,
      pendingN ? ["📝 *Cahiers* : " + pendingN + " disciple" + (pendingN > 1 ? "s ont" : " a") + " encore un cahier à terminer. Courage, une question à la fois ! 💪", ""] : ["📝 Tous les cahiers ouverts sont envoyés : bravo à tous ! 🎉", ""],
      "📲 Ouvre l'application : " + location.origin, "🔔 Installe-la et touche « Activer » pour recevoir les rappels.", "", "Que Dieu vous bénisse ! — " + me1].flat().filter(x => x != null).join("\n");
    const ta = h("textarea", { class: "in watext", rows: 12 }); ta.value = group;
    const personal = (s) => { const first = s.name.split(" ")[0]; const ev = d.events[0];
      return ["Shalom " + first + " ! 👋", "", "Petit point de ton école de disciples :",
        s.pending.length ? "📝 À terminer : " + s.pending.map(x => "leçon " + x.lesson + (x.pct ? " (" + x.pct + " %)" : " (pas commencée)")).join(", ") : "✅ Tous tes cahiers ouverts sont envoyés, bravo !",
        ev ? "📅 Prochain rendez-vous : " + ev.when + " · " + ev.title + (ev.link ? "\n🎥 " + ev.link : "") : null, "",
        "👉 Ouvre l'application : " + location.origin, !s.push ? "💡 Astuce : installe-la sur ton téléphone et touche « Activer » pour recevoir les rappels directement." : null, "", "Que Dieu te bénisse ! — " + me1].filter(x => x != null).join("\n"); };
    let showAll = false;
    const list = h("div", { class: "walist" });
    const drawL = () => { const ss = d.students.filter(s => showAll || !s.push);
      fill(list, ss.length ? ss.map(s => { const ph = h("input", { class: "in", type: "tel", placeholder: "+234 801 234 5678", value: s.phone });
        return h("div", { class: "warow" }, h("div", { class: "ravatar dm", style: "background:" + nameColor(s.id) }, initials(s.name)),
          h("div", { class: "wamid" }, h("b", null, s.name), h("small", null, (s.push ? "🔔 Notifications activées" : "📵 Pas de notifications") + " · " + (s.last_seen ? "vu le " + new Date(s.last_seen).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "jamais connecté") + (s.pending.length ? " · " + s.pending.length + " cahier" + (s.pending.length > 1 ? "s" : "") + " à finir" : "")),
            s.phone ? null : h("div", { class: "row", style: "margin-top:6px;flex-wrap:nowrap" }, ph, h("button", { class: "btn ghost sm", onclick: async () => { try { const u = await API.updateUser(s.id, { phone: ph.value }); if (!u.phone) throw new Error("Numéro trop court (format international, ex. +234…)"); s.phone = u.phone; toast("Numéro enregistré ✓"); drawL(); } catch (e) { toast(e.message); } } }, "OK"))),
          s.phone ? h("a", { class: "btn wa sm", href: waLink(s.phone, personal(s)), target: "_blank", rel: "noopener" }, "WhatsApp") : null); })
        : h("div", { class: "empty" }, "🎉 Tous les élèves de cette classe reçoivent les notifications de l'application.")); };
    drawL();
    const toggle = h("button", { class: "tg" }, "Afficher aussi les élèves avec notifications"); toggle.onclick = () => { showAll = !showAll; toggle.classList.toggle("on", showAll); drawL(); };
    shell(S.me.role === "superadmin" ? "#/admin" : "#/mentor", unread, h("div", { class: "wrap page", style: "max-width:760px" },
      h("div", { class: "chero wahero" }, h("div", null, h("div", { class: "k" }, "WHATSAPP"), h("h1", null, "Résumé pour WhatsApp"), h("p", null, "Pour les disciples qui n'ont pas installé l'application ou pas activé les notifications : envoyez le point de la semaine dans le groupe de la classe, ou un message personnel."))),
      mine.length ? h("div", { class: "card", style: "margin-top:16px" }, h("label", { class: "f", style: "margin-top:0" }, "Classe"), cls) : h("div", { class: "note", style: "margin-top:16px" }, "Aucune classe."),
      h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "1. Message pour le groupe WhatsApp de la classe"), h("p", { class: "muted", style: "margin-top:-4px;font-size:13.5px" }, "Préparé automatiquement (leçons ouvertes, rendez-vous, cahiers). Vous pouvez le modifier."), ta,
        h("div", { class: "row", style: "margin-top:10px" }, h("a", { class: "btn wa", href: "#", onclick: (e) => { e.preventDefault(); open(waLink("", ta.value), "_blank"); } }, "Envoyer sur WhatsApp"), h("button", { class: "btn ghost", onclick: async () => { try { await navigator.clipboard.writeText(ta.value); toast("Message copié ✓"); } catch (e) { ta.select(); toast("Sélectionné : copiez-le"); } } }, "📋 Copier"))),
      h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "2. Messages personnels"), h("p", { class: "muted", style: "margin-top:-4px;font-size:13.5px" }, "Élèves sans notifications sur leur téléphone. Le message contient ses cahiers à terminer et le prochain rendez-vous."), toggle, list)));
  }

  // =============================== AGENDA ===============================
  const KINDS = { cours: ["🎓", "Cours en ligne"], priere: ["🙏", "Prière"], bible: ["📖", "Étude biblique"], culte: ["⛪", "Culte"], autre: ["📌", "Rendez-vous"] };
  const kindOf = (k) => KINDS[k] || KINDS.autre;
  const isLive = (o) => { const t = Date.now(); return t >= Date.parse(o.at) - 15 * 60e3 && t <= Date.parse(o.ends); };
  const isNow = (o) => { const t = Date.now(); return t >= Date.parse(o.at) && t <= Date.parse(o.ends); };
  function icsFor(o) {
    const z = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const esc = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => "\\" + m);
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Divine Arsenal Corporation//Ecole de disciples//FR", "BEGIN:VEVENT", "UID:" + o.id + "@ecole-de-disciples", "DTSTAMP:" + z(Date.now()),
      "DTSTART:" + z(o.recur === "none" ? o.at : o.starts_at), "DTEND:" + z(Date.parse(o.recur === "none" ? o.at : o.starts_at) + o.duration * 60e3),
      o.recur !== "none" ? "RRULE:FREQ=" + (o.recur === "daily" ? "DAILY" : "WEEKLY") + (o.until ? ";UNTIL=" + o.until.replace(/-/g, "") + "T235959Z" : "") : null,
      "SUMMARY:" + esc(o.title), "DESCRIPTION:" + esc(kindOf(o.kind)[1] + (o.description ? "\n" + o.description : "") + (o.link ? "\n" + o.link : "")), o.link ? "URL:" + o.link : null, o.link ? "LOCATION:" + esc(o.link) : null,
      "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:" + esc(o.title), "END:VALARM", "END:VEVENT", "END:VCALENDAR"].filter(Boolean);
    const a = h("a", { href: URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" })), download: (o.title.replace(/[^\w\- ]+/g, "").trim() || "rendez-vous") + ".ics" });
    document.body.append(a); a.click(); setTimeout(() => a.remove(), 500);
  }
  const hm = (d) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  function eventItem(o, opts = {}) {
    const [emo, lab] = kindOf(o.kind), live = isLive(o), now = isNow(o);
    return h("div", { class: "evt k-" + o.kind + (now ? " now" : "") },
      h("div", { class: "evt-t" }, h("b", null, hm(o.at)), h("small", null, o.duration >= 60 ? Math.floor(o.duration / 60) + " h" + (o.duration % 60 ? String(o.duration % 60).padStart(2, "0") : "") : o.duration + " min")),
      h("div", { class: "evt-m" }, h("div", { class: "evt-k" }, emo + " " + lab, now ? h("span", { class: "livechip" }, "● EN DIRECT") : null),
        h("b", null, U(o.title)), h("small", null, (o.class_name ? "👥 " + o.class_name : "🌍 Toute l'école") + (o.recur === "weekly" ? " · chaque semaine" : o.recur === "daily" ? " · chaque jour" : "")),
        o.description && !opts.compact ? h("p", null, U(o.description)) : null,
        h("div", { class: "evt-a" },
          o.link ? h("a", { class: "btn sm " + (live ? "gold pulse" : "ghost"), href: o.link, target: "_blank", rel: "noopener" }, live ? "🎥 Rejoindre maintenant" : "🎥 Lien de la réunion") : null,
          h("button", { class: "btn ghost sm", onclick: () => icsFor(o) }, "📅 Ajouter à mon agenda"),
          o.can_edit && !opts.compact ? h("button", { class: "btn ghost sm", onclick: () => eventForm(o) }, "Modifier") : null)));
  }
  async function agendaCard() {
    let occ = []; try { occ = await API.events(new Date(Date.now() - 3 * 3600e3).toISOString(), new Date(Date.now() + 14 * 864e5).toISOString()); } catch (e) { return null; }
    occ = occ.filter(o => Date.parse(o.ends) >= Date.now()).slice(0, 3);
    if (!occ.length && S.me.role === "student") return null;
    return h("div", { class: "card agcard" }, h("div", { class: "row", style: "margin-bottom:6px" }, h("h3", { style: "margin:0;flex:1" }, "📅 Prochains rendez-vous"), h("a", { href: "#/agenda", class: "muted", style: "font-weight:700;font-size:14px" }, "Tout voir →")),
      occ.length ? occ.map(o => [h("div", { class: "agday" }, dayLabel(o.at)), eventItem(o, { compact: true })]) : h("p", { class: "muted", style: "margin:0" }, "Aucun rendez-vous programmé. ", h("a", { href: "#/agenda" }, "Programmer un cours ou un temps de prière →")));
  }
  async function pendingCard() {
    let pend = []; try { pend = await API.myPending(); } catch (e) { return null; }
    if (!pend.length) return null;
    return h("div", { class: "card pendcard" }, h("h3", null, "📝 À terminer (" + pend.length + ")"), h("p", { class: "muted", style: "margin:-4px 0 8px;font-size:14px" }, "Ces cahiers sont ouverts mais pas encore envoyés à ton mentor."),
      pend.slice(0, 5).map(x => h("a", { class: "pend", href: "#/lecon/" + x.lesson + "/cahier" }, h("div", { style: "flex:1;min-width:0" }, h("b", null, "Leçon " + x.lesson + " · " + x.title), h("div", { class: "cprog" }, h("i", { style: "width:" + Math.max(3, x.pct) + "%" })), h("small", null, x.pct ? "Rempli à " + x.pct + " %" : "Pas encore commencé")), h("span", { class: "btn gold sm" }, x.pct ? "Continuer" : "Commencer"))));
  }
  async function lateCard() {
    let late = []; try { late = await API.classPending(); } catch (e) { return null; }
    if (!late.length) return null;
    return h("details", { class: "card latecard" }, h("summary", null, h("b", null, "⏳ Cahiers pas encore envoyés · " + late.length + " élève" + (late.length > 1 ? "s" : "")), h("span", { class: "muted" }, " (touchez pour voir)")),
      h("p", { class: "muted", style: "font-size:13.5px" }, "Des rappels automatiques partent selon les réglages (Administration → Rappels). Vous pouvez aussi relancer un élève vous-même."),
      late.map(s => h("div", { class: "late" }, h("div", { style: "flex:1;min-width:0" }, h("a", { href: "#/eleve/" + s.id }, h("b", null, s.name)), h("small", null, s.pending.map(x => x.lesson + " (" + x.pct + " %)").join(" · "))),
        h("button", { class: "btn ghost sm", onclick: async (e) => { try { await API.nudge(s.id); e.target.textContent = "Relancé"; e.target.disabled = true; } catch (x) { toast(x.message); } } }, "🔔 Relancer"))));
  }
  async function viewAgenda() {
    const unread = await unreadCount();
    const from = new Date(Date.now() - 3 * 3600e3), to = new Date(Date.now() + 45 * 864e5);
    const occ = (await API.events(from.toISOString(), to.toISOString())).filter(o => Date.parse(o.ends) >= Date.now());
    const groups = {}; occ.forEach(o => { const d = dayLabel(o.at); (groups[d] = groups[d] || []).push(o); });
    const canCreate = isStaff();
    shell("#/agenda", unread, h("div", { class: "wrap page", style: "max-width:760px" },
      h("div", { class: "chero aghero" }, h("div", null, h("div", { class: "k" }, "AGENDA"), h("h1", null, "Nos rendez-vous"), h("p", null, "Cours en ligne, prière, étude biblique : tu reçois un rappel sur ton téléphone avant chaque rendez-vous."))),
      canCreate ? h("button", { class: "btn gold", style: "width:100%;margin:14px 0 0", onclick: () => eventForm(null) }, "+ Programmer un rendez-vous") : null,
      occ.length ? Object.entries(groups).map(([d, os]) => [h("div", { class: "nday" }, d), h("div", { class: "evlist" }, os.map(o => eventItem(o)))])
        : h("div", { class: "empty card", style: "margin-top:16px" }, "📅", h("br"), "Aucun rendez-vous pour le moment.", canCreate ? [h("br"), "Programmez le premier cours en ligne ou temps de prière."] : null)));
  }
  async function eventForm(o) {
    const [classes, st] = await Promise.all([API.listClasses(), API.settings().catch(() => ({}))]);
    const mine = classes.filter(isMyClass);
    const pad = (n) => String(n).padStart(2, "0");
    const base = o ? new Date(o.starts_at) : (() => { const d = new Date(Date.now() + 864e5); d.setHours(19, 0, 0, 0); return d; })();
    const title = h("input", { class: "in", placeholder: "ex. Cours · Leçon 1-5, Prière du mercredi…", value: o ? o.title : "" });
    const kind = h("select", { class: "in" }, Object.entries(KINDS).map(([k, [e, t]]) => h("option", { value: k }, e + " " + t))); kind.value = o ? o.kind : "cours";
    const users = await API.listUsers().catch(() => []);
    const cls = { value: o ? (o.class_id || "") : (S.me.role === "superadmin" ? "" : (mine[0] || {}).id || "") };
    const whoBox = h("div", { class: "whobox" });
    const drawWho = () => fill(whoBox, [
      S.me.role === "superadmin" ? { id: "", t: "Toute l'école", d: "Tous les élèves et tous les mentors", icon: "globe" } : null,
      ...mine.map(c => { const n = users.filter(u => u.role === "student" && u.class_id === c.id).length, m = users.find(u => u.id === c.mentor_id); return { id: c.id, t: c.name, d: n + " élève" + (n > 1 ? "s" : "") + (m ? " · mentor : " + (m.full_name || m.username) : ""), icon: "people" }; })
    ].filter(Boolean).map(x => h("button", { type: "button", class: "who" + (cls.value === x.id ? " on" : ""), onclick: () => { cls.value = x.id; drawWho(); } },
      h("span", { class: "who-i", html: V[x.icon] }), h("span", { class: "who-m" }, h("b", null, x.t), h("small", null, x.d)), h("span", { class: "who-r", html: cls.value === x.id ? V.check : "" }))));
    drawWho();
    const noClass = !mine.length && S.me.role !== "superadmin";
    const date = h("input", { class: "in", type: "date", value: base.getFullYear() + "-" + pad(base.getMonth() + 1) + "-" + pad(base.getDate()) });
    const time = h("input", { class: "in", type: "time", value: pad(base.getHours()) + ":" + pad(base.getMinutes()) });
    const dur = h("select", { class: "in" }, [[30, "30 min"], [45, "45 min"], [60, "1 h"], [90, "1 h 30"], [120, "2 h"], [180, "3 h"]].map(([v, t]) => h("option", { value: v }, t))); dur.value = String(o ? o.duration : 90);
    const recur = h("select", { class: "in" }, [["none", "Une seule fois"], ["weekly", "Chaque semaine (même jour, même heure)"], ["daily", "Chaque jour"]].map(([v, t]) => h("option", { value: v }, t))); recur.value = o ? o.recur : "none";
    const until = h("input", { class: "in", type: "date", value: o && o.until ? o.until : "" });
    const untilWrap = h("div", { class: o && o.recur !== "none" ? null : "hide" }, h("label", { class: "f" }, "Jusqu'au (facultatif)"), until);
    recur.onchange = () => untilWrap.classList.toggle("hide", recur.value === "none");
    const link = h("input", { class: "in", type: "url", placeholder: "https://meet.google.com/…", value: o ? o.link : (st.meet_link || "") });
    const desc = h("textarea", { class: "in", rows: 2, placeholder: "Ce qu'il faut préparer (facultatif)" }); desc.value = o ? o.description : "";
    const rem = o ? o.remind : [1440, 15];
    const remBox = h("div", { class: "toggles" }, [[1440, "La veille"], [60, "1 h avant"], [15, "15 min avant"], [0, "À l'heure"]].map(([v, t]) => { const b = h("button", { type: "button", class: "tg" + (rem.includes(v) ? " on" : ""), "data-v": v }, t); b.onclick = () => b.classList.toggle("on"); return b; }));
    const err = h("div", { class: "err hide" });
    modal(o ? "Modifier le rendez-vous" : "Nouveau rendez-vous", [h("label", { class: "f" }, "Titre"), title, h("label", { class: "f" }, "Type"), kind, h("label", { class: "f" }, "Pour qui ?"), noClass ? h("div", { class: "note" }, "Aucune classe ne vous est confiée. Demandez au superadmin de vous attribuer une classe (Administration → Classes).") : whoBox,
      h("div", { class: "two" }, h("div", null, h("label", { class: "f" }, "Date"), date), h("div", null, h("label", { class: "f" }, "Heure"), time)),
      h("label", { class: "f" }, "Durée"), dur, h("label", { class: "f" }, "Répétition"), recur, untilWrap,
      h("label", { class: "f" }, "Lien de la réunion (Google Meet)"), link, h("label", { class: "f" }, "Description"), desc,
      h("label", { class: "f" }, "🔔 Rappels envoyés sur les téléphones"), remBox, err],
      (m) => [o ? h("button", { class: "btn bad", onclick: async () => { if (!await ask("Supprimer ce rendez-vous ?", h("p", null, o.recur !== "none" ? "Toutes les dates de cette série seront supprimées." : "Il disparaîtra de l'agenda de tous."), "Supprimer", true)) return; await API.deleteEvent(o.id); m.remove(); toast("Rendez-vous supprimé"); route(); } }, "Supprimer") : null,
        h("button", { class: "btn ghost", onclick: () => m.remove() }, "Annuler"),
        h("button", { class: "btn gold", onclick: async () => {
          try { const start = new Date(date.value + "T" + (time.value || "00:00")); if (isNaN(start)) throw new Error("Date ou heure invalide");
            if (noClass) throw new Error("Aucune classe ne vous est confiée");
            await API.saveEvent({ id: o ? o.id : undefined, title: title.value, kind: kind.value, class_id: cls.value || null, starts_at: start.toISOString(), duration: +dur.value, recur: recur.value, until: until.value || null, link: link.value, description: desc.value, remind: [...remBox.querySelectorAll(".tg.on")].map(b => +b.dataset.v) });
            m.remove(); toast(o ? "Rendez-vous modifié ✓" : "Rendez-vous programmé ✓ Les participants sont prévenus."); route(); }
          catch (e) { err.textContent = e.message; err.classList.remove("hide"); } } }, o ? "Enregistrer" : "Programmer")]);
  }

  // =============================== NOTIFICATIONS ===============================
  const pushOK = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && API.mode === "server";
  const pushState = () => !pushOK() ? (isIOS() && !standalone() ? "ios-install" : "unsupported") : Notification.permission; // default | granted | denied
  const b64ToU8 = (b) => { const s = atob((b + "=".repeat((4 - b.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, c => c.charCodeAt(0)); };
  async function subscribePush(silent) {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const key = await API.pushKey();
    if (sub && sub.options && sub.options.applicationServerKey) { const cur = btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); if (cur !== key) { await sub.unsubscribe(); sub = null; } }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) });
    await API.pushSubscribe(sub.toJSON());
    if (!silent) await API.pushTest();
  }
  async function enablePush() {
    const st = pushState();
    if (st === "ios-install") return modal("Notifications sur iPhone", h("div", { class: "steps" }, h("p", null, "Sur iPhone, les notifications marchent quand l'application est installée :"), h("ol", null, h("li", null, "Dans Safari, touchez ", h("b", null, "Partager"), " ↑ puis ", h("b", null, "« Sur l'écran d'accueil »"), "."), h("li", null, "Ouvrez l'application depuis son icône."), h("li", null, "Revenez ici et touchez ", h("b", null, "« Activer les notifications »"), "."))), (m) => [h("button", { class: "btn", onclick: () => m.remove() }, "J'ai compris")]);
    if (st === "unsupported") return toast("Ce navigateur ne gère pas les notifications. Essaie avec Chrome.");
    if (st === "denied") return modal("Notifications bloquées", h("p", null, "Les notifications ont été refusées pour ce site. Pour les réactiver : ouvrez les réglages du navigateur (ou appui long sur l'icône de l'application → Infos), puis ", h("b", null, "Notifications → Autoriser"), "."), (m) => [h("button", { class: "btn", onclick: () => m.remove() }, "OK")]);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast("Notifications non autorisées"); return route(); }
      await subscribePush(false); toast("Notifications activées 🔔"); route();
    } catch (e) { toast("Activation impossible : " + e.message); }
  }
  function pushCard() {
    const st = pushState(); if (st === "granted" || st === "unsupported") return null;
    let x = false; try { x = localStorage.getItem("dac-push-x") === "1"; } catch (e) { } if (x && st !== "ios-install") return null;
    const c = h("div", { class: "installcard pushcard" }, h("div", { class: "pic" }, ic("bell")),
      h("div", { class: "ic-t" }, h("b", null, st === "denied" ? "Notifications bloquées" : "Active les notifications"), h("span", null, "Nouvelles leçons, messages, réponses : sois prévenu.")),
      h("button", { class: "btn gold sm", onclick: enablePush }, "Activer"),
      h("button", { class: "x", "aria-label": "Fermer", onclick: () => { try { localStorage.setItem("dac-push-x", "1"); } catch (e) { } c.remove(); } }, "×"));
    return c;
  }
  const NICON = { certificate: "cap", reminder: "pencil", event: "calendar", dm: "mail", mention: "megaphone", unlock: "unlock", answer: "chat", question: "chat", reply: "reply", reaction: "heart", community: "people", submit: "inbox", review: "check", validated: "star", test: "bell" };
  async function viewNotifications() {
    const [r, unread] = await Promise.all([API.notifications(), unreadCount()]);
    const items = r.items;
    const open = async (n) => { if (!n.read) { await API.notifRead({ ids: [n.id] }).catch(() => { }); } location.hash = n.url || "#/"; };
    const groups = {}; items.forEach(n => { const d = dayLabel(n.created_at); (groups[d] = groups[d] || []).push(n); });
    const st = pushState();
    shell("#/notifications", unread, h("div", { class: "wrap page", style: "max-width:720px" },
      h("div", { class: "row", style: "align-items:flex-end" }, h("h1", { style: "margin:0;flex:1" }, "Notifications"), r.unread ? h("button", { class: "btn ghost sm", onclick: async () => { await API.notifRead({ all: true }); route(); } }, "Tout marquer comme lu") : null),
      h("div", { class: "card pushstate" }, h("div", { class: "pic" + (st === "granted" ? " on" : "") }, ic("bell")),
        h("div", { style: "flex:1;min-width:0" }, h("b", null, st === "granted" ? "Notifications activées sur cet appareil" : "Notifications sur ton téléphone"),
          h("div", { class: "muted", style: "font-size:13.5px" }, st === "granted" ? "Tu es prévenu même quand l'application est fermée." : st === "ios-install" ? "Sur iPhone : installe d'abord l'application." : st === "denied" ? "Elles sont bloquées dans les réglages du navigateur." : st === "unsupported" ? "Ce navigateur ne les gère pas (essaie Chrome)." : "Reçois une alerte pour chaque nouvelle leçon, message ou réponse.")),
        st === "granted" ? h("button", { class: "btn ghost sm", onclick: async () => { await API.pushTest(); toast("Notification de test envoyée"); } }, "Tester") : st !== "unsupported" ? h("button", { class: "btn gold sm", onclick: enablePush }, "Activer") : null),
      items.length ? Object.entries(groups).map(([d, ns]) => [h("div", { class: "nday" }, d), h("div", { class: "nlist" }, ns.map(n => h("button", { class: "nitem" + (n.read ? "" : " unread"), onclick: () => open(n) },
        h("div", { class: "nic", html: V[NICON[n.kind] || "bell"] }), h("div", { class: "nmid" }, h("b", null, n.title), n.body ? h("span", null, U(n.body)) : null, h("small", null, whenShort(n.created_at))), n.read ? null : h("i", { class: "ndot" }))))])
        : h("div", { class: "empty card", style: "margin-top:16px" }, "🔔", h("br"), "Aucune notification pour l'instant.", h("br"), "Tu seras prévenu ici des nouvelles leçons, des messages de ton mentor et des réponses de la communauté.")));
  }

  // =============================== COMMUNAUTÉ ===============================
  S.peers = S.peers || {};
  const isDM = (room) => String(room).startsWith("dm:");
  const dmWith = (uid) => "dm:" + [S.me.id, uid].sort().join(":");
  const dmPeerId = (room) => room.split(":").slice(1).find(x => x !== S.me.id);
  const peerName = (room) => (S.peers[dmPeerId(room)] || {}).name || "Conversation privée";
  const roomTitle = (room) => isDM(room) ? peerName(room) : room === "general" ? "Général · toute l'école" : "Leçon " + room + " · " + ((L[room] || {}).t || "");
  const roomShort = (room) => isDM(room) ? peerName(room) : room === "general" ? "Général" : "Leçon " + room;
  async function members() { if (!S.members) { S.members = await API.communityMembers(); S.members.forEach(m => { S.peers[m.id] = m; }); } return S.members; }
  const roleLabel = (r) => r === "superadmin" ? "Responsable" : r === "admin" ? "Mentor" : "Élève";
  function hhmm(d) { return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); }
  function whenShort(d) {
    const t = new Date(d), n = new Date(), y = new Date(n); y.setDate(n.getDate() - 1);
    if (t.toDateString() === n.toDateString()) return hhmm(d);
    if (t.toDateString() === y.toDateString()) return "Hier";
    return t.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }
  function dayLabel(d) {
    const t = new Date(d), n = new Date(), y = new Date(n); y.setDate(n.getDate() - 1);
    if (t.toDateString() === n.toDateString()) return "Aujourd'hui";
    if (t.toDateString() === y.toDateString()) return "Hier";
    return t.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: t.getFullYear() === n.getFullYear() ? undefined : "numeric" });
  }
  async function accessibleRooms() {
    if (isStaff()) return ["general", ...LESSONS.map(l => l.n)];
    const unl = unlockedFor(S.me, await API.listUnlocks());
    return ["general", ...LESSONS.filter(l => unl.has(l.n)).map(l => l.n)];
  }
  function roomAvatar(room) {
    if (isDM(room)) { const id = dmPeerId(room); return h("div", { class: "ravatar dm", style: "background:" + nameColor(id) }, initials(peerName(room))); }
    const l = L[room];
    return h("div", { class: "ravatar " + (l ? "p" + l.ph : "gen") }, l ? room : "✦");
  }

  async function viewCommunity() {
    const [stats, open, unread] = await Promise.all([API.communityRooms(), accessibleRooms(), unreadCount()]);
    S.cun = stats.unread; S.crooms = stats.rooms;
    stats.rooms.forEach(r => { if (r.peer) S.peers[r.peer.id] = { ...(S.peers[r.peer.id] || {}), ...r.peer }; });
    let tab = "salons"; try { tab = sessionStorage.getItem("dac-ctab") || "salons"; } catch (e) { }
    const dms = stats.rooms.filter(r => isDM(r.room)).sort((a, b) => (b.last ? b.last.created_at : "").localeCompare(a.last ? a.last.created_at : ""));
    const dmUnread = dms.reduce((a, r) => a + r.unread, 0), roomUnread = stats.unread - dmUnread;
    const ctabs = h("div", { class: "tabs ctabs" });
    const salonsBox = h("div"), privBox = h("div");
    const setTab = (t) => { tab = t; try { sessionStorage.setItem("dac-ctab", t); } catch (e) { }
      fill(ctabs, h("button", { class: tab === "salons" ? "on" : null, onclick: () => setTab("salons") }, "Salons", roomUnread ? h("span", { class: "tcount" }, roomUnread) : null), h("button", { class: tab === "prives" ? "on" : null, onclick: () => setTab("prives") }, "Messages privés", dmUnread ? h("span", { class: "tcount" }, dmUnread) : null));
      salonsBox.classList.toggle("hide", tab !== "salons"); privBox.classList.toggle("hide", tab !== "prives"); };
    fill(privBox, h("button", { class: "btn gold newdm", onclick: () => pickPerson("Nouveau message privé", (u) => go("#/communaute/" + dmWith(u.id))) }, "✉️ Nouveau message privé"),
      dms.length ? h("div", { class: "rooms" }, dms.map(x => h("a", { class: "room", href: "#/communaute/" + x.room }, roomAvatar(x.room),
        h("div", { class: "rmid" }, h("div", { class: "rtop" }, h("b", null, x.peer ? x.peer.name : "Conversation"), x.last ? h("span", { class: "rtime" + (x.unread ? " new" : "") }, whenShort(x.last.created_at)) : null),
          h("div", { class: "rbot" }, h("span", { class: "rprev" }, x.last ? [(x.last.mine ? "Moi : " : ""), x.last.image ? "📷 " : "", x.last.image && !x.last.body ? "Photo" : U(x.last.body)] : ""), x.unread ? h("span", { class: "rbadge" }, x.unread) : null)))))
        : h("div", { class: "empty card" }, "✉️", h("br"), "Aucune conversation privée.", h("br"), "Écris directement à un autre disciple ou à ton mentor."));
    const st = Object.fromEntries(stats.rooms.map(r => [r.room, r]));
    let filter = "all", q = "";
    const list = h("div", { class: "rooms" });
    const search = h("input", { class: "in", type: "search", placeholder: "Rechercher une leçon…" });
    const chips = h("div", { class: "fchips" });
    const draw = () => {
      fill(chips, [["all", "Tous"], ["1", "Phase 1"], ["2", "Phase 2"], ["3", "Phase 3"]].map(([k, t]) => h("button", { class: filter === k ? "on" : null, onclick: () => { filter = k; draw(); } }, t)));
      const all = ["general", ...LESSONS.map(l => l.n)].filter(r => (filter === "all" || (L[r] && String(L[r].ph) === filter) || (r === "general" && filter === "all")) && roomTitle(r).toLowerCase().includes(q));
      const isOpen = (r) => open.includes(r);
      const act = all.filter(isOpen).sort((a, b) => { if (a === "general") return -1; if (b === "general") return 1; const la = st[a] && st[a].last ? st[a].last.created_at : "", lb = st[b] && st[b].last ? st[b].last.created_at : ""; if (la !== lb) return lb.localeCompare(la); return LESSONS.findIndex(l => l.n === a) - LESSONS.findIndex(l => l.n === b); });
      const locked = all.filter(r => !isOpen(r));
      const row = (r) => { const x = st[r], lk = !isOpen(r);
        return h(lk ? "button" : "a", lk ? { class: "room locked", type: "button", onclick: () => lessonPreview(L[r]) } : { class: "room", href: "#/communaute/" + r },
          roomAvatar(r),
          h("div", { class: "rmid" }, h("div", { class: "rtop" }, h("b", null, roomTitle(r)), x && x.last ? h("span", { class: "rtime" + (x.unread ? " new" : "") }, whenShort(x.last.created_at)) : null),
            h("div", { class: "rbot" }, h("span", { class: "rprev" }, lk ? "🔒 S'ouvrira quand la leçon sera débloquée" : x && x.last ? [(x.last.mine ? "Moi" : x.last.name.split(" ")[0]) + " : ", x.last.image ? "📷 " : "", x.last.image && !x.last.body ? "Photo" : U(x.last.body)] : r === "general" ? "Le salon de toute l'école : présente-toi !" : "Aucun message. Lance la discussion !"),
              x && x.unread ? h("span", { class: "rbadge" }, x.unread > 99 ? "99+" : x.unread) : null))); };
      fill(list, act.map(row), locked.length ? [h("div", { class: "rsec" }, "🔒 Bientôt (" + locked.length + ")"), locked.map(row)] : null, !act.length && !locked.length ? h("div", { class: "empty" }, "Aucun salon trouvé.") : null);
    };
    search.oninput = () => { q = search.value.toLowerCase(); draw(); };
    draw();
    shell("#/communaute", unread, h("div", { class: "wrap page" },
      h("div", { class: "chero" }, h("div", null, h("div", { class: "k" }, "COMMUNAUTÉ"), h("h1", null, "Grandissons ensemble"), h("p", null, "Un salon par leçon pour échanger avec les autres disciples : questions, découvertes, photos, encouragements. Les échanges restent pour les promotions suivantes."))),
      ctabs, salonsBox, privBox));
    fill(salonsBox, h("div", { class: "csearch" }, search), chips, list);
    setTab(tab);
  }
  // choisir une personne (message privé, mention)
  async function pickPerson(title, onPick) {
    const ms = await members();
    const q = h("input", { class: "in", type: "search", placeholder: "Rechercher un nom…" });
    const list = h("div", { class: "fwdlist plist" });
    const draw = () => { const t = q.value.toLowerCase(); const r = ms.filter(u => (u.name + " " + u.username + " " + (u.class_name || "")).toLowerCase().includes(t)).slice(0, 60);
      fill(list, r.length ? r.map(u => h("button", { onclick: () => { m.remove(); onPick(u); } }, h("div", { class: "ravatar dm", style: "background:" + nameColor(u.id) }, initials(u.name)), h("span", { class: "pmid" }, h("b", null, u.name), h("small", null, roleLabel(u.role) + (u.class_name ? " · " + u.class_name : ""))))) : h("div", { class: "empty" }, "Personne trouvé.")); };
    q.oninput = draw; draw();
    const m = modal(title, h("div", null, q, list), (mm) => [h("button", { class: "btn ghost", onclick: () => mm.remove() }, "Annuler")]);
    if (!matchMedia("(pointer:coarse)").matches) q.focus();
  }
  // fiche d'un membre
  function personSheet(u) {
    if (u.id === S.me.id) return;
    S.peers[u.id] = { ...(S.peers[u.id] || {}), ...u };
    const m = modal(u.name, h("div", { class: "psheet" }, h("div", { class: "ravatar dm big", style: "background:" + nameColor(u.id) }, initials(u.name)), h("div", { class: "muted" }, roleLabel(u.role)),
      h("button", { class: "btn gold", style: "width:100%;margin-top:14px", onclick: () => { m.remove(); go("#/communaute/" + dmWith(u.id)); } }, "✉️ Envoyer un message privé")), () => []);
  }

  // ---------- un salon ----------
  async function viewRoom(room) {
    const open = await accessibleRooms();
    if (isDM(room)) { if (!room.split(":").includes(S.me.id)) { toast("Conversation introuvable"); return go("#/communaute"); } if (!S.peers[dmPeerId(room)]) await members().catch(() => { }); }
    else if (!open.includes(room)) { if (L[room]) lessonPreview(L[room]); else toast("Salon introuvable"); return go("#/communaute"); }
    const unread = await unreadCount();
    const posts = new Map(); const nodes = new Map();
    let rev = 0, more = false, replyTo = null, pendingImg = null, loadingOld = false;
    const stream = h("div", { class: "stream" });
    const intro = h("div", { class: "rintro" }, roomAvatar(room), h("b", null, roomTitle(room)),
      h("p", null, isDM(room) ? "Conversation privée entre toi et " + peerName(room) + ". Vous seuls voyez ces messages." : room === "general" ? "Le salon de toute l'école. Présente-toi, partage un témoignage, encourage les autres." : "Discute de cette leçon avec les autres disciples : ce que tu as compris, tes questions, ce que Dieu t'a montré."),
      isDM(room) ? null : h("p", { class: "muted", style: "font-size:12.5px" }, "📜 Les messages restent : les futurs élèves liront vos échanges. Parle avec respect et bienveillance."),
      L[room] ? h("a", { class: "btn ghost sm", href: "#/lecon/" + room }, ic("book"), "Ouvrir la leçon") : null);
    const olderBtn = h("button", { class: "older hide", onclick: () => loadOlder() }, "Voir les messages plus anciens");
    const replyBar = h("div", { class: "replybar hide" });
    const imgBar = h("div", { class: "imgbar hide" });
    const ta = h("textarea", { class: "in", rows: 1, placeholder: "Écris un message…", maxlength: 4000 });
    const file = h("input", { type: "file", accept: "image/*", class: "hide" });
    const sendBtn = h("button", { class: "sendbtn", "aria-label": "Envoyer", onclick: () => send() }, ic("send"));
    const suggest = h("div", { class: "suggest hide" });
    const picked = new Map(); // nom → id des personnes mentionnées
    const caretWord = () => { const v = ta.value.slice(0, ta.selectionStart); const m = /(^|\s)@([^\s@]{0,30})$/.exec(v); return m ? { q: m[2], start: v.length - m[2].length - 1 } : null; };
    async function updateSuggest() {
      const w = caretWord(); if (!w) return suggest.classList.add("hide");
      const ms = (await members().catch(() => [])).filter(u => (u.name + " " + u.username).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(w.q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))).slice(0, 6);
      if (!ms.length) return suggest.classList.add("hide");
      fill(suggest, ms.map(u => h("button", { type: "button", onmousedown: (e) => e.preventDefault(), onclick: () => {
        const w2 = caretWord(); if (!w2) return; const before = ta.value.slice(0, w2.start), after = ta.value.slice(ta.selectionStart);
        ta.value = before + "@" + u.name + " " + after; picked.set(u.name, u.id); S.peers[u.id] = u;
        const pos = (before + "@" + u.name + " ").length; ta.focus(); ta.setSelectionRange(pos, pos); suggest.classList.add("hide"); } },
        h("div", { class: "ravatar dm", style: "background:" + nameColor(u.id) }, initials(u.name)), h("span", { class: "pmid" }, h("b", null, u.name), h("small", null, roleLabel(u.role) + (u.class_name ? " · " + u.class_name : ""))))));
      suggest.classList.remove("hide");
    }
    ta.addEventListener("input", updateSuggest); ta.addEventListener("click", updateSuggest);
    ta.addEventListener("blur", () => setTimeout(() => suggest.classList.add("hide"), 200));
    const mentionBtn = isDM(room) ? null : h("button", { class: "cambtn atbtn", "aria-label": "Mentionner quelqu'un", onclick: () => { const pos = ta.selectionStart || ta.value.length; const pre = ta.value.slice(0, pos); ta.value = pre + (pre && !/\s$/.test(pre) ? " @" : "@") + ta.value.slice(pos); ta.focus(); const np = pos + (pre && !/\s$/.test(pre) ? 2 : 1); ta.setSelectionRange(np, np); updateSuggest(); } }, "@");
    const composer = h("div", { class: "composer" }, suggest, replyBar, imgBar, h("div", { class: "crow" }, h("button", { class: "cambtn", "aria-label": "Envoyer une photo", onclick: () => file.click() }, ic("cam")), mentionBtn, ta, sendBtn), file);
    const box = h("div", { class: "roombox" }, h("div", { class: "scrollbox" }, olderBtn, intro, stream), composer);
    const scroller = box.firstChild;
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 130) + "px"; });
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer:coarse)").matches) { e.preventDefault(); send(); } });

    // rendu d'un message
    function linkify(text, mentions) {
      const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const ms = (mentions || []).filter(m => m.name);
      const re = new RegExp("(https?:\\/\\/[^\\s<]+)" + (ms.length ? "|(" + ms.map(m => "@" + esc(m.name)).join("|") + ")" : ""), "g");
      const out = []; let last = 0, m;
      while ((m = re.exec(text))) {
        if (m.index > last) out.push(U(text.slice(last, m.index)));
        if (m[1]) out.push(h("a", { href: m[1], target: "_blank", rel: "noopener" }, m[1]));
        else { const who = ms.find(x => "@" + x.name === m[0]); out.push(h("span", { class: "mention" + (who && who.id === S.me.id ? " me" : ""), onclick: (e) => { e.stopPropagation(); if (who) personSheet({ id: who.id, name: who.name, role: (S.peers[who.id] || {}).role }); } }, m[0])); }
        last = m.index + m[0].length;
      }
      if (last < text.length) out.push(U(text.slice(last))); return out;
    }
    function bubble(p) {
      const mine = p.author.id === S.me.id, staff = p.author.role !== "student";
      const b = h("div", { class: "bub" + (p.deleted ? " del" : "") },
        !mine && !isDM(room) ? h("div", { class: "bname", style: "color:" + nameColor(p.author.id), onclick: (e) => { e.stopPropagation(); personSheet(p.author); } }, p.author.name, staff ? h("span", { class: "rolechip" }, p.author.role === "superadmin" ? "Responsable" : "Mentor") : null) : null,
        p.fwd ? h("div", { class: "bfwd" }, "↪ Transféré · de " + p.fwd) : null,
        p.reply ? h("div", { class: "bquote", onclick: (e) => { e.stopPropagation(); if (p.reply.room && p.reply.room !== room) go("#/communaute/" + p.reply.room); else jump(p.reply.id); } }, h("b", null, p.reply.name, p.reply.room && p.reply.room !== room ? h("small", null, " · " + roomShort(p.reply.room)) : null), h("span", null, p.reply.image ? "📷 " : "", U(p.reply.body || (p.reply.image ? "Photo" : "")))) : null,
        p.image ? h("img", { class: "bimg", src: p.image, alt: "Photo", loading: "lazy", onclick: (e) => { e.stopPropagation(); viewer(p.image); } }) : null,
        p.deleted ? h("div", { class: "btext" }, "🚫 Message supprimé") : p.body ? h("div", { class: "btext" }, linkify(p.body, p.mentions)) : null,
        h("div", { class: "bmeta" }, hhmm(p.created_at)));
      const rx = p.reactions.length ? h("div", { class: "rx" }, p.reactions.map(r => h("button", { class: r.mine ? "mine" : null, title: "Voir qui a réagi", onclick: (e) => { e.stopPropagation(); whoReacted(p); } }, U(r.emoji), h("span", null, r.n)))) : null;
      const row = h("div", { class: "bm" + (mine ? " mine" : ""), id: "p-" + p.id }, !mine ? h("div", { class: "bav", style: "background:" + nameColor(p.author.id), onclick: () => personSheet(p.author) }, initials(p.author.name)) : null, h("div", { class: "bcol" }, b, rx));
      if (!p.deleted) b.addEventListener("click", () => actions(p));
      return row;
    }
    function render(stick) {
      const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140;
      const arr = [...posts.values()].sort((a, b) => a.id - b.id);
      const kids = []; let lastDay = "", prev = null;
      for (const p of arr) {
        const d = new Date(p.created_at).toDateString();
        if (d !== lastDay) { kids.push(h("div", { class: "dsep" }, h("span", null, dayLabel(p.created_at)))); lastDay = d; prev = null; }
        let n = nodes.get(p.id);
        if (!n || n.rev !== p.rev) { n = { rev: p.rev, el: bubble(p) }; nodes.set(p.id, n); }
        n.el.classList.toggle("cont", !!(prev && prev.author.id === p.author.id && new Date(p.created_at) - new Date(prev.created_at) < 5 * 60e3));
        kids.push(n.el); prev = p;
      }
      if (!arr.length) kids.push(h("div", { class: "cempty" }, "✨ Sois le premier à écrire ici !"));
      stream.replaceChildren(...kids);
      olderBtn.classList.toggle("hide", !more);
      if (stick || nearBottom) scroller.scrollTop = scroller.scrollHeight;
    }
    function merge(list) { list.forEach(p => posts.set(p.id, p)); }
    const maxId = () => Math.max(0, ...posts.keys());
    const markRead = () => { const m = maxId(); if (m) API.communityRead(room, m).catch(() => { }); };

    async function loadOlder() {
      if (loadingOld || !more) return; loadingOld = true;
      const first = Math.min(...posts.keys()), h0 = scroller.scrollHeight;
      try { const r = await API.communityPosts(room, { before: first }); merge(r.posts); more = r.more; render(false); scroller.scrollTop = scroller.scrollHeight - h0; } finally { loadingOld = false; }
    }
    async function poll() {
      if (document.hidden || !document.body.contains(box)) return;
      try { const r = await API.communityPosts(room, { since: rev }); if (r.posts.length) { const before = maxId(); merge(r.posts); rev = Math.max(rev, r.rev); render(false); if (maxId() > before) markRead(); } } catch (e) { }
    }
    function jump(id) {
      const el = document.getElementById("p-" + id);
      if (!el) { toast("Message plus ancien : remonte la conversation"); return; }
      el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600);
    }
    function setReply(p) {
      replyTo = p;
      if (!p) { replyBar.classList.add("hide"); return; }
      fill(replyBar, h("div", { class: "rbq" }, h("b", null, "Réponse à " + (p.author.id === S.me.id ? "toi-même" : p.author.name)), h("span", null, p.image ? "📷 " : "", U((p.body || "Photo").slice(0, 100)))), h("button", { class: "x", "aria-label": "Annuler", onclick: () => setReply(null) }, "×"));
      replyBar.classList.remove("hide"); ta.focus();
    }
    async function react(p, emoji) {
      try { const np = await API.communityReact(p.id, emoji); posts.set(np.id, np); rev = Math.max(rev, np.rev); render(false); } catch (e) { toast(e.message); }
    }
    function actions(p) {
      const mine = p.author.id === S.me.id;
      const m = modal(p.author.id === S.me.id ? "Mon message" : "Message de " + p.author.name.split(" ")[0], h("div", null,
        h("div", { class: "emorow" }, ["👍", "❤️", "🙏", "🔥", "😂", "👏"].map(e => h("button", { class: p.reactions.some(r => r.emoji === e && r.mine) ? "on" : null, onclick: () => { m.remove(); react(p, e); } }, U(e)))),
        h("div", { class: "actlist" },
          h("button", { onclick: () => { m.remove(); setReply(p); } }, "↩️", h("span", null, "Répondre")),
          !mine && !isDM(room) ? h("button", { onclick: () => { m.remove(); S.pendingReply = p; go("#/communaute/" + dmWith(p.author.id)); } }, "🔒", h("span", null, "Répondre en privé à " + p.author.name.split(" ")[0])) : null,
          p.reactions.length ? h("button", { onclick: () => { m.remove(); whoReacted(p); } }, "👀", h("span", null, "Voir qui a réagi")) : null,
          h("button", { onclick: () => { m.remove(); forward(p); } }, "↪️", h("span", null, "Transférer")),
          p.body ? h("button", { onclick: async () => { m.remove(); try { await navigator.clipboard.writeText(p.body); toast("Texte copié"); } catch (e) { toast("Copie impossible"); } } }, "📋", h("span", null, "Copier le texte")) : null,
          p.image ? h("button", { onclick: () => { m.remove(); viewer(p.image); } }, "🖼️", h("span", null, "Voir la photo")) : null,
          mine || isStaff() ? h("button", { class: "danger", onclick: async () => { m.remove(); if (!confirm("Supprimer ce message pour tout le monde ?")) return; try { await API.communityDelete(p.id); const r = await API.communityPosts(room, { since: rev }); merge(r.posts); rev = Math.max(rev, r.rev); render(false); toast("Message supprimé"); } catch (e) { toast(e.message); } } }, "🗑️", h("span", null, "Supprimer" + (mine ? "" : " (modération)"))) : null)),
        () => []);
    }
    async function whoReacted(p) {
      const data = await API.communityReactions(p.id).catch(() => []);
      const total = data.reduce((a, x) => a + x.users.length, 0);
      let sel = "all"; const tabs = h("div", { class: "rtabs" }), list = h("div", { class: "fwdlist plist" });
      const draw = () => {
        fill(tabs, h("button", { class: sel === "all" ? "on" : null, onclick: () => { sel = "all"; draw(); } }, "Tous " + total), data.map(x => h("button", { class: sel === x.emoji ? "on" : null, onclick: () => { sel = x.emoji; draw(); } }, U(x.emoji + " " + x.users.length))));
        const rows = data.filter(x => sel === "all" || x.emoji === sel).flatMap(x => x.users.map(u => ({ ...u, emoji: x.emoji })));
        fill(list, rows.map(u => h("button", { onclick: () => { if (u.id !== S.me.id) { m.remove(); personSheet({ id: u.id, name: u.name, role: (S.peers[u.id] || {}).role }); } } }, h("div", { class: "ravatar dm", style: "background:" + nameColor(u.id) }, initials(u.name)), h("span", { class: "pmid" }, h("b", null, u.name), u.id === S.me.id ? h("small", null, "Touche le message pour changer ta réaction") : null), h("span", { class: "remo" }, U(u.emoji)))));
      };
      draw();
      const m = modal("Réactions", h("div", null, tabs, list), (mm) => [h("button", { class: "btn ghost", onclick: () => mm.remove() }, "Fermer")]);
    }
    async function forward(p) {
      const rooms = [...(await accessibleRooms()), ...(S.crooms || []).filter(r => isDM(r.room)).map(r => r.room)].filter(r => r !== room);
      const m = modal("Transférer vers…", h("div", { class: "fwdlist" }, rooms.map(r => h("button", { onclick: async () => { m.remove(); try { await API.communityPost(r, { forward_of: p.id }); toast("Transféré dans « " + roomShort(r) + " » ✓"); } catch (e) { toast(e.message); } } }, roomAvatar(r), h("span", null, roomTitle(r))))), (mm) => [h("button", { class: "btn ghost", onclick: () => mm.remove() }, "Annuler")]);
    }
    function viewer(src) {
      const v = h("div", { class: "viewer", onclick: (e) => { if (e.target === v) v.remove(); } }, h("img", { src, alt: "" }),
        h("div", { class: "vbar" }, h("a", { class: "btn ghost sm", href: src, download: "photo", style: "color:#fff;box-shadow:inset 0 0 0 2px rgba(255,255,255,.4)" }, ic("dl"), "Enregistrer"), h("button", { class: "btn gold sm", onclick: () => v.remove() }, "Fermer")));
      document.body.append(v);
    }
    // photo : réduite dans le téléphone avant l'envoi (rapide, même avec peu de réseau)
    file.onchange = async () => {
      const f = file.files[0]; file.value = ""; if (!f) return;
      if (!/^image\//.test(f.type)) return toast("Choisis une image");
      try {
        const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        const max = 1400, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const cx = c.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0, c.width, c.height);
        let data = c.toDataURL("image/jpeg", 0.82); if (data.length > 2.6e6) data = c.toDataURL("image/jpeg", 0.6);
        pendingImg = data;
        fill(imgBar, h("img", { src: data, alt: "" }), h("div", { class: "rbq" }, h("b", null, "📷 Photo prête"), h("span", null, "Ajoute une légende si tu veux, puis envoie.")), h("button", { class: "x", "aria-label": "Retirer", onclick: () => { pendingImg = null; imgBar.classList.add("hide"); } }, "×"));
        imgBar.classList.remove("hide"); ta.focus();
      } catch (e) { toast("Impossible de lire cette image"); }
    };
    let sending = false;
    async function send() {
      const text = ta.value.trim(); if ((!text && !pendingImg) || sending) return;
      sending = true; sendBtn.disabled = true;
      try {
        let image = null;
        if (pendingImg) { toast("Envoi de la photo…"); image = (await API.communityUpload(pendingImg)).url; }
        const mentions = [...picked.entries()].filter(([n]) => text.includes("@" + n)).map(([, id]) => id);
        const p = await API.communityPost(room, { body: text, image, reply_to: replyTo ? replyTo.id : null, mentions });
        picked.clear(); suggest.classList.add("hide");
        posts.set(p.id, p); rev = Math.max(rev, p.rev);
        ta.value = ""; ta.style.height = "auto"; pendingImg = null; imgBar.classList.add("hide"); setReply(null);
        render(true);
      } catch (e) { toast(e.message); } finally { sending = false; sendBtn.disabled = false; }
    }

    S.deep = { back: "#/communaute", title: roomShort(room) + (L[room] ? " · " + L[room].t : ""), sub: isDM(room) ? "🔒 Message privé" : "Communauté · discussion", action: L[room] ? { href: "#/lecon/" + room, icon: "book", title: "Ouvrir la leçon" } : null };
    shell("#/communaute", unread, box);
    document.body.classList.add("is-room");
    // la boîte occupe l'écran sous la barre du haut et suit le clavier du téléphone
    const fit = () => { const top = (document.querySelector(".top") || {}).getBoundingClientRect ? document.querySelector(".top").getBoundingClientRect().bottom : 0; box.style.top = Math.max(0, top) + "px";
      const vv = window.visualViewport; box.style.bottom = vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) + "px" : "0px"; };
    fit(); const vv = window.visualViewport;
    if (vv) { vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); }
    addEventListener("resize", fit);
    S.vv = () => { if (vv) { vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); } removeEventListener("resize", fit); };
    scroller.addEventListener("scroll", () => { if (scroller.scrollTop < 60) loadOlder(); });

    const r = await API.communityPosts(room, {});
    merge(r.posts); more = r.more; rev = r.rev; render(true); markRead();
    if (S.pendingReply) { setReply(S.pendingReply); S.pendingReply = null; }
    setTimeout(() => { scroller.scrollTop = scroller.scrollHeight; }, 300);
    S.poll = setInterval(poll, 4000);
    setTimeout(refreshCBadge, 800);
  }
  const NAMECOLS = ["#5B3A8C", "#1F6E8C", "#B5541C", "#1E7A5A", "#A3326B", "#8A6D12", "#3A4FA0", "#7A3E9D"];
  function nameColor(id) { let x = 0; for (const c of String(id)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return NAMECOLS[x % NAMECOLS.length]; }

  // =============================== BIBLIOTHÈQUE DES LEÇONS (staff) ===============================
  async function viewLibrary() {
    const unread = await unreadCount();
    shell("#/lecons", unread, h("div", { class: "wrap page" },
      h("div", { class: "welcome" }, h("div", null, h("div", { class: "k" }, "LES 36 LEÇONS"), h("h1", null, "Toutes les leçons"), h("p", null, "Ouvrez n'importe quelle leçon pour voir le résumé du cours, le cahier d'exercices et le test, tels que les élèves les verront."),
        S.me.role === "superadmin" ? h("a", { class: "btn gold", style: "margin-top:14px", href: "#/admin/deblocage" }, "🔓 Débloquer des leçons (par classe)") : null)),
      PHASES.map(p => { const ls = LESSONS.filter(l => l.ph === p.n);
        return h("section", { class: "phase" }, h("h2", null, "Phase " + p.n + " · " + p.t, h("small", null, ls.length + " leçons")),
          h("div", { class: "grid" }, ls.map(l => h("a", { class: "lcard p" + l.ph, href: "#/lecon/" + l.n }, h("div", { class: "n" }, "LEÇON " + l.n), h("h3", null, l.t), h("div", { class: "hk" }, l.hook),
            h("div", { class: "foot" }, h("span", { class: "chip w" }, l.wb.q.length + " questions"), h("span", { class: "chip" }, "Test " + l.quiz.length + " q."), h("button", { class: "chip g ubtn", onclick: (e) => { e.preventDefault(); e.stopPropagation(); unlockSheet(l); } }, "🔓 Débloquer…")), h("div", { class: "wm" }, l.n))))); })));
  }

  // =============================== MENTOR ===============================
  async function viewMentor() {
    const [students, classes, unlocks, meta, revs, quiz, msgs] = await (async () => { const s = await myStudents(); const ids = s.map(u => u.id); return [s, await API.listClasses(), await API.listUnlocks(), await API.listAnswersMeta(ids), await API.listReviews(ids), await API.listQuiz(ids), await API.listMessages(ids)]; })();
    const unread = msgs.filter(m => !m.read_by_staff).length;
    const toReview = meta.filter(m => m.submitted && !(revs.find(r => r.student_id === m.student_id && r.lesson === m.lesson) || {}).validated).length;
    const myClasses = classes.filter(isMyClass);
    let phase = +(sessionStorage.getItem("dac-ph") || 1);
    const body = h("div");
    const draw = () => {
      const ls = LESSONS.filter(l => l.ph === phase);
      const byClass = {}; myClasses.forEach(c => { byClass[c.id] = []; }); students.forEach(s => { (byClass[s.class_id || "none"] = byClass[s.class_id || "none"] || []).push(s); });
      fill(body, 
        h("div", { class: "tabs", style: "max-width:520px" }, PHASES.map(p => h("button", { class: phase === p.n ? "on" : null, onclick: () => { phase = p.n; sessionStorage.setItem("dac-ph", p.n); draw(); } }, "Phase " + p.n))),
        h("div", { class: "legend" }, [["#EEEAF3", "Verrouillée"], ["#fff", "Ouverte"], ["var(--lil2)", "En cours"], ["var(--gold)", "Envoyée : à corriger"], ["#3BB273", "Validée"]].map(([c, t]) => h("span", null, h("i", { style: "background:" + c + ";box-shadow:inset 0 0 0 1px #ddd" }), t))),
        Object.keys(byClass).length ? Object.entries(byClass).map(([cid, ss]) => { const c = classes.find(x => x.id === cid);
          return h("div", { class: "card", style: "margin:16px 0" }, h("div", { class: "row" }, h("h2", { style: "margin:0" }, c ? c.name : "Sans classe"), c ? h("span", { class: "chip c" }, "Code : " + c.code) : null, h("span", { class: "muted" }, ss.length + " élève" + (ss.length > 1 ? "s" : ""))),
            c && myClasses.includes(c) ? h("div", { style: "margin:14px 0" }, h("div", { class: "muted", style: "font-size:13px;margin-bottom:6px;font-weight:600" }, "Leçons de la classe « " + c.name + " » (touchez pour ouvrir ou fermer) :"),
              h("div", { class: "toggles" }, ls.map(l => { const on = unlocks.some(u => u.class_id === c.id && u.lesson === l.n); return h("button", { class: "tg" + (on ? " on" : ""), title: l.t, onclick: async () => { const n = ss.length; if (!await ask((on ? "Verrouiller" : "Débloquer") + " la leçon " + l.n + " ?", h("p", null, h("b", null, l.t), h("br"), "Pour la classe ", h("b", null, c.name), " (" + n + " élève" + (n > 1 ? "s" : "") + ")."), on ? "🔒 Verrouiller" : "🔓 Débloquer", on)) return; await API.setUnlock({ class_id: c.id }, l.n, !on); toast(on ? "Leçon " + l.n + " verrouillée" : "Leçon " + l.n + " débloquée pour la classe 🔓"); route(); } }, (on ? "🔓 " : "🔒 ") + l.n); }))) : null,
            h("div", { class: "scroll" }, h("table", { class: "mat" }, h("tr", null, h("th", null, "Élève"), ls.map(l => h("th", { title: l.t }, l.n))),
              ss.map(s => { const unl = unlockedFor(s, unlocks); return h("tr", null, h("td", { class: "nm" }, h("a", { href: "#/eleve/" + s.id }, s.full_name || s.username)), ls.map(l => { const m = meta.find(x => x.student_id === s.id && x.lesson === l.n), r = revs.find(x => x.student_id === s.id && x.lesson === l.n), q = bestQuiz(quiz, s.id, l.n);
                const stt = lessonStatus(l.n, unl, m, r, q); const lab = stt === "vd" ? "✓" : stt === "sb" ? "!" : q ? q.score + "" : "";
                return h("td", null, h("a", { class: "cell " + stt, href: stt === "lk" ? "#/eleve/" + s.id : "#/revue/" + s.id + "/" + l.n, title: s.full_name + " · " + l.n + (q ? " · test " + q.score + "/" + q.total : "") }, lab)); })); }))));
        }) : h("div", { class: "empty card" }, S.me.role === "superadmin" ? [h("h2", null, "Bienvenue ! Par où commencer ?"), h("p", null, "1. Créez une classe · 2. Créez les comptes des mentors et des élèves · 3. Débloquez les leçons."),
            h("div", { class: "row", style: "justify-content:center;margin-top:12px" }, h("a", { class: "btn gold", href: "#/admin/classes" }, "Créer une classe"), h("a", { class: "btn", href: "#/admin/users" }, "Créer des utilisateurs"), h("a", { class: "btn ghost", href: "#/lecons" }, "Voir les 36 leçons"))]
            : "Aucun élève ne vous est encore attribué. Le superadmin vous les attribue depuis « Administration »."));
    };
    draw();
    let storage = null; if (S.me.role === "superadmin") { try { const st = await API.adminStatus(); if (!st.persistent) storage = storageCard(st); } catch (e) { } }
    const [agCard, ltCard] = await Promise.all([agendaCard(), lateCard()]);
    shell("#/mentor", unread, h("div", { class: "wrap page" }, storage, installCard(), pushCard(),
      h("div", { class: "welcome" }, h("div", null, h("div", { class: "k" }, S.me.role === "superadmin" ? "SUPERADMIN" : "MENTOR"), h("h1", null, "Bonjour, " + (S.me.full_name || S.me.username)), h("p", null, "Suivez vos élèves, corrigez leurs cahiers et répondez à leurs questions."),
        h("div", { class: "row", style: "margin-top:14px;gap:8px" }, h("a", { class: "btn gold sm", href: "#/stats" }, "📊 Statistiques"), h("a", { class: "btn sm wa", href: "#/whatsapp" }, "💬 Résumé WhatsApp")))),
      h("div", { class: "stats" }, h("div", { class: "stat" }, h("b", null, students.length), h("span", null, "Élèves")), h("div", { class: "stat" }, h("b", null, toReview), h("span", null, "Cahiers à corriger")), h("div", { class: "stat" }, h("b", null, unread), h("span", null, "Questions non lues")), h("div", { class: "stat" }, h("b", null, revs.filter(r => r.validated).length), h("span", null, "Leçons validées"))),
      agCard, ltCard, body));
  }

  async function viewStudentDetail(sid) {
    const s = await API.getUser(sid); if (!s) return go("#/mentor");
    const [unlocks, meta, revs, quiz, msgs, unread, classes, users] = await Promise.all([API.listUnlocks(), API.listAnswersMeta([sid]), API.listReviews([sid]), API.listQuiz([sid]), API.listMessages([sid]), unreadCount(), API.listClasses(), API.listUsers()]);
    const unl = unlockedFor(s, unlocks); const c = classes.find(x => x.id === s.class_id), mentor = users.find(u => u.id === s.mentor_id);
    const certs = await API.certs(sid).catch(() => []);
    S.deep = { back: "#/mentor", title: s.full_name || s.username, sub: "Suivi de l'élève" };
    shell("#/mentor", unread, h("div", { class: "wrap page" }, h("a", { class: "desk", href: "#/mentor" }, "← Tableau de bord"),
      h("div", { class: "card pcard", style: "margin-top:12px;display:flex;gap:16px;align-items:center;flex-wrap:wrap" }, h("div", { class: "avatar", style: "width:56px;height:56px;font-size:20px" }, initials(s.full_name)),
        h("div", { style: "flex:1" }, h("h2", { style: "margin:0" }, s.full_name || s.username), h("div", { class: "muted" }, "@" + s.username + " · " + (c ? c.name : "sans classe") + " · mentor : " + (mentor ? mentor.full_name : "—"))),
        h("button", { class: "btn ghost sm", onclick: () => resetPw(s) }, "Nouveau mot de passe")),
      PHASES.map(p => h("div", { class: "card", style: "margin-top:16px" }, h("div", { class: "row" }, h("h3", { style: "margin:0;flex:1" }, "Phase " + p.n + " · " + p.t), (() => { const cs = certs.find(x => x.phase === p.n); return cs ? (cs.eligible ? h("a", { class: "btn gold sm", href: certUrl(sid, p.n, false), target: "_blank" }, "🎓 Certificat") : h("span", { class: "chip l" }, "🎓 " + cs.validated + "/" + cs.total + " validées")) : null; })()), labelize(h("table", { class: "t" }, h("tr", null, h("th", null, "Leçon"), h("th", null, "Statut"), h("th", null, "Test"), h("th", null, "Questions"), h("th", null, "Accès individuel")),
        LESSONS.filter(l => l.ph === p.n).map(l => { const m = meta.find(x => x.lesson === l.n), r = revs.find(x => x.lesson === l.n), q = bestQuiz(quiz, sid, l.n), st = lessonStatus(l.n, unl, m, r, q);
          const own = unlocks.some(u => u.student_id === sid && u.lesson === l.n), viaClass = unlocks.some(u => u.class_id && u.class_id === s.class_id && u.lesson === l.n);
          const um = msgs.filter(x => x.lesson === l.n), uu = um.filter(x => !x.read_by_staff).length;
          return h("tr", null, h("td", null, h("a", { href: "#/revue/" + sid + "/" + l.n, style: "font-weight:700;text-decoration:none" }, l.n + " · " + l.t)),
            h("td", null, h("span", { class: "chip " + { lk: "l", op: "l", ip: "l", sb: "g", vd: "v" }[st] }, { lk: "Verrouillée", op: "Ouverte", ip: "En cours", sb: "À corriger", vd: "Validée" }[st])),
            h("td", null, q ? q.score + "/" + q.total : "—"), h("td", null, um.length ? (um.length + (uu ? " (" + uu + " non lue" + (uu > 1 ? "s" : "") + ")" : "")) : "—"),
            h("td", null, viaClass ? h("span", { class: "muted", style: "font-size:13px" }, "Ouverte pour la classe") : h("button", { class: "tg" + (own ? " on" : ""), onclick: async () => { await API.setUnlock({ student_id: sid }, l.n, !own); route(); } }, own ? "🔓 Ouverte" : "🔒 Débloquer"))); })))))));
  }

  function resetPw(u) {
    const inp = h("input", { class: "in", placeholder: "Nouveau mot de passe (6 caractères min.)" });
    modal("Nouveau mot de passe", [h("p", { class: "muted" }, "Pour " + (u.full_name || u.username) + " (identifiant : " + u.username + "). Communiquez-le-lui ensuite."), inp], (m) => [h("button", { class: "btn ghost", onclick: () => m.remove() }, "Annuler"),
      h("button", { class: "btn", onclick: async () => { try { await API.setPassword(u.id, inp.value); m.remove(); toast("Mot de passe modifié"); } catch (e) { toast(e.message); } } }, "Enregistrer")]);
  }

  async function viewInbox() {
    const students = await myStudents(); const ids = students.map(u => u.id); const msgs = await API.listMessages(ids);
    const unread = msgs.filter(m => !m.read_by_staff).length;
    const groups = {}; msgs.forEach(m => { (groups[m.student_id + "|" + m.lesson + "|" + m.item_key] = groups[m.student_id + "|" + m.lesson + "|" + m.item_key] || []).push(m); });
    const arr = Object.entries(groups).sort((a, b) => { const ua = a[1].some(m => !m.read_by_staff), ub = b[1].some(m => !m.read_by_staff); if (ua !== ub) return ub - ua; return b[1][b[1].length - 1].created_at.localeCompare(a[1][a[1].length - 1].created_at); });
    shell("#/inbox", unread, h("div", { class: "wrap page" }, h("h1", null, "Questions des élèves"), h("p", { class: "muted" }, "Les questions non lues apparaissent en premier. Cliquez pour répondre."),
      arr.length ? h("div", { class: "inbox" }, arr.map(([k, th]) => { const [sid, n, key] = k.split("|"), s = students.find(u => u.id === sid) || {}, l = L[n], last = th[th.length - 1], un = th.filter(m => !m.read_by_staff).length;
        return h("a", { href: "javascript:void 0", onclick: () => openThread(s, l, key, itemTitle(l, key), true) }, h("div", { class: "avatar" }, initials(s.full_name)), h("div", { style: "flex:1;min-width:0" }, h("b", null, (s.full_name || "Élève") + " · Leçon " + n), h("div", { style: "font-size:14px" }, itemTitle(l, key).slice(0, 90)), h("div", { class: "muted", style: "font-size:13px" }, (last.author_id === S.me.id ? "Vous : " : "") + U(last.body.slice(0, 90)) + " · " + fmt(last.created_at))), un ? h("span", { class: "chip g" }, un + " non lu" + (un > 1 ? "s" : "")) : h("span", { class: "chip v" }, "Répondu")); }))
        : h("div", { class: "empty card" }, "Aucune question pour le moment.")));
  }

  // =============================== SUPERADMIN ===============================
  function createUserModal(classes, mentors) {
    const gen = () => Math.random().toString(36).slice(2, 6) + Math.floor(1000 + Math.random() * 9000);
    const name = h("input", { class: "in", placeholder: "Prénom et nom" }), user = h("input", { class: "in", placeholder: "ex. grace.mbala" }), pw = h("input", { class: "in", value: gen() }), phoneIn = h("input", { class: "in", type: "tel", placeholder: "+234 801 234 5678 (facultatif)" });
    const role = h("select", { class: "in" }, [["student", "Élève"], ["admin", "Mentor"], ["superadmin", "Superadmin"]].map(([v, t]) => h("option", { value: v }, t)));
    const cls = h("select", { class: "in" }, h("option", { value: "" }, "— aucune —"), classes.map(c => h("option", { value: c.id }, c.name)));
    const men = h("select", { class: "in" }, h("option", { value: "" }, "— aucun —"), mentors.map(m => h("option", { value: m.id }, m.full_name || m.username)));
    const menWrap = h("div", null, h("label", { class: "f" }, "Mentor"), men);
    cls.onchange = () => { const c = classes.find(x => x.id === cls.value); if (c && c.mentor_id && !men.value) men.value = c.mentor_id; };
    role.onchange = () => menWrap.classList.toggle("hide", role.value !== "student");
    name.oninput = () => { if (!user.dataset.touched) user.value = name.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 30); };
    user.oninput = () => { user.dataset.touched = 1; };
    const err = h("div", { class: "err hide" });
    modal("Créer un utilisateur", [h("label", { class: "f" }, "Nom complet"), name, h("label", { class: "f" }, "Identifiant de connexion"), user, h("label", { class: "f" }, "Mot de passe (à lui communiquer)"), pw,
      h("label", { class: "f" }, "Numéro WhatsApp"), phoneIn, h("label", { class: "f" }, "Rôle"), role, h("label", { class: "f" }, "Classe"), cls, menWrap, err],
      (m) => [h("button", { class: "btn ghost", onclick: () => m.remove() }, "Annuler"), h("button", { class: "btn", onclick: async () => {
        try { await API.createUser({ full_name: name.value.trim(), username: user.value.trim(), password: pw.value, phone: phoneIn.value, role: role.value, class_id: cls.value || null, mentor_id: role.value === "student" ? (men.value || null) : null });
          m.remove(); modal("Compte créé ✓", h("div", null, h("p", null, "Communiquez ces informations à ", h("b", null, name.value.trim()), " :"), h("div", { class: "note", style: "font-size:16px" }, "Adresse : ", h("b", null, location.origin), h("br"), "Identifiant : ", h("b", null, user.value.trim().toLowerCase()), h("br"), "Mot de passe : ", h("b", null, pw.value))), (m2) => [h("button", { class: "btn", onclick: () => { m2.remove(); route(); } }, "OK")]); }
        catch (e) { err.textContent = e.message; err.classList.remove("hide"); } } }, "Créer le compte")]);
    name.focus();
  }

  function storageCard(st) {
    if (!st || st.persistent) return h("div", { class: "card storage ok" }, h("div", { class: "pic on" }, "✓"), h("div", null, h("b", null, "Stockage persistant actif"), h("div", { class: "muted", style: "font-size:14px" }, "Les données sont gardées dans le volume " + ((st && st.data_dir) || "/data") + " et survivent aux redéploiements.")));
    return h("div", { class: "card storage bad" }, h("h3", null, "⚠️ Attention : les données seront effacées au prochain déploiement"),
      h("p", null, "Le dossier ", h("b", null, st.data_dir), " n'est pas relié à un stockage persistant dans Coolify. À chaque mise à jour, la base repart de zéro."),
      h("ol", null, h("li", null, "Dans Coolify, ouvrez votre application → onglet ", h("b", null, "Persistent Storage"), " (ou « Storages »)."), h("li", null, h("b", null, "+ Add → Volume Mount"), " : Name ", h("code", null, "ecole-data"), ", Destination Path ", h("code", null, st.data_dir), "."), h("li", null, "Avant de redéployer, ", h("b", null, "téléchargez une sauvegarde"), " ci-dessous (onglet Sauvegarde), puis redéployez et restaurez-la.")),
      h("a", { class: "btn gold sm", href: "/api/admin/backup", download: true }, ic("dl"), "Télécharger une sauvegarde maintenant"));
  }
  async function viewAdmin(tab) {
    if (S.me.role !== "superadmin") return go("#/mentor");
    tab = tab || "users";
    const [users, classes, unread] = await Promise.all([API.listUsers(), API.listClasses(), unreadCount()]);
    const mentors = users.filter(u => u.role !== "student");
    const body = h("div");
    const tabs = h("div", { class: "tabs", style: "max-width:680px" }, [["users", "Comptes"], ["deblocage", "Déblocage"], ["classes", "Classes"], ["rappels", "Rappels"], ["sauvegarde", "Sauvegarde"]].map(([k, t]) => h("button", { class: tab === k ? "on" : null, onclick: () => go("#/admin/" + k) }, t)));
    if (tab === "users") {
      let q = "", rf = "all";
      const search = h("input", { class: "in", placeholder: "Rechercher un nom ou un identifiant…", style: "max-width:320px" });
      const roleF = h("select", { class: "in", style: "max-width:200px" }, [["all", "Tous les rôles"], ["student", "Élèves"], ["admin", "Mentors"], ["superadmin", "Superadmins"]].map(([v, t]) => h("option", { value: v }, t)));
      const tbl = h("div", { class: "scroll" });
      const draw = () => {
        const list = users.filter(u => (rf === "all" || u.role === rf) && ((u.full_name || "") + " " + u.username).toLowerCase().includes(q));
        fill(tbl, labelize(h("table", { class: "t users" }, h("tr", null, ["Nom", "Identifiant", "Rôle", "Mentor", "Classe", "Actif", ""].map(t => h("th", null, t))),
          list.map(u => { const sel = (opts, val, on, dis) => { const s = h("select", { class: "in", style: "padding:6px 8px;min-width:130px", disabled: dis }, opts.map(([v, t]) => h("option", { value: v }, t))); s.value = val || ""; s.onchange = () => on(s.value || null); return s; };
            const upd = async (patch) => { try { await API.updateUser(u.id, patch); Object.assign(u, patch); toast("Modifié ✓"); draw(); } catch (e) { toast(e.message); } };
            return h("tr", null, h("td", { style: "font-weight:700" }, u.full_name || "—"), h("td", null, u.username),
              h("td", null, sel([["student", "Élève"], ["admin", "Mentor"], ["superadmin", "Superadmin"]], u.role, (v) => upd({ role: v }), u.id === S.me.id)),
              h("td", null, u.role === "student" ? sel([["", "— aucun —"], ...mentors.map(m => [m.id, m.full_name || m.username])], u.mentor_id, (v) => upd({ mentor_id: v })) : "—"),
              h("td", null, sel([["", "— aucune —"], ...classes.map(c => [c.id, c.name])], u.class_id, (v) => upd({ class_id: v }))),
              h("td", null, h("button", { class: "tg" + (u.active ? " on" : ""), disabled: u.id === S.me.id, onclick: () => upd({ active: !u.active }) }, u.active ? "Actif" : "Désactivé")),
              h("td", null, h("div", { class: "row", style: "flex-wrap:nowrap" }, h("button", { class: "btn ghost sm", onclick: () => resetPw(u) }, "Mot de passe"), u.role === "student" ? h("a", { class: "btn ghost sm", href: "#/eleve/" + u.id }, "Suivi") : null))); }))));
      };
      search.oninput = () => { q = search.value.toLowerCase(); draw(); }; roleF.onchange = () => { rf = roleF.value; draw(); };
      draw();
      body.append(h("div", { class: "card", style: "margin-top:16px" }, h("div", { class: "row toolbar", style: "margin-bottom:14px" }, h("button", { class: "btn gold", onclick: () => createUserModal(classes, mentors) }, "+ Créer un utilisateur"), search, roleF, h("span", { class: "spacer" }), h("span", { class: "muted", style: "font-size:13px" }, users.filter(u => u.role === "student").length + " élèves · " + mentors.length + " mentors / admins")),
        h("div", { class: "note", style: "margin-bottom:12px" }, "Créez vous-même les comptes (bouton « Créer un utilisateur ») et communiquez à chacun son identifiant et son mot de passe. Les élèves peuvent aussi créer leur compte avec le code de leur classe. Changez ici le rôle, le mentor et la classe de chacun."), tbl));
    } else if (tab === "rappels") {
      const st = await API.settings();
      const on = h("button", { type: "button", class: "tg" + (st.rem_on === "1" ? " on" : "") }, st.rem_on === "1" ? "Activés" : "Désactivés"); on.onclick = () => { on.classList.toggle("on"); on.textContent = on.classList.contains("on") ? "Activés" : "Désactivés"; };
      const num = (v, min, max) => h("input", { class: "in", type: "number", min, max, value: v, style: "max-width:110px" });
      const delay = num(st.rem_delay, 0, 30), every = num(st.rem_every, 1, 30), hour = num(st.rem_hour, 0, 23), max = num(st.rem_max, 1, 30);
      const meet = h("input", { class: "in", type: "url", placeholder: "https://meet.google.com/xxx-xxxx-xxx", value: st.meet_link || "" });
      const line = (label, input, hint) => h("div", { class: "setrow" }, h("div", { style: "flex:1;min-width:0" }, h("b", null, label), hint ? h("small", null, hint) : null), input);
      body.append(h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "📝 Rappels « remplis ton cahier »"),
        h("p", { class: "muted", style: "font-size:14px" }, "Quand une leçon est ouverte et que l'élève n'a pas encore envoyé son cahier, il reçoit automatiquement une notification (avec le pourcentage déjà rempli). Un élève reçoit au plus un rappel par jour."),
        line("Rappels automatiques", on),
        line("Premier rappel", h("div", { class: "row", style: "flex-wrap:nowrap" }, delay, h("span", null, "jours")), "après l'ouverture de la leçon"),
        line("Ensuite, tous les", h("div", { class: "row", style: "flex-wrap:nowrap" }, every, h("span", null, "jours")), "tant que le cahier n'est pas envoyé"),
        line("Heure d'envoi", h("div", { class: "row", style: "flex-wrap:nowrap" }, hour, h("span", null, "h")), "fuseau horaire : " + st.timezone),
        line("Maximum par leçon", h("div", { class: "row", style: "flex-wrap:nowrap" }, max, h("span", null, "rappels"))),
        h("h3", { style: "margin-top:22px" }, "🎥 Agenda"), line("Lien Google Meet habituel", meet, "proposé automatiquement pour chaque nouveau rendez-vous"),
        h("div", { class: "row", style: "margin-top:18px" },
          h("button", { class: "btn gold", onclick: async () => { try { await API.saveSettings({ rem_on: on.classList.contains("on"), rem_delay: delay.value, rem_every: every.value, rem_hour: hour.value, rem_max: max.value, meet_link: meet.value }); toast("Réglages enregistrés ✓"); } catch (e) { toast(e.message); } } }, "Enregistrer"),
          h("button", { class: "btn ghost", onclick: async () => { if (!await ask("Envoyer les rappels maintenant ?", h("p", null, "Chaque élève qui a un cahier ouvert non envoyé (et qui n'a pas été relancé récemment) recevra une notification."), "Envoyer")) return; const r = await API.runReminders(); toast(r.sent + " élève" + (r.sent > 1 ? "s" : "") + " relancé" + (r.sent > 1 ? "s" : "")); } }, "Envoyer les rappels maintenant")),
        h("p", { class: "muted", style: "font-size:13px;margin-top:14px" }, "Les rendez-vous (cours en ligne, prière, étude biblique…) se programment dans le menu Agenda, avec leurs propres rappels.")));
    } else if (tab === "sauvegarde") {
      const st = await API.adminStatus();
      const file = h("input", { type: "file", accept: ".db,application/octet-stream", class: "hide" });
      file.onchange = async () => { const f = file.files[0]; file.value = ""; if (!f) return;
        if (!await ask("Restaurer cette sauvegarde ?", h("p", null, "Fichier : ", h("b", null, f.name), " (" + Math.round(f.size / 1024) + " Ko).", h("br"), "Toutes les données actuelles seront remplacées par celles de la sauvegarde. Une copie de sécurité des données actuelles est gardée sur le serveur."), "Restaurer", true)) return;
        try { toast("Restauration en cours…"); const r = await API.adminRestore(f); toast("Sauvegarde restaurée ✓ (" + r.users + " comptes)"); setTimeout(() => location.reload(), 1500); } catch (e) { toast(e.message); } };
      body.append(storageCard(st),
        h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "💾 Sauvegardes"),
          h("p", { class: "muted" }, "Le serveur fait une sauvegarde automatique chaque jour (les 14 derniers jours sont gardés dans le stockage de l'école). Téléchargez aussi régulièrement une copie sur votre ordinateur ou votre téléphone : c'est la meilleure protection."),
          h("p", null, "Dernière sauvegarde automatique : ", h("b", null, st.last_backup ? fmt(st.last_backup) : "pas encore (la première se fait une minute après le démarrage)")),
          h("div", { class: "row" }, API.mode === "server" ? h("a", { class: "btn gold", href: "/api/admin/backup", download: true }, ic("dl"), "Télécharger une sauvegarde") : h("span", { class: "muted" }, "Indisponible en mode démonstration"),
            API.mode === "server" ? h("button", { class: "btn ghost", onclick: () => file.click() }, "Restaurer une sauvegarde…") : null), file,
          h("p", { class: "muted", style: "font-size:13px;margin-top:12px" }, "La sauvegarde contient les comptes, classes, déblocages, cahiers, corrections, tests, questions, messages et notifications. Les photos de la communauté restent dans le dossier /data/uploads du serveur.")));
    } else if (tab === "deblocage") {
      const unlocks = await API.listUnlocks();
      const students = users.filter(u => u.role === "student");
      let target = null, phase = 1; // rien n'est présélectionné : on choisit toujours la classe
      const zone = h("div");
      const tName = (t) => t.startsWith("c:") ? "la classe « " + (classes.find(c => c.id === t.slice(2)) || {}).name + " »" : "l'élève " + ((students.find(u => u.id === t.slice(2)) || {}).full_name || "");
      const tCount = (t) => t.startsWith("c:") ? students.filter(u => u.class_id === t.slice(2)).length : 1;
      const isOn = (t, n) => t.startsWith("c:") ? unlocks.some(u => u.class_id === t.slice(2) && u.lesson === n) : unlocks.some(u => u.student_id === t.slice(2) && u.lesson === n);
      const viaClass = (t, n) => { if (!t.startsWith("s:")) return false; const st = students.find(u => u.id === t.slice(2)); return st && st.class_id && unlocks.some(u => u.class_id === st.class_id && u.lesson === n); };
      const setOn = async (t, n, on) => { const tg = t.startsWith("c:") ? { class_id: t.slice(2) } : { student_id: t.slice(2) }; await API.setUnlock(tg, n, on);
        for (let i = unlocks.length - 1; i >= 0; i--) { const u = unlocks[i]; if (u.lesson === n && (tg.class_id ? u.class_id === tg.class_id : u.student_id === tg.student_id)) unlocks.splice(i, 1); }
        if (on) unlocks.push({ class_id: tg.class_id || null, student_id: tg.student_id || null, lesson: n }); };
      const draw = () => {
        if (!classes.length && !students.length) return fill(zone, h("div", { class: "empty" }, "Créez d'abord une classe (onglet Classes) et ses élèves (onglet Utilisateurs)."));
        if (!target) {
          const stuSel = h("select", { class: "in" }, h("option", { value: "" }, "— choisir un élève —"), students.map(u => h("option", { value: u.id }, (u.full_name || u.username) + ((classes.find(c => c.id === u.class_id) || {}).name ? " · " + classes.find(c => c.id === u.class_id).name : ""))));
          stuSel.onchange = () => { if (stuSel.value) { target = "s:" + stuSel.value; draw(); } };
          return fill(zone, h("h3", { class: "step" }, h("span", null, "1"), "Pour quelle classe ?"),
            h("p", { class: "muted", style: "margin-top:0;font-size:14px" }, "Chaque classe avance à son rythme : choisissez la classe dont vous voulez ouvrir ou fermer des leçons."),
            classes.length ? h("div", { class: "ccards" }, classes.map(c => { const n = students.filter(u => u.class_id === c.id).length, open = LESSONS.filter(l => unlocks.some(u => u.class_id === c.id && u.lesson === l.n)), m = users.find(u => u.id === c.mentor_id);
              return h("button", { class: "ccard", onclick: () => { target = "c:" + c.id; phase = open.length ? L[open[open.length - 1].n].ph : 1; draw(); } },
                h("b", null, c.name), h("span", null, n + " élève" + (n > 1 ? "s" : "") + " · mentor : " + (m ? m.full_name || m.username : "aucun")),
                h("div", { class: "cprog" }, h("i", { style: "width:" + Math.round(100 * open.length / LESSONS.length) + "%" })),
                h("small", null, open.length ? open.length + " / " + LESSONS.length + " leçons ouvertes · dernière : " + open[open.length - 1].n : "Aucune leçon ouverte"), h("em", null, "Choisir →")); }))
              : h("div", { class: "note" }, "Aucune classe : créez-en une dans l'onglet Classes."),
            students.length ? h("details", { class: "onestu" }, h("summary", null, "Ou bien ouvrir une leçon pour un seul élève (rattrapage, cas particulier)"), stuSel) : null);
        }
        const ls = LESSONS.filter(l => l.ph === phase), who = tName(target), cnt = tCount(target);
        const bulk = async (on) => {
          const todo = ls.filter(l => isOn(target, l.n) !== on); if (!todo.length) return toast(on ? "Ces leçons sont déjà ouvertes" : "Ces leçons sont déjà fermées");
          if (!await ask(on ? "Tout débloquer ?" : "Tout verrouiller ?", h("p", null, (on ? "Ouvrir " : "Fermer ") + todo.length + " leçon" + (todo.length > 1 ? "s" : "") + " de la phase " + phase + " pour ", h("b", null, who), target.startsWith("c:") ? " (" + cnt + " élève" + (cnt > 1 ? "s" : "") + ")." : "."), on ? "🔓 Oui, débloquer" : "🔒 Oui, verrouiller", !on)) return;
          for (const l of todo) await setOn(target, l.n, on); toast((on ? "Débloqué pour " : "Verrouillé pour ") + who); draw(); };
        fill(zone,
          h("div", { class: "tsel" }, h("div", { class: "tsel-i" }, target.startsWith("c:") ? "👥" : "👤"), h("div", { style: "flex:1;min-width:0" }, h("small", null, target.startsWith("c:") ? "CLASSE SÉLECTIONNÉE" : "ÉLÈVE SÉLECTIONNÉ"), h("b", null, target.startsWith("c:") ? (classes.find(c => c.id === target.slice(2)) || {}).name : (students.find(u => u.id === target.slice(2)) || {}).full_name), target.startsWith("c:") ? h("span", null, cnt + " élève" + (cnt > 1 ? "s" : "")) : null),
            h("button", { class: "btn ghost sm", onclick: () => { target = null; draw(); } }, "Changer")),
          h("h3", { class: "step" }, h("span", null, "2"), "Leçons à ouvrir ou fermer"),
          h("div", { class: "tabs", style: "max-width:520px" }, PHASES.map(p => h("button", { class: phase === p.n ? "on" : null, onclick: () => { phase = p.n; draw(); } }, "Phase " + p.n))),
          h("div", { class: "row", style: "margin:14px 0" }, h("button", { class: "btn sm", onclick: () => bulk(true) }, "🔓 Tout débloquer (phase " + phase + ")"), h("button", { class: "btn ghost sm", onclick: () => bulk(false) }, "🔒 Tout verrouiller")),
          h("div", { class: "grid" }, ls.map(l => { const on = isOn(target, l.n), vc = viaClass(target, l.n);
            return h("div", { class: "card", style: "padding:16px;border:3px solid " + (on || vc ? "var(--gold)" : "transparent") },
              h("div", { class: "row" }, h("b", { style: "color:var(--goldd)" }, "LEÇON " + l.n), h("span", { class: "spacer" }), on || vc ? h("span", { class: "chip g" }, "🔓 Ouverte") : h("span", { class: "chip l" }, "🔒 Fermée")),
              h("h3", { style: "margin:8px 0" }, l.t),
              vc ? h("div", { class: "muted", style: "font-size:13px" }, "Déjà ouverte pour toute sa classe.") :
                h("button", { class: "btn sm " + (on ? "ghost" : "gold"), onclick: async () => {
                  if (!await ask(on ? "Verrouiller la leçon " + l.n + " ?" : "Débloquer la leçon " + l.n + " ?", h("p", null, h("b", null, l.t), h("br"), on ? "Elle ne sera plus accessible pour " : "Elle sera ouverte pour ", h("b", null, who), target.startsWith("c:") ? " (" + cnt + " élève" + (cnt > 1 ? "s" : "") + ")" : "", on ? "." : ". Les élèves recevront une notification."), on ? "🔒 Verrouiller" : "🔓 Débloquer", on)) return;
                  await setOn(target, l.n, !on); toast((on ? "Leçon " + l.n + " verrouillée pour " : "Leçon " + l.n + " débloquée pour ") + who); draw(); } }, on ? "Verrouiller" : "Débloquer"),
              h("a", { href: "#/lecon/" + l.n, style: "display:block;margin-top:8px;font-size:13px" }, "Voir la leçon →")); })));
      };
      draw();
      body.append(h("div", { class: "card", style: "margin-top:16px" }, zone));
    } else {
      const list = h("div");
      const edit = (c) => { const n = h("input", { class: "in", value: c ? c.name : "" }), code = h("input", { class: "in", style: "text-transform:uppercase", value: c ? c.code : Math.random().toString(36).slice(2, 8).toUpperCase() });
        const mt = h("select", { class: "in" }, h("option", { value: "" }, "— aucun —"), mentors.map(m => h("option", { value: m.id }, m.full_name || m.username))); mt.value = (c && c.mentor_id) || "";
        modal(c ? "Modifier la classe" : "Nouvelle classe", [h("label", { class: "f" }, "Nom de la classe"), n, h("label", { class: "f" }, "Code d'inscription (à donner aux élèves)"), code, h("label", { class: "f" }, "Mentor de la classe"), mt],
          (m) => [c ? h("button", { class: "btn bad", onclick: async () => { if (confirm("Supprimer cette classe ? Les élèves restent, sans classe.")) { await API.deleteClass(c.id); m.remove(); route(); } } }, "Supprimer") : null, h("span", { class: "spacer" }), h("button", { class: "btn ghost", onclick: () => m.remove() }, "Annuler"),
            h("button", { class: "btn", onclick: async () => { try { if (!n.value.trim()) throw new Error("Nom requis"); await API.saveClass({ ...(c ? { id: c.id } : {}), name: n.value.trim(), code: code.value.trim().toUpperCase(), mentor_id: mt.value || null }); m.remove(); toast("Classe enregistrée"); route(); } catch (e) { toast(e.message); } } }, "Enregistrer")]); };
      list.append(h("div", { class: "row", style: "margin:16px 0" }, h("button", { class: "btn gold", onclick: () => edit(null) }, "+ Nouvelle classe")),
        classes.length ? h("div", { class: "grid" }, classes.map(c => { const m = users.find(u => u.id === c.mentor_id); const n = users.filter(u => u.class_id === c.id && u.role === "student").length;
          return h("div", { class: "card" }, h("h3", null, c.name), h("div", { class: "row" }, h("span", { class: "chip c" }, "Code : " + c.code), h("span", { class: "chip l" }, n + " élève" + (n > 1 ? "s" : ""))), h("p", { class: "muted" }, "Mentor : " + (m ? m.full_name || m.username : "aucun")), h("button", { class: "btn ghost sm", onclick: () => edit(c) }, "Modifier")); }))
          : h("div", { class: "empty card" }, "Créez votre première classe, puis donnez son code aux élèves."));
      body.append(list);
    }
    shell("#/admin", unread, h("div", { class: "wrap page" }, h("h1", null, "Administration"), h("p", { class: "muted" }, "Gérez les comptes, les rôles, les mentors et les classes de toute la plateforme."), tabs, body));
  }

  // =============================== PROFIL ===============================
  async function viewProfile() {
    const unread = await unreadCount();
    const name = h("input", { class: "in", value: S.me.full_name || "" }), pw = h("input", { class: "in", type: "password", placeholder: "Nouveau mot de passe" });
    const phone = h("input", { class: "in", type: "tel", placeholder: "+234 801 234 5678", value: S.me.phone || "" });
    const certs = S.me.role === "student" ? await API.certs(S.me.id).catch(() => []) : [];
    const themeBox = h("div", { class: "themes" });
    const drawTheme = () => { const cur = getTheme(); fill(themeBox, [["auto", "📱 Comme le téléphone"], ["light", "☀️ Clair"], ["dark", "🌙 Sombre"]].map(([k, t]) => h("button", { class: cur === k ? "on" : null, onclick: () => { setTheme(k); drawTheme(); } }, t))); };
    drawTheme();
    shell("#/profil", unread, h("div", { class: "wrap page", style: "max-width:560px" }, h("h1", null, "Mon profil"),
      h("div", { class: "card profhead" }, h("div", { class: "avatar big" }, initials(S.me.full_name || S.me.username)), h("div", null, h("b", null, S.me.full_name || S.me.username), h("div", { class: "muted" }, "@" + S.me.username))),
      h("div", { class: "card", style: "margin-top:16px" }, h("div", { class: "muted" }, "Identifiant : ", h("b", null, S.me.username), " · Rôle : ", { student: "élève", admin: "mentor", superadmin: "superadmin" }[S.me.role]),
        h("label", { class: "f" }, "Mon nom complet"), name, h("button", { class: "btn sm", style: "margin-top:10px", onclick: async () => { try { S.me = await API.updateUser(S.me.id, { full_name: name.value.trim() }); toast("Nom enregistré"); } catch (e) { toast(e.message); } } }, "Enregistrer"),
        h("label", { class: "f", style: "margin-top:22px" }, "Mon numéro WhatsApp (facultatif)"), phone, h("small", { class: "muted", style: "display:block;margin-top:4px" }, "Format international, ex. +234… Votre mentor pourra vous envoyer un point sur WhatsApp."),
        h("button", { class: "btn sm", style: "margin-top:10px", onclick: async () => { try { S.me = await API.updateUser(S.me.id, { phone: phone.value }); toast(S.me.phone ? "Numéro enregistré" : "Numéro retiré"); } catch (e) { toast(e.message); } } }, "Enregistrer"),
        h("label", { class: "f", style: "margin-top:22px" }, "Changer mon mot de passe"), pw, h("button", { class: "btn sm", style: "margin-top:10px", onclick: async () => { try { await API.changeMyPassword(pw.value); pw.value = ""; toast("Mot de passe modifié"); } catch (e) { toast(e.message); } } }, "Modifier")),
      h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "Apparence"), h("p", { class: "muted", style: "margin-top:-4px" }, "Le mode sombre repose les yeux pour lire le soir."), themeBox),
      certs.length ? h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "🎓 Mes certificats"), certs.map(c => certBlock(c, S.me.id))) : null,
      h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "Notifications"), h("p", { class: "muted" }, pushState() === "granted" ? "✓ Activées sur cet appareil." : "Sois prévenu des nouvelles leçons, des messages et des réponses."), h("a", { class: "btn ghost sm", href: "#/notifications" }, ic("bell"), "Gérer mes notifications")),
      h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "L'application"),
        standalone() ? h("p", { class: "muted" }, "✓ L'application est installée sur cet appareil.") : [h("p", { class: "muted" }, "Installe l'application sur ton téléphone : elle s'ouvre en plein écran depuis ton écran d'accueil, comme WhatsApp."), h("button", { class: "btn gold sm", onclick: doInstall }, "📲 Installer l'application")],
        h("button", { class: "btn ghost sm", style: "margin-top:14px;width:100%", onclick: logout }, ic("out"), "Se déconnecter")),
      API.mode === "demo" ? h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "Mode démonstration"), h("p", { class: "muted" }, "Remettre la démonstration à zéro efface toutes les données de test de ce navigateur."), h("button", { class: "btn bad sm", onclick: async () => { await API.resetDemo(); location.hash = "#/"; location.reload(); } }, "Réinitialiser la démo")) : null));
  }

  // =============================== ROUTEUR ===============================
  async function route() {
    try {
      if (/^#\/?verifier\//.test(location.hash)) return viewVerify(decodeURIComponent(location.hash.split("/").pop()));
      if (!S.me) S.me = await API.me();
      if (!S.me) return viewLogin();
      const p = (location.hash.replace(/^#\/?/, "") || "").split("/");
      document.querySelectorAll(".save").forEach(x => x.remove());
      if (S.poll) { clearInterval(S.poll); S.poll = null; }
      if (S.vv) { S.vv(); S.vv = null; }
      document.body.classList.remove("is-room");
      if (p[0] === "notifications") return viewNotifications();
      if (p[0] === "agenda") return viewAgenda();
      if (p[0] === "stats") return viewStats(p[1], p[2]);
      if (p[0] === "whatsapp") return viewWhatsApp(p[1]);
      if (p[0] === "communaute") return p[1] ? viewRoom(decodeURIComponent(p[1])) : viewCommunity();
      if (p[0] === "lecon") return viewLesson(p[1], p[2]);
      if (p[0] === "revue" && isStaff()) return viewLesson(p[2], p[3], p[1]);
      if (p[0] === "questions") return viewStudentQuestions();
      if (p[0] === "mentor" && isStaff()) return viewMentor();
      if (p[0] === "eleve" && isStaff()) return viewStudentDetail(p[1]);
      if (p[0] === "inbox" && isStaff()) return viewInbox();
      if (p[0] === "admin") return viewAdmin(p[1]);
      if (p[0] === "profil") return viewProfile();
      if (p[0] === "lecons" && isStaff()) return viewLibrary();
      return isStaff() ? viewMentor() : viewStudentHome();
    } catch (e) { console.error(e); fill(app, h("div", { class: "wrap page" }, h("div", { class: "err" }, "Une erreur est survenue : " + e.message), h("button", { class: "btn", style: "margin-top:12px", onclick: async () => { await API.signOut(); S.me = null; route(); } }, "Se reconnecter"))); }
  }
  addEventListener("hashchange", route);
  route().then(() => { try { if (S.me && pushState() === "granted") subscribePush(true).catch(() => { }); } catch (e) { } });
  setInterval(() => { if (!document.hidden) refreshCBadge(); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshCBadge(); });
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.type === "open" && e.data.url) location.hash = e.data.url; });
})();
