/* ==========================================================================
   Ondea Finance — Application : démarrage, routeur, navigation, thème,
   taille du texte, recherche globale, raccourcis.
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, UI = O.UI;

  const ROUTES = [
    { group: 'Pilotage' },
    { path: 'tableau-de-bord', view: 'dashboard', label: 'Tableau de bord', icon: 'dashboard' },
    { path: 'operations', view: 'operations', label: 'Dépenses & recettes', icon: 'swap' },
    { path: 'factures', view: 'invoices', label: 'Factures', icon: 'invoice', badge: () => O.F.openInvoices('client').concat(O.F.openInvoices('fournisseur')).filter((i) => i.dueDate < U.today()).length },
    { path: 'echeancier', view: 'schedules', label: 'Échéancier', icon: 'calendar', badge: () => S.all('schedules').filter((s) => s.active && s.nextDate <= U.today()).length },
    { group: 'Finances' },
    { path: 'tresorerie', view: 'treasury', label: 'Trésorerie', icon: 'wallet' },
    { path: 'budgets', view: 'budgets', label: 'Budgets', icon: 'target' },
    { path: 'rapports', view: 'reports', label: 'Rapports', icon: 'chart' },
    { group: 'Données' },
    { path: 'tiers', view: 'thirdparties', label: 'Fournisseurs & clients', icon: 'users' },
    { path: 'referentiels', view: 'referentials', label: 'Catégories & paiements', icon: 'tags' },
    { path: 'coffre-fort', view: 'vault', label: 'Coffre-fort', icon: 'vault' },
    { path: 'parametres', view: 'settings', label: 'Paramètres', icon: 'settings' }
  ];
  const FONT_STEPS = [90, 100, 110, 120, 135];

  const App = {
    current: null,
    renderNav() {
      const nav = document.getElementById('nav');
      let h = '', open = false;
      ROUTES.forEach((r) => {
        if (r.group) { h += (open ? '</div>' : '') + '<div class="nav-group"><div class="nav-label">' + r.group + '</div>'; open = true; return; }
        const n = r.badge ? r.badge() : 0;
        h += '<a href="#' + r.path + '" data-path="' + r.path + '">' + O.icon(r.icon) + '<span>' + r.label + '</span>' + (n ? '<span class="badge b-danger plain" aria-label="' + n + ' en attente">' + n + '</span>' : '') + '</a>';
      });
      nav.innerHTML = h + (open ? '</div>' : '');
      this.markNav();
    },
    markNav() {
      U.$$('#nav a').forEach((a) => { if (this.current && a.dataset.path === this.current.path) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    },
    parseHash() {
      const raw = location.hash.replace(/^#\/?/, '');
      const [path, qs] = raw.split('?');
      const params = {};
      new URLSearchParams(qs || '').forEach((v, k) => { params[k] = v; });
      return { path: path || 'tableau-de-bord', params };
    },
    async route() {
      const { path, params } = this.parseHash();
      const r = ROUTES.find((x) => x.path === path) || ROUTES[1];
      const changed = !this.current || this.current.path !== r.path;
      if (changed && this.current && O.Views[this.current.view].leave) O.Views[this.current.view].leave();
      this.current = r;
      document.title = r.label + ' — Ondea Finance';
      this.markNav();
      await this.paint(params);
      if (changed) {
        const main = document.getElementById('main');
        window.scrollTo({ top: 0 });
        main.focus({ preventScroll: true });
        this.closeMenu();
      }
    },
    async paint(params) {
      const main = document.getElementById('main');
      const root = document.createElement('div');
      const y = window.scrollY;
      try { await O.Views[this.current.view].render(root, params || {}); }
      catch (e) { console.error(e); root.innerHTML = '<div class="alert danger">' + O.icon('alert') + '<p>Erreur d’affichage : ' + U.esc(e.message) + '</p></div>'; }
      main.replaceChildren(root);
      O.hydrateIcons(root);
      window.scrollTo({ top: y });
    },
    /** Re-rendu de la vue courante (après modification des données) */
    refresh() { return this.current ? this.paint() : Promise.resolve(); },

    /* ---- Thème & taille du texte ---- */
    setTheme(t, silent) {
      document.documentElement.setAttribute('data-theme', t);
      document.querySelector('meta[name="theme-color"]').setAttribute('content', t === 'light' ? '#F6F3EB' : '#090B0F');
      const btn = document.getElementById('themeBtn');
      btn.innerHTML = O.icon(t === 'light' ? 'moon' : 'sun');
      btn.setAttribute('aria-label', t === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair');
      btn.title = btn.getAttribute('aria-label');
      if (!silent) S.saveSettings({ theme: t });
    },
    setFont(v, preview) {
      const val = U.clamp(v, 90, 135);
      document.documentElement.style.setProperty('--scale', val / 100);
      document.getElementById('fontVal').textContent = val + ' %';
      document.getElementById('fontDown').disabled = val <= FONT_STEPS[0];
      document.getElementById('fontUp').disabled = val >= FONT_STEPS[FONT_STEPS.length - 1];
      if (!preview) S.settings.fontScale !== val && S.saveSettings({ fontScale: val });
    },
    stepFont(dir) {
      const cur = S.settings.fontScale || 100;
      let next;
      if (dir > 0) next = FONT_STEPS.find((s) => s > cur) || 135;
      else next = FONT_STEPS.slice().reverse().find((s) => s < cur) || 90;
      this.setFont(next);
      UI.toast('Taille du texte : ' + next + ' %', 'info');
    },
    applyAppearance() {
      const t = S.settings.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      this.setTheme(t, true);
      this.setFont(S.settings.fontScale || 100, true);
    },

    /* ---- Menu mobile ---- */
    openMenu() { document.getElementById('sidebar').classList.add('open'); document.getElementById('scrim').classList.add('show'); document.getElementById('menuBtn').setAttribute('aria-expanded', 'true'); const a = document.querySelector('#nav a'); if (a) a.focus(); },
    closeMenu() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('scrim').classList.remove('show'); document.getElementById('menuBtn').setAttribute('aria-expanded', 'false'); },

    /* ---- Indicateur de stockage (barre latérale) ---- */
    updateStorage() {
      const used = O.Files.used(), q = O.Files.quota(), pct = Math.min(100, (used / q) * 100);
      document.getElementById('storageMiniPct').textContent = U.pct(pct);
      document.getElementById('storageMiniBar').style.width = Math.max(1, pct) + '%';
      document.getElementById('storageMiniTxt').textContent = O.Files.all().length + ' fichier(s) · ' + U.bytes(used) + ' / ' + U.bytes(q);
    },

    /* ---- Recherche globale ---- */
    initSearch() {
      const input = document.getElementById('globalSearch'), box = document.getElementById('searchResults');
      let items = [], active = -1;
      const close = () => { box.classList.remove('open'); input.setAttribute('aria-expanded', 'false'); active = -1; };
      const go = (it) => { close(); input.value = ''; it.go(); };
      const draw = () => {
        const q = U.norm(input.value.trim());
        if (q.length < 2) { close(); return; }
        const words = q.split(/\s+/);
        const match = (s) => words.every((w) => U.norm(s).includes(w));
        const tx = S.all('transactions').filter((t) => match(t.label + ' ' + (t.reference || '') + ' ' + S.name('thirdParties', t.thirdPartyId, ''))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
        const inv = S.all('invoices').filter((i) => match(i.number + ' ' + i.label + ' ' + S.name('thirdParties', i.thirdPartyId, ''))).slice(0, 4);
        const tps = S.all('thirdParties').filter((t) => match(t.name + ' ' + (t.city || ''))).slice(0, 4);
        const fls = O.Files.all().filter((f) => match(f.name)).slice(0, 3);
        items = [];
        let h = '';
        const grp = (title, arr, fn) => { if (!arr.length) return; h += '<div class="grp">' + title + '</div>'; arr.forEach((x) => { const it = fn(x); it.i = items.length; items.push(it); h += '<button type="button" role="option" id="sr-' + it.i + '" data-i="' + it.i + '">' + O.icon(it.icon) + '<span style="flex:1;min-width:0"><span class="cell-main" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + U.esc(it.title) + '</span><span class="cell-sub">' + U.esc(it.sub) + '</span></span>' + (it.right || '') + '</button>'; }); };
        grp('Opérations', tx, (t) => ({ icon: 'swap', title: t.label, sub: U.fmtDate(t.date) + ' · ' + S.name('categories', t.categoryId, ''), right: UI.amount(t), go: () => O.Forms.openTransaction(t) }));
        grp('Factures', inv, (i) => ({ icon: 'invoice', title: i.number + ' — ' + i.label, sub: S.name('thirdParties', i.thirdPartyId) + ' · ' + O.F.invoiceState(i).label, right: '<span class="num">' + U.money(i.amountTTC) + '</span>', go: () => O.Views.invoices.openForm(i) }));
        grp('Tiers', tps, (t) => ({ icon: 'users', title: t.name, sub: (t.kind === 'client' ? 'Client' : 'Fournisseur') + (t.city ? ' · ' + t.city : ''), go: () => { O.Views.operations.filterBy({ thirdPartyId: t.id }); location.hash = '#operations'; } }));
        grp('Fichiers', fls, (f) => ({ icon: 'file', title: f.name, sub: O.Files.folderName(f.folder) + ' · ' + U.bytes(f.size), go: () => O.Views.vault.preview(f.id) }));
        if (!items.length) h = '<div class="grp">Aucun résultat pour « ' + U.esc(input.value.trim()) + ' »</div>';
        const seeAll = { icon: 'search', title: 'Rechercher « ' + input.value.trim() + ' » dans toutes les opérations', sub: 'Ouvrir la liste filtrée', go: () => { O.Views.operations.filterBy({ q: input.value.trim() }); if (this.current && this.current.path === 'operations') this.refresh(); else location.hash = '#operations'; } };
        seeAll.i = items.length; items.push(seeAll);
        h += '<button type="button" role="option" id="sr-' + seeAll.i + '" data-i="' + seeAll.i + '">' + O.icon('search') + '<span class="cell-main">' + U.esc(seeAll.title) + '</span></button>';
        box.innerHTML = h; box.classList.add('open'); input.setAttribute('aria-expanded', 'true'); active = -1;
      };
      input.addEventListener('input', U.debounce(draw, 120));
      input.addEventListener('focus', () => { if (input.value.trim().length >= 2) draw(); });
      input.addEventListener('keydown', (e) => {
        if (!box.classList.contains('open')) { if (e.key === 'Enter' && input.value.trim()) { e.preventDefault(); draw(); } return; }
        const btns = U.$$('button[data-i]', box);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          active = (active + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
          btns.forEach((b, i) => b.classList.toggle('active', i === active));
          input.setAttribute('aria-activedescendant', btns[active].id);
          btns[active].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') { e.preventDefault(); const it = items[active >= 0 ? Number(btns[active].dataset.i) : items.length - 1]; if (it) go(it); }
        else if (e.key === 'Escape') { close(); }
      });
      box.addEventListener('mousedown', (e) => e.preventDefault());
      box.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) go(items[Number(b.dataset.i)]); });
      input.addEventListener('blur', () => setTimeout(close, 120));
    },

    async boot() {
      const drivers = O.createDrivers();
      await S.init(drivers.data);
      await O.Files.init(drivers.files);
      if (!(await drivers.data.isInitialized())) await (O.config.demoOnFirstRun === false ? O.Seed.base() : O.Seed.run());

      document.getElementById('boot').remove();
      document.getElementById('app').classList.remove('hidden');
      O.hydrateIcons(document);
      this.applyAppearance();
      this.renderNav();
      this.updateStorage();
      UI.initTooltips();
      UI.initRipple();
      this.initSearch();

      document.getElementById('themeBtn').addEventListener('click', () => this.setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
      document.getElementById('fontUp').addEventListener('click', () => this.stepFont(1));
      document.getElementById('fontDown').addEventListener('click', () => this.stepFont(-1));
      document.getElementById('fontCycle').addEventListener('click', () => { const c = S.settings.fontScale || 100; const i = FONT_STEPS.indexOf(c); const n = FONT_STEPS[(i + 1) % FONT_STEPS.length]; this.setFont(n); UI.toast('Taille du texte : ' + n + ' %', 'info'); });
      document.getElementById('quickAdd').addEventListener('click', () => O.Forms.openTransaction());
      document.getElementById('menuBtn').addEventListener('click', () => (document.getElementById('sidebar').classList.contains('open') ? this.closeMenu() : this.openMenu()));
      document.getElementById('scrim').addEventListener('click', () => this.closeMenu());
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.getElementById('globalSearch').focus(); }
        if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); O.Forms.openTransaction(); }
        if (e.key === 'Escape' && document.getElementById('sidebar').classList.contains('open')) this.closeMenu();
      });

      let pending = false;
      S.on((entity) => {
        if (entity === 'settings') { this.updateStorage(); return; }
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; this.renderNav(); this.updateStorage(); this.refresh(); });
      });
      window.addEventListener('hashchange', () => this.route());
      window.addEventListener('storage', async (e) => { if (e.key && e.key.startsWith(O.config.storagePrefix)) { await S.reload(); this.renderNav(); this.refresh(); } });
      await this.route();
    }
  };

  O.App = App;
  App.boot().catch((e) => {
    console.error(e);
    const b = document.getElementById('boot');
    if (b) b.innerHTML = '<div class="alert danger" style="max-width:520px">' + '<p><strong>Démarrage impossible.</strong> ' + U.esc(e.message) + '</p></div>';
  });
})(window.Ondea);
