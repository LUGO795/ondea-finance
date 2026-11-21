/* ==========================================================================
   Vue — Paramètres : entreprise, apparence, sauvegarde / restauration,
   réinitialisation, architecture
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, UI = O.UI, Fm = O.Forms, Fi = O.Files;
  O.Views = O.Views || {};

  async function backup(withFiles) {
    const payload = { app: 'ondea-finance', format: 1, version: O.config.version, exportedAt: new Date().toISOString(), settings: S.settings, data: S.exportData(), files: [] };
    if (withFiles && Fi.available) {
      for (const m of Fi.all()) { const r = await Fi.get(m.id); if (r && r.blob) payload.files.push(Object.assign({}, m, { dataURL: await U.fileToDataURL(r.blob) })); }
    }
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    U.download(blob, 'ondea-finance-sauvegarde-' + U.today() + (withFiles ? '-complete' : '') + '.json');
    await S.saveSettings({ lastBackup: new Date().toISOString() });
    UI.toast('Sauvegarde générée (' + U.bytes(blob.size) + ').');
  }

  async function restore(file) {
    let json;
    try { json = JSON.parse(await file.text()); } catch (e) { UI.toast('Fichier illisible : ce n’est pas un JSON valide.', 'error'); return; }
    if (!json || json.app !== 'ondea-finance' || !json.data) { UI.toast('Ce fichier n’est pas une sauvegarde Ondea Finance.', 'error'); return; }
    const missing = O.ENTITIES.filter((e) => json.data[e] && !Array.isArray(json.data[e]));
    if (missing.length) { UI.toast('Sauvegarde corrompue (' + missing.join(', ') + ').', 'error'); return; }
    const n = U.sum(O.ENTITIES, (e) => (json.data[e] || []).length);
    if (!await UI.confirm('Restaurer cette sauvegarde du ' + U.fmtDate((json.exportedAt || '').slice(0, 10)) + ' ?', { danger: true, ok: 'Restaurer', detail: n + ' enregistrements et ' + (json.files || []).length + ' fichier(s). Les données actuelles seront remplacées.' })) return;
    try {
      await S.replaceAll(json.data, json.settings);
      if (Array.isArray(json.files) && json.files.length) {
        await Fi.clear();
        for (const f of json.files) {
          const blob = U.dataURLToBlob(f.dataURL);
          await Fi.driver.put({ id: f.id, name: f.name, type: f.type, size: blob.size, folder: f.folder, tags: f.tags || [], note: f.note || '', createdAt: f.createdAt, blob });
        }
        Fi.meta = await Fi.driver.list();
      }
      O.App.applyAppearance();
      S.emit('*');
      UI.toast('Sauvegarde restaurée avec succès.');
    } catch (e) { UI.error(e); }
  }

  O.Views.settings = {
    title: 'Paramètres',
    render(root) {
      const s = S.settings;
      const counts = O.ENTITIES.map((e) => [e, S.all(e).length]);
      const labels = { accounts: 'Comptes', categories: 'Catégories', thirdParties: 'Tiers', paymentMethods: 'Moyens de paiement', transactions: 'Opérations', invoices: 'Factures', schedules: 'Échéances', budgets: 'Budgets', transfers: 'Virements' };
      root.innerHTML = '<div class="view"><div class="page-head"><div><div class="eyebrow">Configuration</div><h1>Paramètres</h1><p>Votre entreprise, l’apparence et la sécurité de vos données.</p></div></div>' +
        '<div class="grid grid-2 stagger">' +
        '<section class="card"><h2>Entreprise</h2><form novalidate id="coForm"><div class="form-grid">' +
        Fm.input({ name: 'companyName', label: 'Raison sociale', value: s.companyName, required: true, full: true, attrs: ' maxlength="80"' }) +
        Fm.input({ name: 'siret', label: 'SIRET', value: s.siret, attrs: ' maxlength="17" inputmode="numeric"' }) +
        Fm.input({ name: 'email', label: 'E-mail', type: 'email', value: s.email, attrs: ' maxlength="120"' }) +
        Fm.input({ name: 'address', label: 'Adresse', value: s.address, full: true, attrs: ' maxlength="160"' }) +
        Fm.select({ name: 'vatDefault', label: 'Taux de TVA par défaut', value: s.vatDefault, options: Fm.optVat() }) +
        Fm.input({ name: 'invoicePrefix', label: 'Préfixe des factures clients', value: s.invoicePrefix, attrs: ' maxlength="10"', hint: 'Ex. : FAC- → FAC-2026-0001' }) +
        Fm.input({ name: 'budgetAlert', label: 'Seuil d’alerte budgétaire par défaut', value: s.budgetAlert, affix: '%', attrs: ' inputmode="numeric"' }) +
        '</div><div class="flex mt"><button type="submit" class="btn btn-primary">' + O.icon('check') + 'Enregistrer</button></div></form></section>' +

        '<section class="card"><h2>Apparence & accessibilité</h2>' +
        '<div class="field mb"><span class="label" id="thLbl">Thème</span><div class="segmented" role="radiogroup" aria-labelledby="thLbl"><label><input type="radio" name="theme" value="light"' + (document.documentElement.dataset.theme === 'light' ? ' checked' : '') + '><span>☀️ Clair</span></label><label><input type="radio" name="theme" value="dark"' + (document.documentElement.dataset.theme === 'dark' ? ' checked' : '') + '><span>🌙 Sombre</span></label></div></div>' +
        '<div class="field mb"><label for="fsRange">Taille du texte : <output id="fsOut" class="mono">' + s.fontScale + ' %</output></label><input id="fsRange" type="range" min="90" max="135" step="5" value="' + s.fontScale + '" style="accent-color:var(--gold-2);width:100%"><span class="hint">De 90 % à 135 % — également disponible en haut de chaque page (A− / A+).</span></div>' +
        '<div class="alert info">' + O.icon('info') + '<p>Contrastes conçus pour le niveau AAA (WCAG 2.2) dans les deux thèmes, navigation intégrale au clavier, compatibilité lecteurs d’écran et respect du réglage « réduire les animations ».</p></div>' +
        '<h3 class="mt">Raccourcis clavier</h3><dl class="kv"><dt><kbd>Ctrl</kbd> + <kbd>K</kbd></dt><dd>Recherche globale</dd><dt><kbd>Alt</kbd> + <kbd>N</kbd></dt><dd>Nouvelle opération</dd><dt><kbd>Échap</kbd></dt><dd>Fermer une fenêtre</dd></dl></section>' +

        '<section class="card"><h2>Sauvegarde & restauration</h2><p class="muted">Vos données restent sur cet appareil. Exportez régulièrement une sauvegarde pour les conserver ou les transférer.</p>' +
        '<div class="stat-row"><span class="muted">Dernière sauvegarde</span><strong>' + (s.lastBackup ? U.fmtDate(s.lastBackup.slice(0, 10)) : 'jamais') + '</strong></div>' +
        '<div class="flex mt"><button class="btn btn-primary" data-act="backup-full">' + O.icon('download') + 'Sauvegarde complète (avec fichiers)</button><button class="btn" data-act="backup">' + O.icon('database') + 'Données seules</button></div>' +
        '<div class="flex mt"><label class="btn" style="cursor:pointer">' + O.icon('upload') + 'Restaurer une sauvegarde…<input type="file" accept="application/json,.json" class="sr-only" data-restore></label><button class="btn" data-act="export-csv">' + O.icon('download') + 'Toutes les opérations (CSV)</button></div>' +
        '<hr class="divider"><h3>Contenu actuel</h3><div class="grid grid-3" style="gap:.5rem">' + counts.map(([e, n]) => '<div class="stat-row" style="border:0"><span class="small muted">' + labels[e] + '</span><strong class="num">' + n + '</strong></div>').join('') + '<div class="stat-row" style="border:0"><span class="small muted">Fichiers</span><strong class="num">' + Fi.all().length + '</strong></div></div></section>' +

        '<section class="card"><h2>Zone sensible</h2>' +
        '<div class="stat-row"><div><strong>Recharger les données de démonstration</strong><div class="cell-sub">Remplace toutes les données par un jeu d’exemple de 12 mois.</div></div><button class="btn" data-act="demo">' + O.icon('refresh') + 'Recharger</button></div>' +
        '<div class="stat-row"><div><strong>Repartir de zéro</strong><div class="cell-sub">Efface opérations, factures, tiers, fichiers… Conserve vos paramètres.</div></div><button class="btn btn-danger" data-act="wipe">' + O.icon('trash') + 'Tout effacer</button></div>' +
        '<hr class="divider"><h3>Architecture</h3><dl class="kv"><dt>Version</dt><dd class="mono">' + O.config.version + '</dd><dt>Données</dt><dd>' + U.esc(S.driver.name) + '</dd><dt>Fichiers</dt><dd>' + U.esc(Fi.driver ? Fi.driver.name : '—') + (Fi.available ? '' : ' (indisponible)') + '</dd><dt>Évolution</dt><dd>Passage à PHP 8 / MySQL / PDO : <span class="mono">driver: \'api\'</span> dans <span class="mono">js/config.js</span> — voir <span class="mono">docs/ARCHITECTURE.md</span>.</dd></dl></section>' +
        '</div></div>';

      const form = root.querySelector('#coForm'); Fm.liveClear(form);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!Fm.validate(form, { companyName: [Fm.R.required, Fm.R.max(80)], siret: [Fm.R.siret], email: [Fm.R.email], budgetAlert: [Fm.R.required, Fm.R.pct] })) return;
        const v = Fm.values(form);
        await S.saveSettings({ companyName: v.companyName, siret: v.siret, email: v.email, address: v.address, vatDefault: Number(v.vatDefault), invoicePrefix: v.invoicePrefix || 'FAC-', budgetAlert: Number(v.budgetAlert) });
        UI.toast('Paramètres de l’entreprise enregistrés.');
      });
      root.querySelectorAll('[name="theme"]').forEach((r) => r.addEventListener('change', () => O.App.setTheme(r.value)));
      const range = root.querySelector('#fsRange');
      range.addEventListener('input', () => { root.querySelector('#fsOut').textContent = range.value + ' %'; O.App.setFont(Number(range.value), true); });
      range.addEventListener('change', () => O.App.setFont(Number(range.value)));
      root.querySelector('[data-restore]').addEventListener('change', (e) => { if (e.target.files[0]) restore(e.target.files[0]); e.target.value = ''; });
      root.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const a = b.dataset.act;
        try {
          if (a === 'backup-full' || a === 'backup') { UI.setBusy(b, true); await backup(a === 'backup-full'); UI.setBusy(b, false); }
          else if (a === 'export-csv') { O.Views.operations.filterBy({}); location.hash = '#operations'; setTimeout(() => { const btn = document.querySelector('[data-act="csv"]'); if (btn) btn.click(); }, 120); }
          else if (a === 'demo' && await UI.confirm('Recharger les données de démonstration ?', { danger: true, ok: 'Recharger', detail: 'Toutes les données actuelles et les fichiers seront remplacés.' })) { await Fi.clear(); await O.Seed.run(); UI.toast('Données de démonstration rechargées.'); }
          else if (a === 'wipe' && await UI.confirm('Effacer définitivement toutes les données ?', { danger: true, ok: 'Tout effacer', detail: 'Pensez à exporter une sauvegarde avant. Cette action est irréversible.' })) { await Fi.clear(); await S.clearAll(); await O.Seed.base(); UI.toast('Données effacées : un compte, les catégories et moyens de paiement par défaut ont été recréés.'); }
        } catch (err) { UI.error(err); UI.setBusy(b, false); }
      });
    }
  };
})(window.Ondea);
