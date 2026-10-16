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
    const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(String(c))); };
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
  const ic = (n) => h("span", { html: IC[n], style: "display:inline-flex" });
  const toast = (t) => { const el = h("div", { class: "toast" }, t); document.body.append(el); setTimeout(() => el.remove(), 2600); };
  const fmt = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const initials = (n) => (n || "?").split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();
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
  const logout = async () => { if (!confirm("Se déconnecter ?")) return; await API.signOut(); S.me = null; go("#/"); route(); };
  function topbar(active, unread) {
    const nav = [];
    if (S.me.role === "student") nav.push(["#/", "home", "Mon parcours", "Parcours"], ["#/questions", "chat", "Mes questions", "Questions"]);
    else { nav.push(["#/mentor", "grid", "Tableau de bord", "Accueil"], ["#/lecons", "book", "Leçons", "Leçons"], ["#/inbox", "chat", "Questions", "Questions"]); if (S.me.role === "superadmin") nav.push(["#/admin", "users", "Administration", "Admin"]); }
    nav.push(["#/profil", "user", "Profil", "Profil"]);
    const deep = S.deep; // écran secondaire : flèche retour (téléphone)
    return [
      API.mode === "demo" ? h("div", { class: "demo" }, "Mode démonstration : les données restent dans ce navigateur.") : null,
      h("header", { class: "top" + (deep ? " deep" : "") }, h("div", { class: "wrap" },
        deep ? h("a", { class: "backbtn mobile", href: deep.back, "aria-label": "Retour" }, ic("back")) : null,
        h("a", { class: "brand" + (deep ? " desk" : ""), href: "#/" }, h("img", { src: "img/logo.png", alt: "" }), h("div", null, h("b", null, "The Divine Arsenal Corporation"), h("small", null, "ÉCOLE DE DISCIPLES"))),
        deep ? h("div", { class: "toptitle mobile" }, h("b", null, deep.title), deep.sub ? h("small", null, deep.sub) : null) : null,
        h("nav", { class: "nav" }, nav.map(([href, i, t]) => h("a", { href, class: active === href ? "on" : null, title: t }, ic(i), h("span", { class: "navlabel" }, t), (i === "chat" && unread) ? h("i", { class: "dot" }) : null)),
          h("button", { title: "Déconnexion", onclick: logout }, ic("out"))),
        !deep ? h("button", { class: "iconbtn mobile", title: "Déconnexion", "aria-label": "Déconnexion", onclick: logout }, ic("out")) : null)),
      deep ? null : h("nav", { class: "tabbar" }, nav.map(([href, i, t, short]) => h("a", { href, class: active === href ? "on" : null }, h("span", { class: "ti" }, ic(i), (i === "chat" && unread) ? h("i", { class: "badge" }, unread > 9 ? "9+" : unread) : null), h("span", { class: "tl" }, short)))) ];
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
        go(S.me.role === "student" ? "#/" : "#/mentor"); route(); }
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
    shell("#/", unread, h("div", { class: "wrap page" }, installCard(),
      h("div", { class: "welcome" },
        h("div", { class: "ring", html: `<svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" stroke="rgba(255,255,255,.15)" stroke-width="12" fill="none"/><circle cx="60" cy="60" r="52" stroke="#C9A227" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"/></svg><b>${pct}%<small>CAHIERS ENVOYÉS</small></b>` }),
        h("div", null, h("div", { class: "k" }, "BIENVENUE"), h("h1", null, "Shalom, " + (S.me.full_name || S.me.username).split(" ")[0] + " !"),
          current ? [h("p", null, "Ta leçon du moment : ", h("b", { style: "color:#fff" }, current.n + " · " + current.t)), h("a", { class: "btn gold", style: "margin-top:14px", href: "#/lecon/" + current.n }, "Continuer ma leçon →")] : h("p", null, "Ton mentor va bientôt débloquer ta première leçon. Reste connecté !"))),
      h("div", { class: "stats" },
        h("div", { class: "stat" }, h("b", null, opened), h("span", null, "Leçons ouvertes")),
        h("div", { class: "stat" }, h("b", null, done), h("span", null, "Leçons validées ⭐")),
        h("div", { class: "stat" }, h("b", null, passes), h("span", null, "Tests réussis")),
        h("div", { class: "stat" }, h("b", null, unread), h("span", null, "Réponses non lues"))),
      PHASES.map(p => { const ls = LESSONS.filter(l => l.ph === p.n);
        return h("section", { class: "phase" }, h("h2", null, "Phase " + p.n + " · " + p.t, h("small", null, ls.filter(l => st[l.n] === "vd").length + " / " + ls.length)),
          h("div", { class: "grid" }, ls.map(l => lessonCard(l, st[l.n], bestQuiz(quiz, S.me.id, l.n))))); })));
  }
  function lessonCard(l, s, q) {
    const chips = { op: [h("span", { class: "chip w" }, "À commencer")], ip: [h("span", { class: "chip" }, "En cours")], sb: [h("span", { class: "chip g" }, "Envoyé au mentor")], vd: [h("span", { class: "chip ok" }, "✓ Validée")] }[s] || [];
    if (q) chips.push(h("span", { class: "chip" }, "Test " + q.score + "/" + q.total));
    if (s === "lk") return h("div", { class: "lcard locked" }, h("div", { class: "n" }, "LEÇON " + l.n), h("h3", null, l.t), h("div", { class: "foot" }, h("span", { class: "chip l" }, ic("lock"), "Bientôt débloquée")), h("div", { class: "wm" }, l.n));
    return h("a", { class: "lcard p" + l.ph, href: "#/lecon/" + l.n }, h("div", { class: "n" }, "LEÇON " + l.n), h("h3", null, l.t), h("div", { class: "hk" }, l.hook), h("div", { class: "foot" }, chips), h("div", { class: "wm" }, l.n));
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
      h("div", { class: "k" }, "LEÇON " + l.n + " · " + l.etape.toUpperCase()), h("h1", null, l.t), h("div", { class: "fil" }, l.fil)));
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
  function tableOf(t) { return labelize(h("table", { class: "t" }, h("tr", null, t.head.map(c => h("th", null, c))), t.rows.map(r => h("tr", null, r.map((c, i) => h("td", { style: i ? null : "font-weight:700;color:var(--pur)" }, c)))))); }

  // ---------- cahier ----------
  function renderCahier(el, l, student, ans, rev, msgs, review, preview) {
    const data = JSON.parse(JSON.stringify((ans && ans.data) || {}));
    const items = (rev && rev.items) || {};
    const ro = review || preview; // le mentor ne modifie pas les réponses
    const saveEl = h("div", { class: "save" }, "Enregistré ✓"); document.body.querySelectorAll(".save").forEach(x => x.remove()); document.body.append(saveEl);
    let timer = null;
    const persist = (submitted) => API.saveAnswers(student.id, l.n, data, submitted).then(() => { saveEl.textContent = "Enregistré ✓"; saveEl.classList.add("show"); setTimeout(() => saveEl.classList.remove("show"), 1400); }).catch(e => toast("Erreur d'enregistrement : " + e.message));
    const changed = () => { if (ro) return; saveEl.textContent = "Enregistrement…"; saveEl.classList.add("show"); clearTimeout(timer); timer = setTimeout(() => persist(false), 900); };
    const reviewState = JSON.parse(JSON.stringify(items));
    let rvTimer = null;
    const saveRev = () => { clearTimeout(rvTimer); rvTimer = setTimeout(() => API.saveReview(student.id, l.n, { items: reviewState }).then(() => { saveEl.textContent = "Correction enregistrée ✓"; saveEl.classList.add("show"); setTimeout(() => saveEl.classList.remove("show"), 1400); }), 700); };

    const text = (key, rows, ph) => { const t = h("textarea", { class: "in", rows: rows || 3, placeholder: ph || "Écris ta réponse ici…", disabled: ro }); t.value = data[key] || ""; t.addEventListener("input", () => { data[key] = t.value; changed(); }); return t; };
    function itemFoot(key, title) {
      if (preview) return [];
      const th = msgs.filter(m => m.item_key === key), un = th.filter(m => review ? !m.read_by_staff : !m.read_by_student).length;
      const bar = h("div", { class: "bar" }, h("button", { class: "askbtn" + (th.length ? " has" : ""), type: "button", onclick: () => openThread(student, l, key, title, review) }, ic("chat"), th.length ? th.length + " message" + (th.length > 1 ? "s" : "") : (review ? "Écrire à l'élève" : "Poser une question au mentor"), un ? h("i", { class: "u" }) : null));
      const r = items[key];
      const out = [bar];
      if (!review && r && (r.ok != null || r.comment)) out.push(h("div", { class: "rv " + (r.ok === false ? "no" : "ok") }, h("b", null, r.ok === false ? "✗ À revoir" : "✓ Bien"), r.comment ? " · " + r.comment : ""));
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
        rev && rev.general ? h("div", { class: "card", style: "margin-top:14px;border-left:6px solid var(--gold)" }, h("b", null, "Mot de ton mentor : "), rev.general) : null);
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
    const draw = (ms) => fill(list, ...(ms.length ? ms.map(m => h("div", { class: "msg" + (m.author_id === S.me.id ? " mine" : "") }, m.body, h("small", null, nameOf(m.author_id) + " · " + fmt(m.created_at)))) : [h("div", { class: "empty" }, asStaff ? "Aucun message. Écrivez un mot à l'élève sur cette question." : "Pose ta question : ton mentor te répondra ici.")]));
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
      return h("div", { class: "inbox" }, h("a", { href: "javascript:void 0", onclick: () => openThread(S.me, l, k, itemTitle(l, k), false) }, h("div", { class: "avatar" }, k), h("div", { style: "flex:1" }, h("b", null, itemTitle(l, k)), h("div", { class: "muted", style: "font-size:14px" }, last.body.slice(0, 90))), un ? h("span", { class: "chip g" }, un + " nouveau" + (un > 1 ? "x" : "")) : null)); })
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
        return h("a", { href: "javascript:void 0", onclick: () => openThread(S.me, l, key, itemTitle(l, key), false) }, h("div", { class: "avatar" }, n), h("div", { style: "flex:1;min-width:0" }, h("b", null, "Leçon " + n + " · " + itemTitle(l, key).slice(0, 80)), h("div", { class: "muted", style: "font-size:14px" }, (last.author_id === S.me.id ? "Moi : " : "Mentor : ") + last.body.slice(0, 90))), un ? h("span", { class: "chip g" }, "Nouvelle réponse") : null); }))
        : h("div", { class: "empty card" }, "Aucune question pour l'instant. Pendant que tu remplis ton cahier, clique sur « Poser une question au mentor » sous une question.")));
  }

  // =============================== BIBLIOTHÈQUE DES LEÇONS (staff) ===============================
  async function viewLibrary() {
    const unread = await unreadCount();
    shell("#/lecons", unread, h("div", { class: "wrap page" },
      h("div", { class: "welcome" }, h("div", null, h("div", { class: "k" }, "LES 36 LEÇONS"), h("h1", null, "Toutes les leçons"), h("p", null, "Ouvrez n'importe quelle leçon pour voir le résumé du cours, le cahier d'exercices et le test, tels que les élèves les verront."),
        S.me.role === "superadmin" ? h("a", { class: "btn gold", style: "margin-top:14px", href: "#/admin/deblocage" }, "🔓 Débloquer des leçons pour une classe") : null)),
      PHASES.map(p => { const ls = LESSONS.filter(l => l.ph === p.n);
        return h("section", { class: "phase" }, h("h2", null, "Phase " + p.n + " · " + p.t, h("small", null, ls.length + " leçons")),
          h("div", { class: "grid" }, ls.map(l => h("a", { class: "lcard p" + l.ph, href: "#/lecon/" + l.n }, h("div", { class: "n" }, "LEÇON " + l.n), h("h3", null, l.t), h("div", { class: "hk" }, l.hook),
            h("div", { class: "foot" }, h("span", { class: "chip w" }, l.wb.q.length + " questions"), h("span", { class: "chip" }, "Test " + l.quiz.length + " q.")), h("div", { class: "wm" }, l.n))))); })));
  }

  // =============================== MENTOR ===============================
  async function viewMentor() {
    const [students, classes, unlocks, meta, revs, quiz, msgs] = await (async () => { const s = await myStudents(); const ids = s.map(u => u.id); return [s, await API.listClasses(), await API.listUnlocks(), await API.listAnswersMeta(ids), await API.listReviews(ids), await API.listQuiz(ids), await API.listMessages(ids)]; })();
    const unread = msgs.filter(m => !m.read_by_staff).length;
    const toReview = meta.filter(m => m.submitted && !(revs.find(r => r.student_id === m.student_id && r.lesson === m.lesson) || {}).validated).length;
    const myClasses = classes.filter(c => S.me.role === "superadmin" || c.mentor_id === S.me.id);
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
            c && myClasses.includes(c) ? h("div", { style: "margin:14px 0" }, h("div", { class: "muted", style: "font-size:13px;margin-bottom:6px;font-weight:600" }, "Débloquer pour toute la classe (cliquez une leçon) :"),
              h("div", { class: "toggles" }, ls.map(l => { const on = unlocks.some(u => u.class_id === c.id && u.lesson === l.n); return h("button", { class: "tg" + (on ? " on" : ""), title: l.t, onclick: async () => { await API.setUnlock({ class_id: c.id }, l.n, !on); toast(on ? "Leçon " + l.n + " verrouillée" : "Leçon " + l.n + " débloquée pour la classe 🔓"); route(); } }, (on ? "🔓 " : "🔒 ") + l.n); }))) : null,
            h("div", { class: "scroll" }, h("table", { class: "mat" }, h("tr", null, h("th", null, "Élève"), ls.map(l => h("th", { title: l.t }, l.n))),
              ss.map(s => { const unl = unlockedFor(s, unlocks); return h("tr", null, h("td", { class: "nm" }, h("a", { href: "#/eleve/" + s.id }, s.full_name || s.username)), ls.map(l => { const m = meta.find(x => x.student_id === s.id && x.lesson === l.n), r = revs.find(x => x.student_id === s.id && x.lesson === l.n), q = bestQuiz(quiz, s.id, l.n);
                const stt = lessonStatus(l.n, unl, m, r, q); const lab = stt === "vd" ? "✓" : stt === "sb" ? "!" : q ? q.score + "" : "";
                return h("td", null, h("a", { class: "cell " + stt, href: stt === "lk" ? "#/eleve/" + s.id : "#/revue/" + s.id + "/" + l.n, title: s.full_name + " · " + l.n + (q ? " · test " + q.score + "/" + q.total : "") }, lab)); })); }))));
        }) : h("div", { class: "empty card" }, S.me.role === "superadmin" ? [h("h2", null, "Bienvenue ! Par où commencer ?"), h("p", null, "1. Créez une classe · 2. Créez les comptes des mentors et des élèves · 3. Débloquez les leçons."),
            h("div", { class: "row", style: "justify-content:center;margin-top:12px" }, h("a", { class: "btn gold", href: "#/admin/classes" }, "Créer une classe"), h("a", { class: "btn", href: "#/admin/users" }, "Créer des utilisateurs"), h("a", { class: "btn ghost", href: "#/lecons" }, "Voir les 36 leçons"))]
            : "Aucun élève ne vous est encore attribué. Le superadmin vous les attribue depuis « Administration »."));
    };
    draw();
    shell("#/mentor", unread, h("div", { class: "wrap page" }, installCard(),
      h("div", { class: "welcome" }, h("div", null, h("div", { class: "k" }, S.me.role === "superadmin" ? "SUPERADMIN" : "MENTOR"), h("h1", null, "Bonjour, " + (S.me.full_name || S.me.username)), h("p", null, "Suivez vos élèves, corrigez leurs cahiers et répondez à leurs questions."))),
      h("div", { class: "stats" }, h("div", { class: "stat" }, h("b", null, students.length), h("span", null, "Élèves")), h("div", { class: "stat" }, h("b", null, toReview), h("span", null, "Cahiers à corriger")), h("div", { class: "stat" }, h("b", null, unread), h("span", null, "Questions non lues")), h("div", { class: "stat" }, h("b", null, revs.filter(r => r.validated).length), h("span", null, "Leçons validées"))),
      body));
  }

  async function viewStudentDetail(sid) {
    const s = await API.getUser(sid); if (!s) return go("#/mentor");
    const [unlocks, meta, revs, quiz, msgs, unread, classes, users] = await Promise.all([API.listUnlocks(), API.listAnswersMeta([sid]), API.listReviews([sid]), API.listQuiz([sid]), API.listMessages([sid]), unreadCount(), API.listClasses(), API.listUsers()]);
    const unl = unlockedFor(s, unlocks); const c = classes.find(x => x.id === s.class_id), mentor = users.find(u => u.id === s.mentor_id);
    S.deep = { back: "#/mentor", title: s.full_name || s.username, sub: "Suivi de l'élève" };
    shell("#/mentor", unread, h("div", { class: "wrap page" }, h("a", { class: "desk", href: "#/mentor" }, "← Tableau de bord"),
      h("div", { class: "card pcard", style: "margin-top:12px;display:flex;gap:16px;align-items:center;flex-wrap:wrap" }, h("div", { class: "avatar", style: "width:56px;height:56px;font-size:20px" }, initials(s.full_name)),
        h("div", { style: "flex:1" }, h("h2", { style: "margin:0" }, s.full_name || s.username), h("div", { class: "muted" }, "@" + s.username + " · " + (c ? c.name : "sans classe") + " · mentor : " + (mentor ? mentor.full_name : "—"))),
        h("button", { class: "btn ghost sm", onclick: () => resetPw(s) }, "Nouveau mot de passe")),
      PHASES.map(p => h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "Phase " + p.n + " · " + p.t), labelize(h("table", { class: "t" }, h("tr", null, h("th", null, "Leçon"), h("th", null, "Statut"), h("th", null, "Test"), h("th", null, "Questions"), h("th", null, "Accès individuel")),
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
        return h("a", { href: "javascript:void 0", onclick: () => openThread(s, l, key, itemTitle(l, key), true) }, h("div", { class: "avatar" }, initials(s.full_name)), h("div", { style: "flex:1;min-width:0" }, h("b", null, (s.full_name || "Élève") + " · Leçon " + n), h("div", { style: "font-size:14px" }, itemTitle(l, key).slice(0, 90)), h("div", { class: "muted", style: "font-size:13px" }, (last.author_id === S.me.id ? "Vous : " : "") + last.body.slice(0, 90) + " · " + fmt(last.created_at))), un ? h("span", { class: "chip g" }, un + " non lu" + (un > 1 ? "s" : "")) : h("span", { class: "chip v" }, "Répondu")); }))
        : h("div", { class: "empty card" }, "Aucune question pour le moment.")));
  }

  // =============================== SUPERADMIN ===============================
  function createUserModal(classes, mentors) {
    const gen = () => Math.random().toString(36).slice(2, 6) + Math.floor(1000 + Math.random() * 9000);
    const name = h("input", { class: "in", placeholder: "Prénom et nom" }), user = h("input", { class: "in", placeholder: "ex. grace.mbala" }), pw = h("input", { class: "in", value: gen() });
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
      h("label", { class: "f" }, "Rôle"), role, h("label", { class: "f" }, "Classe"), cls, menWrap, err],
      (m) => [h("button", { class: "btn ghost", onclick: () => m.remove() }, "Annuler"), h("button", { class: "btn", onclick: async () => {
        try { await API.createUser({ full_name: name.value.trim(), username: user.value.trim(), password: pw.value, role: role.value, class_id: cls.value || null, mentor_id: role.value === "student" ? (men.value || null) : null });
          m.remove(); modal("Compte créé ✓", h("div", null, h("p", null, "Communiquez ces informations à ", h("b", null, name.value.trim()), " :"), h("div", { class: "note", style: "font-size:16px" }, "Adresse : ", h("b", null, location.origin), h("br"), "Identifiant : ", h("b", null, user.value.trim().toLowerCase()), h("br"), "Mot de passe : ", h("b", null, pw.value))), (m2) => [h("button", { class: "btn", onclick: () => { m2.remove(); route(); } }, "OK")]); }
        catch (e) { err.textContent = e.message; err.classList.remove("hide"); } } }, "Créer le compte")]);
    name.focus();
  }

  async function viewAdmin(tab) {
    if (S.me.role !== "superadmin") return go("#/mentor");
    tab = tab || "users";
    const [users, classes, unread] = await Promise.all([API.listUsers(), API.listClasses(), unreadCount()]);
    const mentors = users.filter(u => u.role !== "student");
    const body = h("div");
    const tabs = h("div", { class: "tabs", style: "max-width:680px" }, [["users", "Utilisateurs"], ["deblocage", "Déblocage"], ["classes", "Classes"]].map(([k, t]) => h("button", { class: tab === k ? "on" : null, onclick: () => go("#/admin/" + k) }, t)));
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
    } else if (tab === "deblocage") {
      const unlocks = await API.listUnlocks();
      const students = users.filter(u => u.role === "student");
      const target = h("select", { class: "in", style: "max-width:420px" },
        h("optgroup", { label: "Toute une classe" }, classes.map(c => h("option", { value: "c:" + c.id }, "Classe · " + c.name))),
        h("optgroup", { label: "Un seul élève" }, students.map(u => h("option", { value: "s:" + u.id }, (u.full_name || u.username) + " (@" + u.username + ")"))));
      try { const saved = sessionStorage.getItem("dac-target"); if (saved && [...target.options].some(o => o.value === saved)) target.value = saved; } catch (e) { }
      let phase = 1;
      const zone = h("div");
      const isOn = (t, n) => t.startsWith("c:") ? unlocks.some(u => u.class_id === t.slice(2) && u.lesson === n) : unlocks.some(u => u.student_id === t.slice(2) && u.lesson === n);
      const viaClass = (t, n) => { if (!t.startsWith("s:")) return false; const st = students.find(u => u.id === t.slice(2)); return st && st.class_id && unlocks.some(u => u.class_id === st.class_id && u.lesson === n); };
      const setOn = async (t, n, on) => { const tg = t.startsWith("c:") ? { class_id: t.slice(2) } : { student_id: t.slice(2) }; await API.setUnlock(tg, n, on);
        for (let i = unlocks.length - 1; i >= 0; i--) { const u = unlocks[i]; if (u.lesson === n && (tg.class_id ? u.class_id === tg.class_id : u.student_id === tg.student_id)) unlocks.splice(i, 1); }
        if (on) unlocks.push({ class_id: tg.class_id || null, student_id: tg.student_id || null, lesson: n }); };
      const draw = () => {
        const t = target.value;
        if (!t) { fill(zone, h("div", { class: "empty" }, "Créez d'abord une classe (onglet Classes) ou un élève (onglet Utilisateurs).")); return; }
        const ls = LESSONS.filter(l => l.ph === phase);
        fill(zone, h("div", { class: "tabs", style: "max-width:520px;margin-top:16px" }, PHASES.map(p => h("button", { class: phase === p.n ? "on" : null, onclick: () => { phase = p.n; draw(); } }, "Phase " + p.n))),
          h("div", { class: "row", style: "margin:14px 0" },
            h("button", { class: "btn sm", onclick: async (e) => { e.target.disabled = true; for (const l of ls) if (!isOn(t, l.n)) await setOn(t, l.n, true); toast("Phase " + phase + " débloquée 🔓"); draw(); } }, "🔓 Tout débloquer (phase " + phase + ")"),
            h("button", { class: "btn ghost sm", onclick: async (e) => { e.target.disabled = true; for (const l of ls) if (isOn(t, l.n)) await setOn(t, l.n, false); toast("Phase " + phase + " verrouillée"); draw(); } }, "🔒 Tout verrouiller")),
          h("div", { class: "grid" }, ls.map(l => { const on = isOn(t, l.n), vc = viaClass(t, l.n);
            return h("div", { class: "card", style: "padding:16px;border:3px solid " + (on || vc ? "var(--gold)" : "transparent") },
              h("div", { class: "row" }, h("b", { style: "color:var(--goldd)" }, "LEÇON " + l.n), h("span", { class: "spacer" }), on || vc ? h("span", { class: "chip g" }, "🔓 Ouverte") : h("span", { class: "chip l" }, "🔒 Fermée")),
              h("h3", { style: "margin:8px 0" }, l.t),
              vc ? h("div", { class: "muted", style: "font-size:13px" }, "Déjà ouverte pour toute sa classe.") :
                h("button", { class: "btn sm " + (on ? "ghost" : "gold"), onclick: async () => { await setOn(t, l.n, !on); toast(on ? "Leçon " + l.n + " verrouillée" : "Leçon " + l.n + " débloquée 🔓"); draw(); } }, on ? "Verrouiller" : "Débloquer"),
              h("a", { href: "#/lecon/" + l.n, style: "display:block;margin-top:8px;font-size:13px" }, "Voir la leçon →")); })));
      };
      target.onchange = () => { try { sessionStorage.setItem("dac-target", target.value); } catch (e) { } draw(); };
      draw();
      body.append(h("div", { class: "card", style: "margin-top:16px" }, h("label", { class: "f", style: "margin-top:0" }, "Pour qui voulez-vous débloquer des leçons ?"), target,
        h("p", { class: "muted", style: "font-size:13px;margin:8px 0 0" }, "Une leçon débloquée apparaît aussitôt dans le parcours des élèves concernés : ils peuvent lire le résumé, remplir le cahier et passer le test."), zone));
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
    shell("#/profil", unread, h("div", { class: "wrap page", style: "max-width:560px" }, h("h1", null, "Mon profil"),
      h("div", { class: "card profhead" }, h("div", { class: "avatar big" }, initials(S.me.full_name || S.me.username)), h("div", null, h("b", null, S.me.full_name || S.me.username), h("div", { class: "muted" }, "@" + S.me.username))),
      h("div", { class: "card", style: "margin-top:16px" }, h("div", { class: "muted" }, "Identifiant : ", h("b", null, S.me.username), " · Rôle : ", { student: "élève", admin: "mentor", superadmin: "superadmin" }[S.me.role]),
        h("label", { class: "f" }, "Mon nom complet"), name, h("button", { class: "btn sm", style: "margin-top:10px", onclick: async () => { try { S.me = await API.updateUser(S.me.id, { full_name: name.value.trim() }); toast("Nom enregistré"); } catch (e) { toast(e.message); } } }, "Enregistrer"),
        h("label", { class: "f", style: "margin-top:22px" }, "Changer mon mot de passe"), pw, h("button", { class: "btn sm", style: "margin-top:10px", onclick: async () => { try { await API.changeMyPassword(pw.value); pw.value = ""; toast("Mot de passe modifié"); } catch (e) { toast(e.message); } } }, "Modifier")),
      h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "L'application"),
        standalone() ? h("p", { class: "muted" }, "✓ L'application est installée sur cet appareil.") : [h("p", { class: "muted" }, "Installe l'application sur ton téléphone : elle s'ouvre en plein écran depuis ton écran d'accueil, comme WhatsApp."), h("button", { class: "btn gold sm", onclick: doInstall }, "📲 Installer l'application")],
        h("button", { class: "btn ghost sm", style: "margin-top:14px;width:100%", onclick: logout }, ic("out"), "Se déconnecter")),
      API.mode === "demo" ? h("div", { class: "card", style: "margin-top:16px" }, h("h3", null, "Mode démonstration"), h("p", { class: "muted" }, "Remettre la démonstration à zéro efface toutes les données de test de ce navigateur."), h("button", { class: "btn bad sm", onclick: async () => { await API.resetDemo(); location.hash = "#/"; location.reload(); } }, "Réinitialiser la démo")) : null));
  }

  // =============================== ROUTEUR ===============================
  async function route() {
    try {
      if (!S.me) S.me = await API.me();
      if (!S.me) return viewLogin();
      const p = (location.hash.replace(/^#\/?/, "") || "").split("/");
      document.querySelectorAll(".save").forEach(x => x.remove());
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
  route();
})();
