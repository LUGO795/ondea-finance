/* ==========================================================================
   Ondea Finance — Connexion par mot de passe (ajout v1.1)
   --------------------------------------------------------------------------
   • Premier lancement : création du mot de passe (8 caractères minimum).
   • Ensuite : accès à l'application uniquement avec le bon mot de passe.
   • Mot de passe jamais stocké en clair : empreinte PBKDF2-SHA-256
     (210 000 itérations, sel aléatoire de 16 octets) via WebCrypto.
   • Anti-force brute : temporisation croissante après 5 échecs.
   • Session limitée à l'onglet + verrouillage automatique après inactivité.
   • Intégration sans modifier app.js : le démarrage de l'application
     (O.App.boot) est différé jusqu'au déverrouillage.
   ========================================================================== */
(function (O) {
  'use strict';
  const P = O.config.storagePrefix;
  const KEY = P + 'auth', SESSION = P + 'session', SETTINGS = P + 'settings';
  const ITER = 210000, MIN_LEN = 8, MAX_FAILS = 5;
  const FONT_STEPS = [90, 100, 110, 120, 135];
  const U = O.U;
  const ic = (n) => O.icon(n);
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

  /* ---------------- Stockage ---------------- */
  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
    sget(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    sset(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  const settings = () => store.get(SETTINGS, {}) || {};
  const saveSetting = (patch) => {
    store.set(SETTINGS, Object.assign(settings(), patch));
    if (O.Store && O.Store.driver) Object.assign(O.Store.settings, patch);
  };

  /* ---------------- Cryptographie ---------------- */
  const b64 = (buf) => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const enc = (s) => new TextEncoder().encode(s);
  const hasSubtle = () => !!(window.crypto && crypto.subtle && crypto.subtle.importKey);

  /** SHA-256 en JavaScript pur (repli si WebCrypto indisponible, ex. contexte non sécurisé) */
  function sha256(bytes) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const l = bytes.length, withPad = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(withPad);
    m.set(bytes); m[l] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(withPad - 4, (l * 8) >>> 0); dv.setUint32(withPad - 8, Math.floor((l * 8) / 4294967296));
    const w = new Uint32Array(64), rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < withPad; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    const out = new Uint8Array(32), odv = new DataView(out.buffer); H.forEach((x, i) => odv.setUint32(i * 4, x)); return out;
  }
  async function derive(password, salt, algo, iter) {
    if (algo === 'PBKDF2-SHA256') {
      const key = await crypto.subtle.importKey('raw', enc(password), 'PBKDF2', false, ['deriveBits']);
      return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
    }
    // Repli : SHA-256 itéré (sel + mot de passe)
    const pw = enc(password); let h = new Uint8Array(salt.length + pw.length); h.set(salt); h.set(pw, salt.length);
    for (let i = 0; i < iter; i++) { const x = new Uint8Array(h.length + pw.length); x.set(h); x.set(pw, h.length); h = sha256(x); }
    return h;
  }
  const same = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]; return r === 0; };
  const randomBytes = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };

  /* ---------------- Mots de passe ---------------- */
  function strength(pw) {
    const rules = { len: pw.length >= MIN_LEN, case: /[a-z]/.test(pw) && /[A-Z]/.test(pw), digit: /\d/.test(pw), sym: /[^A-Za-z0-9]/.test(pw) };
    let s = Object.values(rules).filter(Boolean).length;
    if (pw.length >= 14 && s >= 3) s = 4;
    if (!pw) s = 0;
    return { score: Math.min(4, s), rules, label: ['—', 'Faible', 'Moyen', 'Bon', 'Excellent'][Math.min(4, s)] };
  }

  const Auth = {
    record() { return store.get(KEY, null); },
    hasPassword() { const r = this.record(); return !!(r && r.hash && r.salt); },
    autoLockMin() { const r = this.record(); return r && r.autoLockMin != null ? r.autoLockMin : 30; },
    async setPassword(pw) {
      const algo = hasSubtle() ? 'PBKDF2-SHA256' : 'SHA256-ITER', iter = algo === 'PBKDF2-SHA256' ? ITER : 20000;
      const salt = randomBytes(16), hash = await derive(pw, salt, algo, iter);
      const prev = this.record() || {};
      store.set(KEY, { v: 1, algo, iter, salt: b64(salt), hash: b64(hash), createdAt: prev.createdAt || new Date().toISOString(), changedAt: new Date().toISOString(), fails: 0, lockUntil: 0, autoLockMin: prev.autoLockMin != null ? prev.autoLockMin : 30 });
      this.openSession();
    },
    async verify(pw) {
      const r = this.record(); if (!r) return false;
      const h = await derive(pw, unb64(r.salt), r.algo, r.iter);
      return same(h, unb64(r.hash));
    },
    lockRemaining() { const r = this.record(); return r && r.lockUntil ? Math.max(0, r.lockUntil - Date.now()) : 0; },
    registerFail() {
      const r = this.record(); r.fails = (r.fails || 0) + 1;
      if (r.fails >= MAX_FAILS) r.lockUntil = Date.now() + Math.min(15 * 60000, 30000 * Math.pow(2, r.fails - MAX_FAILS));
      store.set(KEY, r); return r;
    },
    resetFails() { const r = this.record(); r.fails = 0; r.lockUntil = 0; store.set(KEY, r); },
    setAutoLock(min) { const r = this.record(); r.autoLockMin = min; store.set(KEY, r); this.touch(); },
    /* Session de l'onglet, invalidée si le mot de passe change */
    openSession() { const r = this.record(); store.sset(SESSION, { tag: r.hash.slice(0, 12), at: Date.now() }); this.touch(); },
    sessionValid() {
      const r = this.record(), s = store.sget(SESSION);
      if (!r || !s || s.tag !== r.hash.slice(0, 12)) return false;
      const lim = this.autoLockMin();
      return !(lim > 0 && Date.now() - (s.last || s.at) > lim * 60000);
    },
    touch() { const s = store.sget(SESSION); if (s) { s.last = Date.now(); store.sset(SESSION, s); } },
    closeSession() { store.sset(SESSION, null); },

    /* ---------------- Interface ---------------- */
    el: null, resolve: null, booted: false,
    gate() {
      if (this.hasPassword() && this.sessionValid()) { this.touch(); return Promise.resolve(); }
      return new Promise((res) => { this.resolve = res; this.show(this.hasPassword() ? 'login' : 'setup'); });
    },
    lock(reason) {
      if (!this.hasPassword() || this.el) return;
      this.closeSession();
      O.UI && document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());
      document.body.style.overflow = '';
      this.show('login', reason);
    },
    setInert(on) {
      ['app', 'modalRoot', 'boot', 'toasts'].forEach((id) => { const e = document.getElementById(id); if (e) { if (on) e.setAttribute('inert', ''); else e.removeAttribute('inert'); } });
    },
    show(mode, reason) {
      if (this.el) this.el.remove();
      const s = settings(), fs = s.fontScale || 100;
      const brandName = (O.Brand && O.Brand.name()) || 'Ondea Finance';
      const company = s.companyName || '';
      const wrap = document.createElement('div');
      wrap.className = 'auth';
      wrap.id = 'auth';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.setAttribute('aria-labelledby', 'authTitle');
      wrap.innerHTML =
        '<section class="auth-hero" aria-label="Présentation">' +
        '<span class="auth-orb o1" aria-hidden="true"></span><span class="auth-orb o2" aria-hidden="true"></span>' +
        '<svg class="auth-waves" viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden="true"><path class="w1" d="M0 260 C 200 160, 400 360, 600 250 S 1000 140, 1200 240"/><path class="w2" d="M0 300 C 220 220, 420 380, 640 300 S 1020 200, 1200 290"/><path class="w3" d="M0 340 C 240 280, 460 400, 680 340 S 1040 260, 1200 330"/></svg>' +
        '<div class="auth-brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3 15c3-5 6-5 9 0s6 5 9 0"/><path d="M3 9c3-5 6-5 9 0s6 5 9 0" opacity=".55"/></svg></span><span class="brand-name">Ondea Finance<small>Pilotage financier</small></span></div>' +
        '<div class="auth-pitch"><div class="eyebrow">' + U.esc(company || 'Espace sécurisé') + '</div><h1>Pilotez vos finances <em>en toute sérénité</em>.</h1><p>Dépenses, recettes, factures, trésorerie et budgets réunis dans un espace privé, protégé par votre mot de passe.</p>' +
        '<ul class="auth-feats"><li><span class="ic">' + ic('wallet') + '</span>Trésorerie et prévisionnel en temps réel</li><li><span class="ic">' + ic('invoice') + '</span>Factures, échéances et relances maîtrisées</li><li><span class="ic">' + ic('vault') + '</span>Coffre-fort de justificatifs intégré</li><li><span class="ic">' + ic('shield') + '</span>Données conservées sur cet appareil</li></ul></div>' +
        '<div class="auth-foot">' + ic('lock') + '<span>Mot de passe protégé par empreinte PBKDF2-SHA-256 · aucune donnée envoyée sur Internet</span></div>' +
        '</section>' +
        '<section class="auth-side">' +
        '<div class="auth-tools"><div class="font-ctrl" role="group" aria-label="Taille du texte"><button type="button" data-af="-1" aria-label="Diminuer la taille du texte">A−</button><output aria-live="polite" data-afv>' + fs + ' %</output><button type="button" data-af="1" aria-label="Agrandir la taille du texte">A+</button></div>' +
        '<button type="button" class="icon-btn" data-atheme></button></div>' +
        '<div class="auth-card" data-card></div>' +
        '</section>';
      document.body.appendChild(wrap);
      this.el = wrap;
      this.setInert(true);
      this.syncTools();
      this.renderCard(mode, reason);
      if (O.Brand) O.Brand.apply(wrap);
      wrap.querySelectorAll('.auth-brand .brand-name').forEach((n) => { if (n.firstChild && n.firstChild.nodeType === 3) n.firstChild.textContent = brandName; });
      wrap.addEventListener('click', (e) => {
        const f = e.target.closest('[data-af]'); if (f) this.stepFont(Number(f.dataset.af));
        if (e.target.closest('[data-atheme]')) this.toggleTheme();
      });
    },
    syncTools() {
      if (!this.el) return;
      const t = document.documentElement.getAttribute('data-theme') || 'dark';
      const b = this.el.querySelector('[data-atheme]');
      b.innerHTML = ic(t === 'light' ? 'moon' : 'sun');
      b.setAttribute('aria-label', t === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair');
      b.title = b.getAttribute('aria-label');
      const fs = settings().fontScale || 100;
      this.el.querySelector('[data-afv]').textContent = fs + ' %';
      this.el.querySelector('[data-af="-1"]').disabled = fs <= FONT_STEPS[0];
      this.el.querySelector('[data-af="1"]').disabled = fs >= FONT_STEPS[FONT_STEPS.length - 1];
    },
    stepFont(dir) {
      const cur = settings().fontScale || 100;
      const next = dir > 0 ? (FONT_STEPS.find((x) => x > cur) || 135) : (FONT_STEPS.slice().reverse().find((x) => x < cur) || 90);
      document.documentElement.style.setProperty('--scale', next / 100);
      saveSetting({ fontScale: next });
      this.syncTools();
      if (O.App && this.booted && O.App.setFont) O.App.setFont(next, true);
    },
    toggleTheme() {
      const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
      const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', t === 'light' ? '#F6F3EB' : '#090B0F');
      saveSetting({ theme: t });
      if (O.App && this.booted && O.App.setTheme) O.App.setTheme(t, true);
      this.syncTools();
    },
    pwField(name, label, opts) {
      const o = opts || {}, id = 'auth-' + name;
      return '<div class="field"><label for="' + id + '">' + U.esc(label) + '</label><div class="pw-wrap"><input id="' + id + '" name="' + name + '" type="password" autocomplete="' + (o.auto || 'current-password') + '" required aria-required="true" spellcheck="false" autocapitalize="off" aria-describedby="' + id + '-caps' + (o.describe ? ' ' + o.describe : '') + '"' + (o.autofocus ? ' autofocus' : '') + '>' +
        '<button type="button" class="pw-toggle" data-pw="' + id + '" aria-controls="' + id + '" aria-pressed="false" aria-label="Afficher le mot de passe" title="Afficher le mot de passe">' + ic('eye') + '</button></div>' +
        '<div class="caps" id="' + id + '-caps" aria-live="polite">' + ic('alert') + '<span>Verrouillage majuscules activé</span></div></div>';
    },
    renderCard(mode, reason) {
      const card = this.el.querySelector('[data-card]');
      const msg = '<div class="alert danger auth-msg" role="alert" data-msg>' + ic('alert') + '<p data-msgtxt></p></div>';
      if (mode === 'setup') {
        card.innerHTML = '<div class="lock-badge" aria-hidden="true">' + ic('shield') + '</div><h2 id="authTitle">Sécurisez votre espace</h2><p class="sub">Créez le mot de passe qui protégera l’accès à vos données financières sur cet appareil.</p>' + msg +
          '<form novalidate data-form="setup">' + this.pwField('pw', 'Nouveau mot de passe', { auto: 'new-password', autofocus: true, describe: 'auth-rules' }) +
          '<div class="strength" data-s="0" aria-hidden="true"><span></span><span></span><span></span><span></span></div><p class="small muted" style="margin:.35rem 0 0" aria-live="polite">Robustesse : <strong data-slabel>—</strong></p>' +
          '<ul class="rules" id="auth-rules"><li data-r="len">8 caractères minimum</li><li data-r="case">Majuscules et minuscules</li><li data-r="digit">Au moins un chiffre</li><li data-r="sym">Au moins un symbole</li></ul><div style="height:1rem"></div>' +
          this.pwField('pw2', 'Confirmer le mot de passe', { auto: 'new-password' }) +
          '<button type="submit" class="btn btn-primary">' + ic('lock') + 'Créer le mot de passe et entrer</button></form>' +
          '<p class="small muted mt" style="margin-bottom:0">Conservez-le précieusement : sans lui, les données ne peuvent être rouvertes qu’après réinitialisation complète.</p>';
      } else if (mode === 'forgot') {
        card.innerHTML = '<div class="lock-badge" aria-hidden="true" style="background:var(--danger-soft);color:var(--danger);box-shadow:none">' + ic('alert') + '</div><h2 id="authTitle">Mot de passe oublié</h2><p class="sub">Pour protéger vos données, le mot de passe ne peut pas être récupéré. Vous pouvez réinitialiser l’application : <strong>toutes les données et tous les justificatifs de cet appareil seront définitivement effacés</strong>.</p>' + msg +
          '<form novalidate data-form="forgot"><div class="field"><label for="auth-confirm">Tapez <strong class="mono">EFFACER</strong> pour confirmer</label><input id="auth-confirm" name="confirm" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" required autofocus></div>' +
          '<button type="submit" class="btn btn-danger" style="width:100%;min-height:52px">' + ic('trash') + 'Effacer et réinitialiser</button></form>' +
          '<div class="auth-links"><button type="button" class="link-btn" data-go="login">' + '← Retour à la connexion</button></div>';
      } else {
        card.innerHTML = '<div class="lock-badge" aria-hidden="true">' + ic('lock') + '</div><h2 id="authTitle">' + (reason === 'idle' ? 'Session verrouillée' : 'Connexion') + '</h2><p class="sub">' + (reason === 'idle' ? 'Votre session a été verrouillée après une période d’inactivité. Saisissez votre mot de passe pour reprendre.' : reason === 'manual' ? 'Application verrouillée. Saisissez votre mot de passe pour continuer.' : 'Saisissez votre mot de passe pour accéder à votre espace financier.') + '</p>' + msg +
          '<form novalidate data-form="login">' + this.pwField('pw', 'Mot de passe', { autofocus: true }) +
          '<button type="submit" class="btn btn-primary">' + ic('chevronRight') + 'Déverrouiller</button></form>' +
          '<div class="auth-links"><span class="muted">' + ic('shield').replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px;color:var(--gold)"') + ' Accès protégé</span><button type="button" class="link-btn" data-go="forgot">Mot de passe oublié ?</button></div>';
      }
      this.bindCard(card, mode);
      const lr = this.lockRemaining();
      if (mode === 'login' && lr) this.countdown(card);
      requestAnimationFrame(() => { const f = card.querySelector('[autofocus]'); if (f) f.focus({ preventScroll: true }); if (this.el) this.el.scrollTop = 0; });
    },
    say(card, text, type) {
      const box = card.querySelector('[data-msg]');
      box.className = 'alert ' + (type || 'danger') + ' auth-msg' + (text ? ' show' : '');
      card.querySelector('[data-msgtxt]').textContent = text || '';
    },
    shake(card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); },
    countdown(card) {
      const btn = card.querySelector('button[type="submit"]');
      const tick = () => {
        const ms = this.lockRemaining();
        if (!ms || !document.contains(btn)) { btn.disabled = false; if (ms === 0) this.say(card, ''); return; }
        btn.disabled = true;
        this.say(card, 'Trop de tentatives incorrectes. Nouvel essai possible dans ' + Math.ceil(ms / 1000) + ' s.', 'warn');
        setTimeout(tick, 1000);
      };
      tick();
    },
    bindCard(card, mode) {
      card.querySelectorAll('[data-pw]').forEach((b) => b.addEventListener('click', () => {
        const input = document.getElementById(b.dataset.pw), show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        b.setAttribute('aria-pressed', String(show));
        b.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
        b.title = b.getAttribute('aria-label');
        b.innerHTML = show ? EYE_OFF : ic('eye');
        input.focus();
        const v = input.value.length; try { input.setSelectionRange(v, v); } catch (e) { /* champ texte */ }
      }));
      card.querySelectorAll('input[type="password"]').forEach((i) => {
        const caps = (e) => { const c = document.getElementById(i.id + '-caps'); if (c && e.getModifierState) c.classList.toggle('show', e.getModifierState('CapsLock')); };
        i.addEventListener('keydown', caps); i.addEventListener('keyup', caps);
      });
      card.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => this.renderCard(b.dataset.go)));
      const form = card.querySelector('form');
      form.addEventListener('input', (e) => {
        if (e.target.getAttribute('aria-invalid') === 'true') e.target.setAttribute('aria-invalid', 'false');
        if (!this.lockRemaining()) this.say(card, '');
      });
      if (mode === 'setup') {
        const pw = form.querySelector('[name="pw"]');
        pw.addEventListener('input', () => {
          const s = strength(pw.value);
          card.querySelector('.strength').dataset.s = s.score;
          card.querySelector('[data-slabel]').textContent = s.label;
          Object.keys(s.rules).forEach((k) => card.querySelector('[data-r="' + k + '"]').classList.toggle('ok', s.rules[k]));
        });
      }
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        if (btn.disabled) return;
        if (mode === 'forgot') {
          if (form.confirm.value.trim().toUpperCase() !== 'EFFACER') { this.say(card, 'Saisissez exactement EFFACER pour confirmer.'); this.shake(card); form.confirm.focus(); return; }
          btn.disabled = true;
          await this.wipe();
          return;
        }
        const pw = form.pw.value;
        if (mode === 'setup') {
          const s = strength(pw);
          if (pw.length < MIN_LEN) { this.say(card, 'Le mot de passe doit contenir au moins ' + MIN_LEN + ' caractères.'); this.shake(card); form.pw.setAttribute('aria-invalid', 'true'); form.pw.focus(); return; }
          if (s.score < 2) { this.say(card, 'Mot de passe trop faible : ajoutez majuscules, chiffres ou symboles.'); this.shake(card); form.pw.setAttribute('aria-invalid', 'true'); form.pw.focus(); return; }
          if (pw !== form.pw2.value) { this.say(card, 'Les deux mots de passe ne correspondent pas.'); this.shake(card); form.pw2.setAttribute('aria-invalid', 'true'); form.pw2.focus(); return; }
          btn.disabled = true; btn.setAttribute('aria-busy', 'true');
          try { await this.setPassword(pw); this.unlock(card); } catch (err) { btn.disabled = false; this.say(card, 'Impossible d’enregistrer le mot de passe : ' + err.message); }
          return;
        }
        if (!pw) { this.say(card, 'Saisissez votre mot de passe.'); this.shake(card); form.pw.setAttribute('aria-invalid', 'true'); form.pw.focus(); return; }
        if (this.lockRemaining()) { this.countdown(card); return; }
        btn.disabled = true; btn.setAttribute('aria-busy', 'true');
        const ok = await this.verify(pw).catch(() => false);
        btn.removeAttribute('aria-busy');
        if (ok) { this.resetFails(); this.openSession(); this.unlock(card); return; }
        const r = this.registerFail();
        btn.disabled = false;
        form.pw.value = ''; form.pw.setAttribute('aria-invalid', 'true'); form.pw.focus();
        this.shake(card);
        if (r.lockUntil > Date.now()) this.countdown(card);
        else this.say(card, 'Mot de passe incorrect. ' + (MAX_FAILS - r.fails > 0 ? (MAX_FAILS - r.fails) + ' tentative(s) avant temporisation.' : ''));
      });
    },
    unlock(card) {
      const badge = card.querySelector('.lock-badge'); if (badge) { badge.innerHTML = ic('check'); badge.classList.add('auth-unlocked'); }
      setTimeout(() => {
        const el = this.el; if (!el) return;
        el.classList.add('leaving');
        this.setInert(false);
        setTimeout(() => {
          el.remove(); this.el = null;
          if (this.resolve) { const r = this.resolve; this.resolve = null; r(); }
          const main = document.getElementById('main'); if (main && this.booted) main.focus({ preventScroll: true });
        }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420);
      }, 380);
    },
    async wipe() {
      try { Object.keys(localStorage).filter((k) => k.startsWith(P)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
      this.closeSession();
      await new Promise((res) => { try { const r = indexedDB.deleteDatabase(O.config.idbName); r.onsuccess = r.onerror = r.onblocked = () => res(); } catch (e) { res(); } });
      location.reload();
    },

    /* ---- Après démarrage : bouton de verrouillage + verrouillage auto ---- */
    afterBoot() {
      this.booted = true;
      const actions = document.querySelector('.topbar-actions');
      if (actions && !document.getElementById('lockBtn')) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'icon-btn'; b.id = 'lockBtn';
        b.setAttribute('aria-label', 'Verrouiller l’application'); b.title = 'Verrouiller l’application';
        b.innerHTML = ic('lock');
        b.addEventListener('click', () => this.lock('manual'));
        actions.insertBefore(b, document.getElementById('themeBtn'));
      }
      let last = 0;
      const act = () => { const n = Date.now(); if (n - last > 5000 && !this.el) { last = n; this.touch(); } };
      ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'].forEach((ev) => document.addEventListener(ev, act, { passive: true }));
      setInterval(() => { if (!this.el && this.hasPassword() && !this.sessionValid()) this.lock('idle'); }, 15000);
      document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); this.lock('manual'); } });
    },
    strength
  };

  /* ---- Différer le démarrage de l'application jusqu'au déverrouillage ---- */
  let app = null;
  Object.defineProperty(O, 'App', {
    configurable: true,
    get() { return app; },
    set(v) {
      app = v;
      if (v && typeof v.boot === 'function' && !v.__gated) {
        const boot = v.boot;
        v.boot = async function () { await Auth.gate(); const r = await boot.apply(this, arguments); Auth.afterBoot(); return r; };
        v.__gated = true;
      }
    }
  });

  O.Auth = Auth;
})(window.Ondea);
