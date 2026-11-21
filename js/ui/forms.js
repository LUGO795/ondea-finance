/* ==========================================================================
   Ondea Finance — Formulaires : champs, validation, pièces jointes,
   formulaire d'opération (dépense / recette) réutilisable partout.
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, F = O.F;
  const Fm = {};
  let seq = 0;
  const fid = (n) => 'f-' + n + '-' + (++seq);

  /* ---------- Champs ---------- */
  Fm.input = (o) => {
    const id = fid(o.name);
    const input = '<input id="' + id + '" name="' + o.name + '" type="' + (o.type || 'text') + '" value="' + U.esc(o.value == null ? '' : o.value) + '"' +
      (o.required ? ' required aria-required="true"' : '') + (o.placeholder ? ' placeholder="' + U.esc(o.placeholder) + '"' : '') +
      (o.attrs || '') + ' aria-describedby="' + id + '-err' + (o.hint ? ' ' + id + '-hint' : '') + '">';
    return '<div class="field' + (o.full ? ' full' : '') + '"><label for="' + id + '">' + U.esc(o.label) + (o.required ? '<span class="req" aria-hidden="true">*</span>' : '') + '</label>' +
      (o.affix ? '<div class="input-affix">' + input + '<span class="affix">' + U.esc(o.affix) + '</span></div>' : input) +
      (o.hint ? '<span class="hint" id="' + id + '-hint">' + U.esc(o.hint) + '</span>' : '') + '<span class="error" id="' + id + '-err" role="alert"></span></div>';
  };
  Fm.money = (o) => Fm.input(Object.assign({ affix: '€', attrs: ' inputmode="decimal" autocomplete="off"', placeholder: '0,00' }, o, { value: o.value === '' || o.value == null ? '' : U.centsToInput(o.value) }));
  Fm.select = (o) => {
    const id = fid(o.name);
    const opts = (o.placeholder != null ? '<option value="">' + U.esc(o.placeholder) + '</option>' : '') +
      o.options.map((x) => x.group ? '<optgroup label="' + U.esc(x.group) + '">' + x.options.map((y) => '<option value="' + U.esc(y.value) + '"' + (String(y.value) === String(o.value) ? ' selected' : '') + '>' + U.esc(y.label) + '</option>').join('') + '</optgroup>'
        : '<option value="' + U.esc(x.value) + '"' + (String(x.value) === String(o.value) ? ' selected' : '') + '>' + U.esc(x.label) + '</option>').join('');
    return '<div class="field' + (o.full ? ' full' : '') + '"><label for="' + id + '">' + U.esc(o.label) + (o.required ? '<span class="req" aria-hidden="true">*</span>' : '') + '</label>' +
      '<select id="' + id + '" name="' + o.name + '"' + (o.required ? ' required aria-required="true"' : '') + (o.attrs || '') + ' aria-describedby="' + id + '-err">' + opts + '</select>' +
      (o.hint ? '<span class="hint">' + U.esc(o.hint) + '</span>' : '') + '<span class="error" id="' + id + '-err" role="alert"></span></div>';
  };
  Fm.textarea = (o) => {
    const id = fid(o.name);
    return '<div class="field' + (o.full !== false ? ' full' : '') + '"><label for="' + id + '">' + U.esc(o.label) + '</label><textarea id="' + id + '" name="' + o.name + '" maxlength="' + (o.max || 1000) + '"' + (o.placeholder ? ' placeholder="' + U.esc(o.placeholder) + '"' : '') + ' aria-describedby="' + id + '-err">' + U.esc(o.value || '') + '</textarea><span class="error" id="' + id + '-err" role="alert"></span></div>';
  };
  Fm.check = (o) => '<div class="field' + (o.full ? ' full' : '') + '"><label class="check"><input type="checkbox" name="' + o.name + '"' + (o.checked ? ' checked' : '') + '> ' + U.esc(o.label) + '</label></div>';
  Fm.typeSwitch = (name, value, legend) => '<fieldset class="field full" style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:.35rem">' + U.esc(legend || 'Type') + '</legend><div class="segmented">' +
    '<label class="exp"><input type="radio" name="' + name + '" value="depense"' + (value !== 'recette' ? ' checked' : '') + '><span>Dépense</span></label>' +
    '<label class="inc"><input type="radio" name="' + name + '" value="recette"' + (value === 'recette' ? ' checked' : '') + '><span>Recette</span></label></div></fieldset>';

  /* ---------- Listes d'options ---------- */
  Fm.optionsHTML = (opts) => opts.map((x) => x.group
    ? (x.options.length ? '<optgroup label="' + U.esc(x.group) + '">' + x.options.map((y) => '<option value="' + U.esc(y.value) + '">' + U.esc(y.label) + '</option>').join('') + '</optgroup>' : '')
    : '<option value="' + U.esc(x.value) + '">' + U.esc(x.label) + '</option>').join('');
  Fm.optCategories = (type) => S.all('categories').filter((c) => !type || c.type === type).sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((c) => ({ value: c.id, label: (c.icon ? c.icon + ' ' : '') + c.name }));
  Fm.optThirdParties = (kind) => {
    const all = S.all('thirdParties').slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const pri = all.filter((t) => !kind || t.kind === kind), oth = all.filter((t) => kind && t.kind !== kind);
    const g = [{ group: kind === 'client' ? 'Clients' : kind === 'fournisseur' ? 'Fournisseurs' : 'Tiers', options: pri.map((t) => ({ value: t.id, label: t.name })) }];
    if (oth.length) g.push({ group: 'Autres tiers', options: oth.map((t) => ({ value: t.id, label: t.name })) });
    return g;
  };
  Fm.optAccounts = () => S.all('accounts').map((a) => ({ value: a.id, label: a.name }));
  Fm.optPayments = () => S.all('paymentMethods').map((p) => ({ value: p.id, label: p.name }));
  Fm.optVat = () => F.VAT_RATES.map((r) => ({ value: r, label: String(r).replace('.', ',') + ' %' }));

  /* ---------- Validation ---------- */
  Fm.R = {
    required: (v) => (String(v == null ? '' : v).trim() ? null : 'Ce champ est obligatoire.'),
    date: (v) => (!v || U.validDate(v) ? null : 'Date invalide (format attendu : JJ/MM/AAAA).'),
    money: (v) => { if (!String(v).trim()) return 'Montant obligatoire.'; const c = U.toCents(v); return isNaN(c) ? 'Montant invalide (ex. : 1 250,50).' : c <= 0 ? 'Le montant doit être supérieur à 0.' : c > 99999999999 ? 'Montant trop élevé.' : null; },
    moneyOpt: (v) => { if (!String(v).trim()) return null; const c = U.toCents(v); return isNaN(c) ? 'Montant invalide.' : null; },
    email: (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'Adresse e-mail invalide.'),
    max: (n) => (v) => (String(v || '').length <= n ? null : 'Maximum ' + n + ' caractères.'),
    siret: (v) => (!v || /^\d{14}$/.test(String(v).replace(/\s/g, '')) ? null : 'Le SIRET comporte 14 chiffres.'),
    pct: (v) => { const n = Number(String(v).replace(',', '.')); return isNaN(n) || n < 1 || n > 100 ? 'Entre 1 et 100.' : null; }
  };
  Fm.values = (form) => {
    const o = {};
    new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
    U.$$('input[type="checkbox"][name]', form).forEach((c) => { o[c.name] = c.checked; });
    return o;
  };
  Fm.setError = (form, name, msg) => {
    const el = form.querySelector('[name="' + name + '"]');
    if (!el) return;
    const field = el.closest('.field');
    const err = field && field.querySelector('.error');
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) { err.textContent = msg || ''; err.classList.toggle('show', !!msg); }
  };
  /** rules = { champ: [règle, …] } ; renvoie true si valide et place le focus sur la 1re erreur */
  Fm.validate = (form, rules) => {
    const v = Fm.values(form); let first = null;
    Object.keys(rules).forEach((name) => {
      let msg = null;
      for (const r of rules[name]) { msg = r(v[name], v); if (msg) break; }
      Fm.setError(form, name, msg);
      if (msg && !first) first = form.querySelector('[name="' + name + '"]');
    });
    if (first) { first.focus(); O.UI.toast('Veuillez corriger les champs signalés.', 'warn'); }
    return !first;
  };
  Fm.liveClear = (form) => form.addEventListener('input', (e) => { if (e.target.name && e.target.getAttribute('aria-invalid') === 'true') Fm.setError(form, e.target.name, null); });

  /* ---------- Pièces jointes (justificatifs) ---------- */
  Fm.attachField = (ids) => {
    const vaultOpts = O.Files.all().map((m) => '<option value="' + U.esc(m.id) + '">' + U.esc(m.name) + ' — ' + U.esc(O.Files.folderName(m.folder)) + '</option>').join('');
    return '<div class="field full"><span class="label">Justificatifs</span>' +
      (O.Files.available ? '<div class="attach-list" data-attach-list></div>' +
        '<div class="flex" style="margin-top:.4rem"><label class="btn btn-sm" style="cursor:pointer">' + O.icon('paperclip') + 'Joindre un fichier<input type="file" multiple class="sr-only" data-attach-input accept="image/*,application/pdf,text/plain,.csv"></label>' +
        (vaultOpts ? '<label class="sr-only" for="vaultPick">Choisir dans le coffre-fort</label><select class="input" id="vaultPick" data-attach-vault style="width:auto;min-height:34px"><option value="">Choisir dans le coffre-fort…</option>' + vaultOpts + '</select>' : '') +
        '</div><span class="hint">Images, PDF ou texte — 25 Mo max par fichier. Enregistrés dans votre espace personnel (IndexedDB).</span>'
        : '<p class="muted small">Stockage de fichiers indisponible dans ce navigateur.</p>') + '</div>';
  };
  Fm.bindAttach = (root, ids, folder) => {
    const state = { ids: (ids || []).slice(), pending: [] };
    const list = root.querySelector('[data-attach-list]');
    if (!list) return { commit: async () => state.ids };
    const draw = () => {
      list.innerHTML = state.ids.map((id) => { const m = O.Files.getMeta(id); return m ? '<span class="attach-item">' + O.icon('file') + '<span>' + U.esc(m.name) + '</span><button type="button" class="icon-btn sm" data-prev="' + id + '" aria-label="Prévisualiser ' + U.esc(m.name) + '">' + O.icon('eye') + '</button><button type="button" class="icon-btn sm" data-rm="' + id + '" aria-label="Retirer ' + U.esc(m.name) + '">' + O.icon('close') + '</button></span>' : ''; }).join('') +
        state.pending.map((f, i) => '<span class="attach-item">' + O.icon('upload') + '<span>' + U.esc(f.name) + ' <em class="muted">(' + U.bytes(f.size) + ', à enregistrer)</em></span><button type="button" class="icon-btn sm" data-rmp="' + i + '" aria-label="Retirer ' + U.esc(f.name) + '">' + O.icon('close') + '</button></span>').join('') ||
        '<span class="muted small">Aucun justificatif.</span>';
    };
    draw();
    root.querySelector('[data-attach-input]').addEventListener('change', (e) => {
      Array.from(e.target.files).forEach((f) => { const err = O.Files.validate(f); if (err) O.UI.toast(err, 'error'); else state.pending.push(f); });
      e.target.value = ''; draw();
    });
    const vp = root.querySelector('[data-attach-vault]');
    if (vp) vp.addEventListener('change', () => { if (vp.value && !state.ids.includes(vp.value)) state.ids.push(vp.value); vp.value = ''; draw(); });
    list.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-rm]'), rmp = e.target.closest('[data-rmp]'), pv = e.target.closest('[data-prev]');
      if (rm) { state.ids = state.ids.filter((x) => x !== rm.dataset.rm); draw(); }
      if (rmp) { state.pending.splice(Number(rmp.dataset.rmp), 1); draw(); }
      if (pv) O.Views.vault.preview(pv.dataset.prev);
    });
    return {
      async commit() {
        for (const f of state.pending) { const m = await O.Files.add(f, { folder: folder || 'justificatifs' }); state.ids.push(m.id); }
        state.pending = [];
        return state.ids;
      }
    };
  };

  /* ---------- Formulaire d'opération (dépense / recette) ---------- */
  Fm.openTransaction = (existing, preset) => {
    const t = existing || Object.assign({ type: 'depense', date: U.today(), vatRate: S.settings.vatDefault, status: 'payee', accountId: (S.all('accounts')[0] || {}).id }, preset || {});
    const isEdit = !!(existing && existing.id);
    const body = '<form novalidate id="txForm"><div class="form-grid">' +
      Fm.typeSwitch('type', t.type, "Type d'opération") +
      Fm.input({ name: 'label', label: 'Libellé', value: t.label, required: true, full: true, placeholder: 'Ex. : Achat fournitures de bureau', attrs: ' maxlength="120" autocomplete="off"' }) +
      Fm.input({ name: 'date', label: 'Date', type: 'date', value: t.date, required: true }) +
      Fm.select({ name: 'status', label: 'Statut', value: t.status, options: [{ value: 'payee', label: 'Payée / encaissée' }, { value: 'en_attente', label: 'En attente' }] }) +
      Fm.money({ name: 'amount', label: 'Montant', value: t.base === 'ttc' ? t.amountTTC : t.amountHT, required: true }) +
      '<div class="field"><span class="label" id="baseLbl">Le montant saisi est</span><div class="segmented" role="radiogroup" aria-labelledby="baseLbl"><label><input type="radio" name="base" value="ht"' + (t.base !== 'ttc' ? ' checked' : '') + '><span>HT</span></label><label><input type="radio" name="base" value="ttc"' + (t.base === 'ttc' ? ' checked' : '') + '><span>TTC</span></label></div></div>' +
      Fm.select({ name: 'vatRate', label: 'Taux de TVA', value: t.vatRate, options: Fm.optVat() }) +
      '<div class="field"><span class="label">Calcul automatique</span><div class="calc-box" aria-live="polite"><div><span>HT</span><strong data-c="ht">—</strong></div><div><span>TVA</span><strong data-c="vat">—</strong></div><div><span>TTC</span><strong data-c="ttc">—</strong></div></div></div>' +
      Fm.select({ name: 'categoryId', label: 'Catégorie', value: t.categoryId, required: true, placeholder: 'Choisir…', options: Fm.optCategories(t.type) }) +
      Fm.select({ name: 'thirdPartyId', label: 'Tiers (fournisseur / client)', value: t.thirdPartyId, placeholder: 'Aucun', options: Fm.optThirdParties(t.type === 'recette' ? 'client' : 'fournisseur') }) +
      Fm.select({ name: 'paymentMethodId', label: 'Moyen de paiement', value: t.paymentMethodId, placeholder: 'Non précisé', options: Fm.optPayments() }) +
      Fm.select({ name: 'accountId', label: 'Compte de trésorerie', value: t.accountId, required: true, options: Fm.optAccounts() }) +
      Fm.input({ name: 'reference', label: 'Référence / n° de pièce', value: t.reference, attrs: ' maxlength="60"' }) +
      Fm.textarea({ name: 'notes', label: 'Notes', value: t.notes, max: 500 }) +
      Fm.attachField(t.attachments) +
      '</div></form>';
    return new Promise((resolve) => {
      let saved = null;
      O.UI.modal({
        title: isEdit ? "Modifier l'opération" : 'Nouvelle opération',
        size: 'lg', body,
        foot: '<button type="button" class="btn" data-close>Annuler</button><button type="submit" form="txForm" class="btn btn-primary">' + O.icon('check') + (isEdit ? 'Enregistrer' : 'Ajouter') + '</button>',
        onOpen(dlg, api) {
          const form = dlg.querySelector('#txForm');
          Fm.liveClear(form);
          const att = Fm.bindAttach(dlg, t.attachments, t.type === 'recette' ? 'factures' : 'recus');
          const calc = () => {
            const v = Fm.values(form), c = U.toCents(v.amount);
            const a = isNaN(c) ? null : F.amounts(c, v.vatRate, v.base);
            dlg.querySelector('[data-c="ht"]').textContent = a ? U.money(a.amountHT) : '—';
            dlg.querySelector('[data-c="vat"]').textContent = a ? U.money(a.amountVAT) : '—';
            dlg.querySelector('[data-c="ttc"]').textContent = a ? U.money(a.amountTTC) : '—';
          };
          calc();
          form.addEventListener('input', calc);
          form.addEventListener('change', (e) => {
            calc();
            if (e.target.name === 'type') {
              const type = e.target.value;
              const cs = form.querySelector('[name="categoryId"]'), ts = form.querySelector('[name="thirdPartyId"]');
              const cv = cs.value, tv = ts.value;
              cs.innerHTML = '<option value="">Choisir…</option>' + Fm.optCategories(type).map((o) => '<option value="' + o.value + '">' + U.esc(o.label) + '</option>').join('');
              if (Fm.optCategories(type).some((o) => o.value === cv)) cs.value = cv;
              ts.innerHTML = '<option value="">Aucun</option>' + Fm.optionsHTML(Fm.optThirdParties(type === 'recette' ? 'client' : 'fournisseur'));
              ts.value = tv;
            }
            if (e.target.name === 'paymentMethodId') {
              const pm = S.get('paymentMethods', e.target.value);
              if (pm && pm.accountId) form.querySelector('[name="accountId"]').value = pm.accountId;
            }
          });
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const R = Fm.R;
            if (!Fm.validate(form, { label: [R.required, R.max(120)], date: [R.required, R.date], amount: [R.money], categoryId: [R.required], accountId: [R.required] })) return;
            const v = Fm.values(form);
            const btn = dlg.querySelector('button[type="submit"]');
            O.UI.setBusy(btn, true);
            try {
              const attachments = await att.commit();
              const rec = Object.assign({
                type: v.type, label: v.label, date: v.date, status: v.status, vatRate: Number(v.vatRate), base: v.base,
                categoryId: v.categoryId, thirdPartyId: v.thirdPartyId || null, paymentMethodId: v.paymentMethodId || null,
                accountId: v.accountId, reference: v.reference, notes: v.notes, attachments
              }, F.amounts(U.toCents(v.amount), v.vatRate, v.base));
              saved = isEdit ? await S.update('transactions', t.id, rec) : await S.create('transactions', Object.assign({ invoiceId: t.invoiceId || null, scheduleId: t.scheduleId || null }, rec));
              O.UI.toast(isEdit ? 'Opération mise à jour.' : 'Opération ajoutée.');
              api.close();
            } catch (err) { O.UI.error(err); O.UI.setBusy(btn, false); }
          });
        },
        onClose() { resolve(saved); }
      });
    });
  };

  O.Forms = Fm;
})(window.Ondea);
