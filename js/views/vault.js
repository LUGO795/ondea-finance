/* ==========================================================================
   Vue — Coffre-fort : espace de stockage personnel des justificatifs
   (IndexedDB) — capacité, dossiers, prévisualisation, organisation.
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, UI = O.UI, Fm = O.Forms, Fi = O.Files;
  O.Views = O.Views || {};
  const st = { folder: 'all', q: '', sort: 'date', selected: new Set(), uploadFolder: 'justificatifs' };
  let urls = [];
  const revoke = () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; };

  async function preview(id) {
    const rec = await Fi.get(id);
    if (!rec) { UI.toast('Fichier introuvable.', 'error'); return; }
    const url = URL.createObjectURL(rec.blob);
    const kind = Fi.kind(rec.type, rec.name);
    let body;
    if (kind === 'image') body = '<img class="preview-img" src="' + url + '" alt="Aperçu de ' + U.esc(rec.name) + '">';
    else if (kind === 'pdf') body = '<iframe class="preview-frame" src="' + url + '" title="Aperçu PDF de ' + U.esc(rec.name) + '"></iframe>';
    else if (kind === 'text') { const txt = await rec.blob.text(); body = '<pre class="mono" style="white-space:pre-wrap;background:var(--surface-2);padding:1rem;border-radius:12px;max-height:65vh;overflow:auto;border:1px solid var(--line)">' + U.esc(txt.slice(0, 200000)) + '</pre>'; }
    else body = UI.empty('Aperçu indisponible', 'Ce format ne peut pas être affiché dans le navigateur. Téléchargez-le pour l’ouvrir.');
    const links = Fi.links(id);
    body += '<dl class="kv mt"><dt>Dossier</dt><dd>' + U.esc(Fi.folderName(rec.folder)) + '</dd><dt>Taille</dt><dd>' + U.bytes(rec.size) + '</dd><dt>Ajouté le</dt><dd>' + U.fmtDate(rec.createdAt.slice(0, 10)) + '</dd><dt>Lié à</dt><dd>' + (links.length ? links.map((l) => U.esc(l.label)).join('<br>') : '<span class="muted">Aucune pièce</span>') + '</dd>' + (rec.note ? '<dt>Note</dt><dd>' + U.esc(rec.note) + '</dd>' : '') + '</dl>';
    UI.modal({
      title: rec.name, size: 'lg', body,
      foot: '<button type="button" class="btn" data-close>Fermer</button><a class="btn btn-primary" href="' + url + '" download="' + U.esc(rec.name) + '">' + O.icon('download') + 'Télécharger</a>',
      onClose() { setTimeout(() => URL.revokeObjectURL(url), 500); }
    });
  }

  function editForm(meta) {
    UI.modal({
      title: 'Organiser le fichier', body: '<form novalidate id="fileForm"><div class="form-grid">' +
        Fm.input({ name: 'name', label: 'Nom du fichier', value: meta.name, required: true, full: true, attrs: ' maxlength="120"' }) +
        Fm.select({ name: 'folder', label: 'Dossier', value: meta.folder, options: Fi.FOLDERS.map((f) => ({ value: f.id, label: f.name })) }) +
        Fm.input({ name: 'tags', label: 'Étiquettes', value: (meta.tags || []).join(', '), hint: 'Séparées par des virgules', attrs: ' maxlength="120"' }) +
        Fm.textarea({ name: 'note', label: 'Note', value: meta.note, max: 300 }) + '</div></form>',
      foot: '<button type="button" class="btn" data-close>Annuler</button><button type="submit" form="fileForm" class="btn btn-primary">' + O.icon('check') + 'Enregistrer</button>',
      onOpen(dlg, api) {
        const form = dlg.querySelector('#fileForm'); Fm.liveClear(form);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const safe = (v) => (/[\\/:*?"<>|]/.test(v) ? 'Caractères interdits : \\ / : * ? " < > |' : null);
          if (!Fm.validate(form, { name: [Fm.R.required, Fm.R.max(120), safe] })) return;
          const v = Fm.values(form);
          try { await Fi.patch(meta.id, { name: v.name, folder: v.folder, note: v.note, tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean) }); UI.toast('Fichier mis à jour.'); api.close(); } catch (err) { UI.error(err); }
        });
      }
    });
  }

  async function upload(files) {
    let ok = 0;
    for (const f of Array.from(files)) {
      try { await Fi.add(f, { folder: st.uploadFolder }); ok++; } catch (e) { UI.toast(e.message, 'error'); }
    }
    if (ok) UI.toast(ok + ' fichier(s) ajouté(s) dans « ' + Fi.folderName(st.uploadFolder) + ' ».');
  }

  async function download(id) { const r = await Fi.get(id); if (r) U.download(r.blob, r.name); }

  O.Views.vault = {
    title: 'Coffre-fort',
    preview,
    async render(root) {
      revoke();
      if (!Fi.available) {
        root.innerHTML = '<div class="view"><div class="page-head"><div><h1>Coffre-fort</h1></div></div><div class="alert danger">' + O.icon('alert') + '<p>Le stockage de fichiers (IndexedDB) n’est pas disponible dans ce navigateur ou en navigation privée : ' + U.esc(Fi.error || '') + '</p></div></div>';
        return;
      }
      const linked = new Set();
      S.all('transactions').concat(S.all('invoices')).forEach((r) => (r.attachments || []).forEach((a) => linked.add(a)));
      const all = Fi.all();
      const q = U.norm(st.q);
      let files = all.filter((m) => (st.folder === 'all' || (st.folder === 'unlinked' ? !linked.has(m.id) : m.folder === st.folder)) && (!q || U.norm(m.name + ' ' + (m.tags || []).join(' ') + ' ' + (m.note || '')).includes(q)));
      files = files.sort((a, b) => st.sort === 'name' ? a.name.localeCompare(b.name, 'fr') : st.sort === 'size' ? b.size - a.size : (b.createdAt || '').localeCompare(a.createdAt || ''));
      st.selected.forEach((id) => { if (!all.some((m) => m.id === id)) st.selected.delete(id); });
      const used = Fi.used(), quota = Fi.quota(), pct = Math.min(100, (used / quota) * 100);
      const lsUsed = S.driver.usage ? S.driver.usage() : 0, lsQuota = 5 * 1024 * 1024;
      const est = await Fi.estimate();
      const persisted = await Fi.persisted();
      const byType = { image: 0, pdf: 0, text: 0, other: 0 };
      all.forEach((m) => { byType[Fi.kind(m.type, m.name)] += m.size; });
      const colors = { image: 'var(--gold-2)', pdf: 'var(--exp)', text: 'var(--info)', other: 'var(--inc)' };

      root.innerHTML = '<div class="view">' +
        '<div class="page-head"><div><div class="eyebrow">Espace personnel</div><h1>Coffre-fort des justificatifs</h1><p>Factures, reçus et pièces stockés localement dans votre navigateur (IndexedDB), sans compte ni cloud.</p></div>' +
        '<div class="page-actions"><label class="btn btn-primary" style="cursor:pointer">' + O.icon('upload') + 'Ajouter des fichiers<input type="file" multiple class="sr-only" data-upload accept="image/*,application/pdf,text/plain,.csv,.json,.doc,.docx,.xls,.xlsx,.zip"></label></div></div>' +
        '<section class="grid grid-main mb">' +
        '<div class="card"><div class="card-head"><div><h2>Capacité de l’espace personnel</h2><p class="card-sub">' + U.bytes(used) + ' utilisés sur ' + U.bytes(quota) + ' alloués · ' + all.length + ' fichier(s)</p></div><span class="badge ' + (pct > 90 ? 'b-danger' : pct > 70 ? 'b-warn' : 'b-inc') + '">' + U.pct(pct) + '</span></div>' +
        '<div class="storage-meter" role="img" aria-label="Répartition de l’espace utilisé">' + Object.keys(byType).map((k) => '<span style="width:' + ((byType[k] / quota) * 100).toFixed(3) + '%;background:' + colors[k] + '" data-tip="' + U.esc(U.esc({ image: 'Images', pdf: 'PDF', text: 'Textes', other: 'Autres' }[k]) + ' : <b>' + U.bytes(byType[k]) + '</b>') + '"></span>').join('') + '</div>' +
        '<div class="legend">' + Object.keys(byType).map((k) => '<span><i style="background:' + colors[k] + '"></i>' + { image: 'Images', pdf: 'PDF', text: 'Textes', other: 'Autres' }[k] + ' · ' + U.bytes(byType[k]) + '</span>').join('') + '</div>' +
        '<hr class="divider"><div class="grid grid-2" style="gap:1rem">' +
        '<div><div class="stat-row"><span class="muted">Données de gestion (LocalStorage)</span><strong class="num">' + U.bytes(lsUsed) + '</strong></div><div class="progress" style="margin-top:.3rem"><span data-w="' + Math.min(100, (lsUsed / lsQuota) * 100).toFixed(2) + '"></span></div><span class="cell-sub">Limite usuelle du navigateur : ≈ 5 Mo</span></div>' +
        '<div><div class="stat-row"><span class="muted">Quota navigateur (toutes données)</span><strong class="num">' + (est ? U.bytes(est.usage) + ' / ' + U.bytes(est.quota) : 'non communiqué') + '</strong></div>' +
        '<div class="flex" style="margin-top:.4rem"><span class="badge ' + (persisted ? 'b-inc' : 'b-warn') + '">' + (persisted ? 'Stockage persistant' : 'Stockage non garanti') + '</span>' + (!persisted ? '<button class="btn btn-sm" data-act="persist">' + O.icon('lock') + 'Protéger contre l’effacement</button>' : '') + '</div></div></div>' +
        '<div class="flex mt"><label for="quotaSel" class="small muted">Espace alloué :</label><select class="input" id="quotaSel" data-quota style="width:auto;min-height:36px">' + [100, 250, 500, 1000, 2000].map((n) => '<option value="' + n + '"' + (n === S.settings.storageQuotaMB ? ' selected' : '') + '>' + (n >= 1000 ? n / 1000 + ' Go' : n + ' Mo') + '</option>').join('') + '</select></div>' +
        '</div>' +
        '<div class="card"><h2>Déposer des justificatifs</h2><div class="field mb"><label for="upFolder">Dossier de destination</label><select id="upFolder" data-upfolder>' + Fi.FOLDERS.map((f) => '<option value="' + f.id + '"' + (f.id === st.uploadFolder ? ' selected' : '') + '>' + U.esc(f.name) + '</option>').join('') + '</select></div>' +
        '<div class="dropzone" tabindex="0" role="button" aria-label="Zone de dépôt : glissez des fichiers ou appuyez sur Entrée pour parcourir" data-drop>' + O.icon('upload') + '<p style="margin:.5rem 0 0"><strong>Glissez-déposez vos fichiers ici</strong><br><span class="small">ou cliquez pour parcourir — images, PDF, textes · 25 Mo max</span></p></div></div>' +
        '</section>' +
        '<div class="vault">' +
        '<nav class="card folders" aria-label="Dossiers" style="padding:.75rem;align-self:start">' +
        [['all', 'Tous les fichiers', 'vault', all.length], ['unlinked', 'Non rattachés', 'paperclip', all.filter((m) => !linked.has(m.id)).length]].concat(Fi.FOLDERS.map((f) => [f.id, f.name, f.icon, all.filter((m) => m.folder === f.id).length]))
          .map(([id, name, ic, n]) => '<button type="button" aria-pressed="' + (st.folder === id) + '" data-folder="' + id + '">' + O.icon(ic) + '<span>' + U.esc(name) + '</span><span class="count">' + n + '</span></button>').join('') +
        '</nav>' +
        '<section class="card flush"><div class="toolbar"><label class="sr-only" for="vQ">Rechercher un fichier</label><input id="vQ" class="input grow" type="search" placeholder="Nom, étiquette, note…" value="' + U.esc(st.q) + '">' +
        '<label class="sr-only" for="vSort">Trier</label><select id="vSort" class="input" data-sortsel><option value="date"' + (st.sort === 'date' ? ' selected' : '') + '>Plus récents</option><option value="name"' + (st.sort === 'name' ? ' selected' : '') + '>Nom</option><option value="size"' + (st.sort === 'size' ? ' selected' : '') + '>Taille</option></select></div>' +
        '<div class="bulkbar' + (st.selected.size ? ' show' : '') + '" data-bulk><span>' + st.selected.size + ' sélectionné(s)</span><label class="sr-only" for="moveSel">Déplacer vers</label><select id="moveSel" class="input" data-move style="width:auto;min-height:34px"><option value="">Déplacer vers…</option>' + Fi.FOLDERS.map((f) => '<option value="' + f.id + '">' + U.esc(f.name) + '</option>').join('') + '</select><button class="btn btn-sm btn-danger" data-act="bulk-del">' + O.icon('trash') + 'Supprimer</button><button class="btn btn-sm btn-ghost" data-act="bulk-clear">Annuler</button></div>' +
        '<div style="padding:1.25rem">' + (files.length ? '<div class="files-grid">' + files.map((m) => {
          const k = Fi.kind(m.type, m.name), isLinked = linked.has(m.id);
          return '<article class="file-card"><label class="sel"><input type="checkbox" data-fsel="' + m.id + '"' + (st.selected.has(m.id) ? ' checked' : '') + ' aria-label="Sélectionner ' + U.esc(m.name) + '"></label>' +
            '<button type="button" class="file-thumb" data-prev="' + m.id + '" aria-label="Prévisualiser ' + U.esc(m.name) + '">' + (k === 'image' ? '<img alt="" data-thumb="' + m.id + '">' : '<span class="ext">' + U.esc(Fi.ext(m.name)) + '</span>') + '</button>' +
            '<div class="file-meta"><div class="name" title="' + U.esc(m.name) + '">' + U.esc(m.name) + '</div><div class="cell-sub">' + U.bytes(m.size) + ' · ' + U.fmtDate((m.createdAt || '').slice(0, 10)) + '</div><div class="flex" style="gap:.3rem;margin-top:.35rem"><span class="badge plain b-muted">' + U.esc(Fi.folderName(m.folder)) + '</span>' + (isLinked ? '<span class="badge plain b-inc">Rattaché</span>' : '') + (m.tags || []).slice(0, 2).map((t) => '<span class="badge plain b-gold">' + U.esc(t) + '</span>').join('') + '</div></div>' +
            '<div class="file-actions"><button class="icon-btn sm" data-dl="' + m.id + '" aria-label="Télécharger ' + U.esc(m.name) + '">' + O.icon('download') + '</button><button class="icon-btn sm" data-edit="' + m.id + '" aria-label="Renommer ou déplacer ' + U.esc(m.name) + '">' + O.icon('edit') + '</button><button class="icon-btn sm danger" data-del="' + m.id + '" aria-label="Supprimer ' + U.esc(m.name) + '">' + O.icon('trash') + '</button></div></article>';
        }).join('') + '</div>' : UI.empty('Aucun fichier', st.q ? 'Aucun résultat pour cette recherche.' : 'Déposez vos premiers justificatifs.')) + '</div></section></div></div>';

      UI.animateBars(root);
      // Miniatures
      for (const img of U.$$('img[data-thumb]', root)) {
        try { const u = await Fi.objectURL(img.dataset.thumb); if (u) { urls.push(u); img.src = u; } } catch (e) { /* miniature ignorée */ }
      }

      const fileInput = root.querySelector('[data-upload]');
      fileInput.addEventListener('change', async () => { await upload(fileInput.files); fileInput.value = ''; });
      const drop = root.querySelector('[data-drop]');
      const picker = () => fileInput.click();
      drop.addEventListener('click', picker);
      drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker(); } });
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
      drop.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) upload(e.dataTransfer.files); });
      root.querySelector('[data-upfolder]').addEventListener('change', (e) => { st.uploadFolder = e.target.value; });
      root.querySelector('[data-quota]').addEventListener('change', async (e) => {
        const n = Number(e.target.value);
        if (n * 1024 * 1024 < used) { UI.toast('Impossible : l’espace déjà utilisé dépasse cette limite.', 'error'); e.target.value = S.settings.storageQuotaMB; return; }
        await S.saveSettings({ storageQuotaMB: n }); UI.toast('Espace alloué : ' + e.target.selectedOptions[0].textContent + '.');
      });
      root.querySelector('[data-sortsel]').addEventListener('change', (e) => { st.sort = e.target.value; O.App.refresh(); });
      root.querySelector('#vQ').addEventListener('input', U.debounce((e) => { st.q = e.target.value; O.App.refresh().then(() => { const el = document.getElementById('vQ'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }); }, 250));
      root.querySelector('[data-move]').addEventListener('change', async (e) => {
        if (!e.target.value) return;
        for (const id of st.selected) await Fi.patch(id, { folder: e.target.value });
        UI.toast(st.selected.size + ' fichier(s) déplacé(s).'); st.selected.clear(); O.App.refresh();
      });
      root.addEventListener('change', (e) => {
        if (e.target.dataset.fsel) {
          e.target.checked ? st.selected.add(e.target.dataset.fsel) : st.selected.delete(e.target.dataset.fsel);
          const bar = root.querySelector('[data-bulk]');
          bar.classList.toggle('show', st.selected.size > 0);
          bar.querySelector('span').textContent = st.selected.size + ' sélectionné(s)';
        }
      });
      root.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b || b.closest('[data-drop]')) return;
        try {
          if (b.dataset.folder) { st.folder = b.dataset.folder; O.App.refresh(); }
          else if (b.dataset.prev) preview(b.dataset.prev);
          else if (b.dataset.dl) download(b.dataset.dl);
          else if (b.dataset.edit) editForm(Fi.getMeta(b.dataset.edit));
          else if (b.dataset.act === 'persist') { const ok = await Fi.persist(); UI.toast(ok ? 'Stockage persistant accordé par le navigateur.' : 'Le navigateur a refusé la persistance (essayez après plusieurs visites ou installez la page).', ok ? 'success' : 'warn'); O.App.refresh(); }
          else if (b.dataset.act === 'bulk-clear') { st.selected.clear(); O.App.refresh(); }
          else if (b.dataset.act === 'bulk-del') {
            const n = st.selected.size;
            if (await UI.confirm('Supprimer définitivement ' + n + ' fichier(s) ?', { danger: true, ok: 'Supprimer', detail: 'Ils seront retirés des opérations et factures auxquelles ils sont rattachés.' })) {
              for (const id of Array.from(st.selected)) await Fi.remove(id);
              st.selected.clear(); UI.toast(n + ' fichier(s) supprimé(s).');
            }
          } else if (b.dataset.del) {
            const m = Fi.getMeta(b.dataset.del), links = Fi.links(m.id);
            if (await UI.confirm('Supprimer « ' + m.name + ' » ?', { danger: true, ok: 'Supprimer', detail: links.length ? 'Rattaché à : ' + links.map((l) => l.label).join(', ') : '' })) { await Fi.remove(m.id); UI.toast('Fichier supprimé.'); }
          }
        } catch (err) { UI.error(err); }
      });
    },
    leave: revoke
  };
})(window.Ondea);
