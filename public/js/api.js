// Couche d'accès aux données : serveur de l'école (production) ou mode démonstration (navigateur).
(function () {
  const CFG = window.APP_CONFIG || {};
  const now = () => new Date().toISOString();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now());

  // =============================== MODE DÉMO ===============================
  function DemoApi() {
    const KEY = "dac-demo-db-v1", SKEY = "dac-demo-session";
    let db;
    const load = () => { try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; } if (!db) seed(); };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { } };
    function seed() {
      const sa = uid(), m = uid(), s1 = uid(), s2 = uid(), c = uid();
      db = {
        users: [
          { id: sa, username: "admin", password: "admin123", full_name: "Superadmin", role: "superadmin", class_id: null, mentor_id: null, active: true, created_at: now() },
          { id: m, username: "mentor", password: "mentor123", full_name: "Frère Daniel (mentor)", role: "admin", class_id: c, mentor_id: null, active: true, created_at: now() },
          { id: s1, username: "etudiant", password: "etudiant123", full_name: "Grâce Mbala", role: "student", class_id: c, mentor_id: m, active: true, created_at: now() },
          { id: s2, username: "samuel", password: "samuel123", full_name: "Samuel Kouassi", role: "student", class_id: c, mentor_id: m, active: true, created_at: now() }],
        classes: [{ id: c, name: "Promotion 2026", code: "DEMO2026", mentor_id: m, created_at: now() }],
        unlocks: ["1-1", "1-2", "1-3"].map(l => ({ id: uid(), class_id: c, student_id: null, lesson: l, created_at: now() })),
        answers: [], reviews: [], quiz: [], messages: [] };
      save();
    }
    load();
    let me = null;
    try { const id = sessionStorage.getItem(SKEY) || localStorage.getItem(SKEY); me = db.users.find(u => u.id === id && u.active) || null; } catch (e) { }
    const pub = (u) => { if (!u) return null; const { password, ...r } = u; return r; };
    const isStaffFor = (sid) => me && (me.role === "superadmin" || (db.users.find(u => u.id === sid) || {}).mentor_id === me.id);
    const need = (ok) => { if (!ok) throw new Error("Non autorisé"); };
    return {
      mode: "demo",
      async me() { return pub(me); },
      async signIn(username, password) {
        const u = db.users.find(x => x.username === username.trim().toLowerCase() && x.password === password);
        if (!u) throw new Error("Identifiant ou mot de passe incorrect");
        if (!u.active) throw new Error("Ce compte est désactivé. Contacte ton responsable.");
        me = u; try { localStorage.setItem(SKEY, u.id); } catch (e) { } return pub(u);
      },
      async signUp({ username, full_name, password, class_code }) {
        username = username.trim().toLowerCase();
        if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error("Identifiant : 3 à 30 caractères (lettres, chiffres, . _ -)");
        if (password.length < 6) throw new Error("Mot de passe : 6 caractères minimum");
        if (db.users.some(u => u.username === username)) throw new Error("Cet identifiant est déjà pris");
        const c = db.classes.find(x => x.code.toUpperCase() === class_code.trim().toUpperCase());
        if (!c) throw new Error("Code de classe invalide");
        const u = { id: uid(), username, password, full_name, role: "student", class_id: c.id, mentor_id: c.mentor_id, active: true, created_at: now() };
        db.users.push(u); save(); return this.signIn(username, password);
      },
      async signOut() { me = null; try { localStorage.removeItem(SKEY); } catch (e) { } },
      async changeMyPassword(pw) { need(me); if (pw.length < 6) throw new Error("6 caractères minimum"); me.password = pw; save(); },
      async resetDemo() { localStorage.removeItem(KEY); localStorage.removeItem(SKEY); },
      // utilisateurs
      async listUsers() {
        need(me && me.role !== "student");
        return db.users.filter(u => me.role === "superadmin" || u.mentor_id === me.id || u.role !== "student").map(pub);
      },
      async getUser(id) { need(me && (id === me.id || isStaffFor(id) || me.role !== "student")); return pub(db.users.find(u => u.id === id)); },
      async createUser(o) {
        need(me && me.role === "superadmin"); const username = (o.username || "").trim().toLowerCase();
        if (!o.full_name) throw new Error("Nom complet requis");
        if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error("Identifiant : 3 à 30 caractères (lettres sans accents, chiffres, . _ -)");
        if ((o.password || "").length < 6) throw new Error("Mot de passe : 6 caractères minimum");
        if (db.users.some(u => u.username === username)) throw new Error("Cet identifiant est déjà pris");
        const u = { id: uid(), username, password: o.password, full_name: o.full_name, role: o.role || "student", class_id: o.class_id || null, mentor_id: o.role === "student" ? o.mentor_id || null : null, active: true, created_at: now() };
        db.users.push(u); save(); return pub(u);
      },
      async updateUser(id, patch) {
        const u = db.users.find(x => x.id === id); need(u);
        need(me.role === "superadmin" || (isStaffFor(id) && !("role" in patch) && !("active" in patch) && !("mentor_id" in patch)) || (id === me.id && Object.keys(patch).every(k => k === "full_name")));
        Object.assign(u, patch); save(); return pub(u);
      },
      async setPassword(id, pw) { need(me.role === "superadmin" || isStaffFor(id)); if (pw.length < 6) throw new Error("6 caractères minimum"); db.users.find(u => u.id === id).password = pw; save(); },
      async deleteUser(id) { need(me.role === "superadmin"); db.users = db.users.filter(u => u.id !== id); save(); },
      // classes
      async listClasses() { need(me); return db.classes.filter(c => me.role !== "student" || c.id === me.class_id); },
      async saveClass(c) { need(me.role === "superadmin"); if (c.id) Object.assign(db.classes.find(x => x.id === c.id), c); else db.classes.push({ ...c, id: uid(), created_at: now() }); save(); },
      async deleteClass(id) { need(me.role === "superadmin"); db.classes = db.classes.filter(c => c.id !== id); db.unlocks = db.unlocks.filter(u => u.class_id !== id); save(); },
      // déblocages
      async listUnlocks() { need(me); return db.unlocks.filter(u => me.role === "superadmin" || u.student_id === me.id || u.class_id === me.class_id || me.role === "admin"); },
      async setUnlock({ class_id, student_id }, lesson, on) {
        need(me.role === "superadmin" || (class_id && (db.classes.find(c => c.id === class_id) || {}).mentor_id === me.id) || (student_id && isStaffFor(student_id)));
        db.unlocks = db.unlocks.filter(u => !(u.lesson === lesson && (class_id ? u.class_id === class_id : u.student_id === student_id)));
        if (on) db.unlocks.push({ id: uid(), class_id: class_id || null, student_id: student_id || null, lesson, unlocked_by: me.id, created_at: now() });
        save();
      },
      // réponses
      async getAnswers(sid, lesson) { need(sid === me.id || isStaffFor(sid)); return db.answers.find(a => a.student_id === sid && a.lesson === lesson) || null; },
      async saveAnswers(sid, lesson, data, submitted) {
        need(sid === me.id); let a = db.answers.find(x => x.student_id === sid && x.lesson === lesson);
        if (!a) { a = { student_id: sid, lesson, data: {}, submitted: false }; db.answers.push(a); }
        a.data = data; a.updated_at = now(); if (submitted) { a.submitted = true; a.submitted_at = now(); } save(); return a;
      },
      async listAnswersMeta(ids) { return db.answers.filter(a => ids.includes(a.student_id) && (a.student_id === me.id || isStaffFor(a.student_id))).map(({ data, ...r }) => ({ ...r, filled: Object.keys(data || {}).length })); },
      // corrections
      async getReview(sid, lesson) { need(sid === me.id || isStaffFor(sid)); return db.reviews.find(r => r.student_id === sid && r.lesson === lesson) || null; },
      async saveReview(sid, lesson, patch) {
        need(isStaffFor(sid)); let r = db.reviews.find(x => x.student_id === sid && x.lesson === lesson);
        if (!r) { r = { student_id: sid, lesson, items: {}, general: "", validated: false }; db.reviews.push(r); }
        Object.assign(r, patch, { mentor_id: me.id, updated_at: now() }); save(); return r;
      },
      async listReviews(ids) { return db.reviews.filter(r => ids.includes(r.student_id) && (r.student_id === me.id || isStaffFor(r.student_id))); },
      // tests
      async addQuiz(sid, lesson, score, total, detail) { need(sid === me.id); db.quiz.push({ id: uid(), student_id: sid, lesson, score, total, detail, created_at: now() }); save(); },
      async listQuiz(ids) { return db.quiz.filter(q => ids.includes(q.student_id) && (q.student_id === me.id || isStaffFor(q.student_id))); },
      // messages
      async listMessages(ids) { return db.messages.filter(m => ids.includes(m.student_id) && (m.student_id === me.id || isStaffFor(m.student_id))).sort((a, b) => a.created_at.localeCompare(b.created_at)); },
      async postMessage(sid, lesson, item_key, body) {
        need(sid === me.id || isStaffFor(sid));
        const m = { id: uid(), student_id: sid, lesson, item_key, author_id: me.id, body, read_by_student: sid === me.id, read_by_staff: sid !== me.id, created_at: now() };
        db.messages.push(m); save(); return m;
      },
      async markRead(ids, asStaff) { db.messages.forEach(m => { if (ids.includes(m.id)) m[asStaff ? "read_by_staff" : "read_by_student"] = true; }); save(); },
    };
  }

  // =============================== MODE SERVEUR ===============================
  function ServerApi() {
    let me = null;
    async function call(method, url, body) {
      let r;
      try { r = await fetch(url, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); }
      catch (e) { throw new Error("Connexion impossible. Vérifie ta connexion Internet."); }
      let data = null; try { data = await r.json(); } catch (e) { }
      if (!r.ok) { if (r.status === 401 && me && !/login|signup/.test(url)) { me = null; setTimeout(() => location.reload(), 1500); } throw new Error((data && data.error) || "Erreur " + r.status); }
      return data;
    }
    const ids = (a) => encodeURIComponent(a.join(","));
    return {
      mode: "server",
      async me() { if (!me) { try { me = await call("GET", "/api/me"); } catch (e) { me = null; } } return me; },
      async signIn(username, password) { me = await call("POST", "/api/login", { username, password }); return me; },
      async signUp(o) { me = await call("POST", "/api/signup", o); return me; },
      async signOut() { try { await call("POST", "/api/logout"); } catch (e) { } me = null; },
      async changeMyPassword(pw) { await call("POST", "/api/me/password", { password: pw }); },
      async listUsers() { return call("GET", "/api/users"); },
      async getUser(id) { return call("GET", "/api/users/" + id); },
      async createUser(o) { return call("POST", "/api/users", o); },
      async updateUser(id, patch) { const u = await call("PATCH", "/api/users/" + id, patch); if (me && u && u.id === me.id) me = u; return u; },
      async setPassword(id, pw) { await call("POST", "/api/users/" + id + "/password", { password: pw }); },
      async deleteUser(id) { await call("DELETE", "/api/users/" + id); },
      async listClasses() { return call("GET", "/api/classes"); },
      async saveClass(c) { return call("POST", "/api/classes", c); },
      async deleteClass(id) { await call("DELETE", "/api/classes/" + id); },
      async listUnlocks() { return call("GET", "/api/unlocks"); },
      async setUnlock(t, lesson, on) { await call("POST", "/api/unlocks", { class_id: t.class_id || null, student_id: t.student_id || null, lesson, on }); },
      async getAnswers(sid, lesson) { return call("GET", "/api/answers/" + sid + "/" + lesson); },
      async saveAnswers(sid, lesson, data, submitted) { return call("PUT", "/api/answers/" + sid + "/" + lesson, { data, submitted: !!submitted }); },
      async listAnswersMeta(a) { return a.length ? call("GET", "/api/answers-meta?ids=" + ids(a)) : []; },
      async getReview(sid, lesson) { return call("GET", "/api/reviews/" + sid + "/" + lesson); },
      async saveReview(sid, lesson, patch) { return call("PUT", "/api/reviews/" + sid + "/" + lesson, patch); },
      async listReviews(a) { return a.length ? call("GET", "/api/reviews?ids=" + ids(a)) : []; },
      async addQuiz(sid, lesson, score, total, detail) { await call("POST", "/api/quiz", { lesson, score, total, detail }); },
      async listQuiz(a) { return a.length ? call("GET", "/api/quiz?ids=" + ids(a)) : []; },
      async listMessages(a) { return a.length ? call("GET", "/api/messages?ids=" + ids(a)) : []; },
      async postMessage(sid, lesson, item_key, body) { return call("POST", "/api/messages", { student_id: sid, lesson, item_key, body }); },
      async markRead(a, asStaff) { if (a.length) await call("POST", "/api/messages/read", { ids: a, staff: !!asStaff }); },
    };
  }

  window.API = CFG.server ? ServerApi() : DemoApi();
})();
