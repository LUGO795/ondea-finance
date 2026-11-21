/* ==========================================================================
   Vue — Factures clients & fournisseurs
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, F = O.F, UI = O.UI, Fm = O.Forms;
  O.Views = O.Views || {};

  const st = { dir: 'client', status: '', q: '' };
  let table = null;

  function nextNumber() {
    const y = U.today().slice(0, 4), pre = (S.settings.invoicePrefix || 'FAC-') + y + '-';
    const max = S.all('invoices').filter((i) => i.direction === 'client' && i.number && i.number.startsWith(pre)).reduce((m, i) => Math.max(m, parseInt(i.number.slice(pre.length), 10) || 0), 0);
    return pre + String(max + 1).padStart(4, '0');
  }

  function openForm(inv, preset) {
    const isEdit = !!(inv && inv.id);
    const i = inv || Object.assign({ direction: st.dir, issueDate: U.today(), vatRate: S.settings.vatDefault, status: 'emise' }, preset || {});
    if (!isEdit && i.direction === 'client' && !i.number) i.number = nextNumber();
    const type = i.direction === 'client' ? 'recette' : 'depense';
    const terms = (tp) => (S.get('thirdParties', tp) || {}).paymentTerms || 30;
    if (!i.dueDate) i.dueDate = U.addDays(i.issueDate, 30);
    const body = '<form novalidate id="invForm"><div class="form-grid">' +
      '<fieldset class="field full" style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:.35rem">Sens de la facture</legend><div class="segmented"><label class="inc"><input type="radio" name="direction" value="client"' + (i.direction === 'client' ? ' checked' : '') + (isEdit ? ' disabled' : '') + '><span>Client (vente)</span></label><label class="exp"><input type="radio" name="direction" value="fournisseur"' + (i.direction === 'fournisseur' ? ' checked' : '') + (isEdit ? ' disabled' : '') + '><span>Fournisseur (achat)</span></label></div></fieldset>' +
      Fm.input({ name: 'number', label: 'Numéro de facture', value: i.number, required: true, attrs: ' maxlength="40" autocomplete="off"' }) +
      Fm.select({ name: 'thirdPartyId', label: 'Tiers', value: i.thirdPartyId, required: true, placeholder: 'Choisir…', options: Fm.optThirdParties(i.direction) }) +
      Fm.input({ name: 'label', label: 'Objet', value: i.label, required: true, full: true, attrs: ' maxlength="120"' }) +
      Fm.input({ name: 'issueDate', label: "Date d'émission", type: 'date', value: i.issueDate, required: true }) +
      Fm.input({ name: 'dueDate', label: "Date d'échéance", type: 'date', value: i.dueDate, required: true, hint: 'Calculée selon le délai de paiement du tiers.' }) +
      Fm.money({ name: 'amount', label: 'Montant HT', value: i.amountHT, required: true }) +
      Fm.select({ name: 'vatRate', label: 'Taux de TVA', value: i.vatRate, options: Fm.optVat() }) +
      Fm.select({ name: 'categoryId', label: 'Catégorie', value: i.categoryId, required: true, placeholder: 'Choisir…', options: Fm.optCategories(type) }) +
      Fm.select({ name: 'status', label: 'Statut', value: i.status === 'payee' ? 'emise' : i.status, options: [{ value: 'brouillon', label: 'Brouillon' }, { value: 'emise', label: i.direction === 'client' ? 'Émise (à encaisser)' : 'Reçue (à payer)' }], attrs: i.status === 'payee' ? ' disabled' : '' }) +
      '<div class="field full"><div class="calc-box" aria-live="polite"><div><span>HT</span><strong data-c="ht">—</strong></div><div><span>TVA</span><strong data-c="vat">—</strong></div><div><span>TTC</span><strong data-c="ttc">—</strong></div></div></div>' +
      Fm.textarea({ name: 'notes', label: 'Notes', value: i.notes, max: 500 }) +
      Fm.attachField(i.attachments) + '</div></form>';
    UI.modal({
      title: isEdit ? 'Modifier la facture ' + i.number : 'Nouvelle facture', size: 'lg', body,
      foot: '<button type="button" class="btn" data-close>Annuler</button><button type="submit" form="invForm" class="btn btn-primary">' + O.icon('check') + 'Enregistrer</button>',
      onOpen(dlg, api) {
        const form = dlg.querySelector('#invForm');
        Fm.liveClear(form);
        const att = Fm.bindAttach(dlg, i.attachments, 'factures');
        const calc = () => { const v = Fm.values(form), c = U.toCents(v.amount), a = isNaN(c) ? null : F.amounts(c, v.vatRate); ['ht', 'vat', 'ttc'].forEach((k, n) => { dlg.querySelector('[data-c="' + k + '"]').textContent = a ? U.money([a.amountHT, a.amountVAT, a.amountTTC][n]) : '—'; }); };
        calc();
        form.addEventListener('input', calc);
        form.addEventListener('change', (e) => {
          calc();
          const v = Fm.values(form);
          if (e.target.name === 'thirdPartyId' || e.target.name === 'issueDate') {
            if (U.validDate(v.issueDate)) form.querySelector('[name="dueDate"]').value = U.addDays(v.issueDate, terms(v.thirdPartyId));
          }
          if (e.target.name === 'direction') {
            const d = e.target.value, t = d === 'client' ? 'recette' : 'depense';
            form.querySelector('[name="thirdPartyId"]').innerHTML = '<option value="">Choisir…</option>' + Fm.optionsHTML(Fm.optThirdParties(d));
            form.querySelector('[name="categoryId"]').innerHTML = '<option value="">Choisir…</option>' + Fm.optionsHTML(Fm.optCategories(t));
            const num = form.querySelector('[name="number"]');
            if (d === 'client' && !num.value) num.value = nextNumber();
            if (d === 'fournisseur' && /^FAC-/.test(num.value)) num.value = '';
          }
        });
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const R = Fm.R, v = Fm.values(form);
          const dir = isEdit ? i.direction : v.direction;
          const dupe = (val) => S.all('invoices').some((x) => x.id !== i.id && x.direction === dir && x.number === val && (dir === 'client' || x.thirdPartyId === v.thirdPartyId)) ? 'Ce numéro existe déjà.' : null;
          const after = (val, all) => (U.validDate(val) && U.validDate(all.issueDate) && val < all.issueDate ? "L'échéance doit suivre la date d'émission." : null);
          if (!Fm.validate(form, { number: [R.required, R.max(40), dupe], thirdPartyId: [R.required], label: [R.required, R.max(120)], issueDate: [R.required, R.date], dueDate: [R.required, R.date, after], amount: [R.money], categoryId: [R.required] })) return;
          const btn = dlg.querySelector('button[type="submit"]'); UI.setBusy(btn, true);
          try {
            const attachments = await att.commit();
            const rec = Object.assign({ direction: dir, number: v.number, thirdPartyId: v.thirdPartyId, label: v.label, issueDate: v.issueDate, dueDate: v.dueDate, vatRate: Number(v.vatRate), categoryId: v.categoryId, notes: v.notes, attachments }, F.amounts(U.toCents(v.amount), v.vatRate));
            if (i.status !== 'payee') rec.status = v.status;
            if (isEdit) {
              await S.update('invoices', i.id, rec);
              if (i.transactionId && S.get('transactions', i.transactionId)) {
                await S.update('transactions', i.transactionId, { amountHT: rec.amountHT, amountVAT: rec.amountVAT, amountTTC: rec.amountTTC, vatRate: rec.vatRate, categoryId: rec.categoryId, thirdPartyId: rec.thirdPartyId });
              }
            } else await S.create('invoices', Object.assign(rec, { transactionId: null, paidDate: null }));
            UI.toast(isEdit ? 'Facture mise à jour.' : 'Facture enregistrée.');
            api.close();
          } catch (err) { UI.error(err); UI.setBusy(btn, false); }
        });
      }
    });
  }

  /** Règlement : crée l'opération de trésorerie liée */
  function settle(inv) {
    const body = '<form novalidate id="payForm"><p>Enregistrer le ' + (inv.direction === 'client' ? 'encaissement' : 'paiement') + ' de la facture <strong>' + U.esc(inv.number) + '</strong> — <span class="num">' + U.money(inv.amountTTC) + '</span> TTC. Une opération de trésorerie sera créée automatiquement.</p><div class="form-grid">' +
      Fm.input({ name: 'date', label: 'Date de règlement', type: 'date', value: U.today(), required: true }) +
      Fm.select({ name: 'accountId', label: 'Compte', value: (S.all('accounts')[0] || {}).id, required: true, options: Fm.optAccounts() }) +
      Fm.select({ name: 'paymentMethodId', label: 'Moyen de paiement', placeholder: 'Non précisé', value: (S.all('paymentMethods')[0] || {}).id, options: Fm.optPayments() }) +
      Fm.input({ name: 'reference', label: 'Référence', value: inv.number }) + '</div></form>';
    UI.modal({
      title: inv.direction === 'client' ? 'Encaisser la facture' : 'Payer la facture', body,
      foot: '<button type="button" class="btn" data-close>Annuler</button><button type="submit" form="payForm" class="btn btn-primary">' + O.icon('check') + 'Valider le règlement</button>',
      onOpen(dlg, api) {
        const form = dlg.querySelector('#payForm');
        form.addEventListener('change', (e) => { if (e.target.name === 'paymentMethodId') { const pm = S.get('paymentMethods', e.target.value); if (pm && pm.accountId) form.querySelector('[name="accountId"]').value = pm.accountId; } });
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!Fm.validate(form, { date: [Fm.R.required, Fm.R.date], accountId: [Fm.R.required] })) return;
          const v = Fm.values(form);
          try {
            const tx = await S.create('transactions', {
              type: inv.direction === 'client' ? 'recette' : 'depense', date: v.date, label: (inv.direction === 'client' ? 'Règlement ' : 'Paiement ') + inv.number + ' — ' + inv.label,
              amountHT: inv.amountHT, amountVAT: inv.amountVAT, amountTTC: inv.amountTTC, vatRate: inv.vatRate, categoryId: inv.categoryId, thirdPartyId: inv.thirdPartyId,
              accountId: v.accountId, paymentMethodId: v.paymentMethodId || null, status: 'payee', reference: v.reference, notes: '', attachments: (inv.attachments || []).slice(), invoiceId: inv.id, scheduleId: null
            }, true);
            await S.update('invoices', inv.id, { status: 'payee', paidDate: v.date, transactionId: tx.id });
            UI.toast('Règlement enregistré et opération créée.');
            api.close();
          } catch (err) { UI.error(err); }
        });
      }
    });
  }

  function exportCSV(rows) {
    const head = ['Numéro', 'Sens', 'Tiers', 'Objet', 'Émission', 'Échéance', 'HT', 'TVA', 'TTC', 'Statut', 'Réglée le'];
    U.download(U.csv([head].concat(rows.map((i) => [i.number, i.direction === 'client' ? 'Client' : 'Fournisseur', S.name('thirdParties', i.thirdPartyId, ''), i.label, U.fmtDate(i.issueDate), U.fmtDate(i.dueDate), U.num(i.amountHT), U.num(i.amountVAT), U.num(i.amountTTC), F.invoiceState(i).label, i.paidDate ? U.fmtDate(i.paidDate) : '']))), 'factures-' + st.dir + '-' + U.today() + '.csv');
    UI.toast('Export CSV généré.');
  }

  O.Views.invoices = {
    title: 'Factures',
    openForm,
    render(root) {
      const today = U.today();
      const all = S.all('invoices').filter((i) => i.direction === st.dir);
      const rows = all.filter((i) => (!st.status || F.invoiceState(i).key === st.status) && (!st.q || U.norm(i.number + ' ' + i.label + ' ' + S.name('thirdParties', i.thirdPartyId, '')).includes(U.norm(st.q))));
      const open = all.filter((i) => i.status === 'emise'), late = open.filter((i) => i.dueDate < today);
      const paid12 = all.filter((i) => i.status === 'payee' && i.paidDate >= U.addDays(today, -365));
      const avgDelay = paid12.length ? Math.round(U.sum(paid12, (i) => Math.max(0, U.diffDays(i.issueDate, i.paidDate))) / paid12.length) : null;
      const word = st.dir === 'client' ? 'encaisser' : 'payer';

      root.innerHTML = '<div class="view">' +
        '<div class="page-head"><div><div class="eyebrow">Facturation</div><h1>Factures</h1><p>Suivi des factures émises et reçues, relances et règlements.</p></div>' +
        '<div class="page-actions"><button class="btn" data-act="csv">' + O.icon('download') + 'Exporter CSV</button><button class="btn btn-primary" data-act="new">' + O.icon('plus') + 'Nouvelle facture</button></div></div>' +
        '<div class="tabs mb" role="tablist" aria-label="Sens des factures"><button role="tab" type="button" aria-selected="' + (st.dir === 'client') + '" data-dir="client">Factures clients</button><button role="tab" type="button" aria-selected="' + (st.dir === 'fournisseur') + '" data-dir="fournisseur">Factures fournisseurs</button></div>' +
        '<section class="grid grid-kpi stagger mb">' +
        '<div class="card kpi warn"><div class="kpi-top"><span class="kpi-label">Reste à ' + word + '</span><span class="kpi-icon">' + O.icon('clock') + '</span></div><div class="kpi-value" data-count="' + U.sum(open, (i) => i.amountTTC) + '">—</div><div class="kpi-foot">' + open.length + ' facture(s) ouverte(s)</div></div>' +
        '<div class="card kpi exp"><div class="kpi-top"><span class="kpi-label">En retard</span><span class="kpi-icon">' + O.icon('alert') + '</span></div><div class="kpi-value" data-count="' + U.sum(late, (i) => i.amountTTC) + '">—</div><div class="kpi-foot">' + late.length + ' facture(s) échue(s)</div></div>' +
        '<div class="card kpi inc"><div class="kpi-top"><span class="kpi-label">Réglé sur 12 mois</span><span class="kpi-icon">' + O.icon('checkCircle') + '</span></div><div class="kpi-value" data-count="' + U.sum(paid12, (i) => i.amountTTC) + '">—</div><div class="kpi-foot">' + paid12.length + ' facture(s)</div></div>' +
        '<div class="card kpi info"><div class="kpi-top"><span class="kpi-label">Délai moyen de règlement</span><span class="kpi-icon">' + O.icon('calendar') + '</span></div><div class="kpi-value">' + (avgDelay == null ? '—' : avgDelay + ' j') + '</div><div class="kpi-foot">entre émission et paiement</div></div>' +
        '</section>' +
        '<section class="card flush"><div class="toolbar"><label class="sr-only" for="invQ">Rechercher</label><input id="invQ" class="input grow" type="search" placeholder="Numéro, objet, tiers…" value="' + U.esc(st.q) + '">' +
        '<div class="flex" role="group" aria-label="Filtrer par statut">' + [['', 'Toutes'], ['attente', st.dir === 'client' ? 'À encaisser' : 'À payer'], ['retard', 'En retard'], ['payee', 'Réglées'], ['brouillon', 'Brouillons']].map(([k, l]) => '<button type="button" class="chip" aria-pressed="' + (st.status === k) + '" data-status="' + k + '">' + l + '</button>').join('') + '</div></div>' +
        '<div data-table></div></section></div>';

      table = table || new O.DataTable({
        caption: 'Liste des factures', pageSize: 15, sort: { key: 'dueDate', dir: 'desc' },
        columns: [
          { key: 'number', label: 'N°', cls: 'nowrap', render: (i) => '<span class="mono cell-main">' + U.esc(i.number) + '</span>' },
          { key: 'thirdPartyId', label: 'Tiers', cls: 'w-lg', sortValue: (i) => S.name('thirdParties', i.thirdPartyId, ''), render: (i) => '<div class="cell-main">' + U.esc(S.name('thirdParties', i.thirdPartyId)) + '</div><div class="cell-sub">' + U.esc(i.label) + ((i.attachments || []).length ? ' · 📎 ' + i.attachments.length : '') + '</div>' },
          { key: 'issueDate', label: 'Émise le', cls: 'nowrap', render: (i) => '<span class="num">' + U.fmtDate(i.issueDate) + '</span>' },
          { key: 'dueDate', label: 'Échéance', render: (i) => '<span class="num">' + U.fmtDate(i.dueDate) + '</span>' + (i.status === 'emise' ? '<div class="cell-sub">' + U.relDays(i.dueDate) + '</div>' : '') },
          { key: 'status', label: 'Statut', sortValue: (i) => F.invoiceState(i).key, render: (i) => { const s = F.invoiceState(i); return '<span class="badge ' + s.cls + '">' + s.label + '</span>' + (i.paidDate ? '<div class="cell-sub">le ' + U.fmtDate(i.paidDate) + '</div>' : ''); } },
          { key: 'amountTTC', label: 'TTC', cls: 'r', render: (i) => '<span class="num cell-main">' + U.money(i.amountTTC) + '</span><div class="cell-sub num">HT ' + U.money(i.amountHT) + '</div>' },
          { key: '', label: '', actions: true, render: (i) => (i.status === 'emise' ? '<button class="btn btn-sm btn-primary" data-pay="' + i.id + '">' + O.icon('check') + (i.direction === 'client' ? 'Encaisser' : 'Payer') + '</button>' : '') + (i.status === 'brouillon' ? '<button class="btn btn-sm" data-issue="' + i.id + '">Émettre</button>' : '') + '<button class="icon-btn sm" data-edit="' + i.id + '" aria-label="Modifier la facture ' + U.esc(i.number) + '">' + O.icon('edit') + '</button><button class="icon-btn sm danger" data-del="' + i.id + '" aria-label="Supprimer la facture ' + U.esc(i.number) + '">' + O.icon('trash') + '</button>' }
        ],
        footer: (rs) => '<tr><td colspan="5">' + rs.length + ' facture(s)</td><td class="r"><span class="num">' + U.money(U.sum(rs, (i) => i.amountTTC)) + '</span></td><td></td></tr>'
      });
      table.setRows(rows).mount(root.querySelector('[data-table]')).render();
      UI.countUp(root);

      root.querySelector('#invQ').addEventListener('input', U.debounce((e) => { st.q = e.target.value; const r = S.all('invoices').filter((i) => i.direction === st.dir && (!st.status || F.invoiceState(i).key === st.status) && (!st.q || U.norm(i.number + ' ' + i.label + ' ' + S.name('thirdParties', i.thirdPartyId, '')).includes(U.norm(st.q)))); table.page = 1; table.setRows(r).render(); }, 200));
      root.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.dir) { st.dir = b.dataset.dir; st.status = ''; table.page = 1; O.App.refresh(); }
        else if (b.dataset.status != null && b.classList.contains('chip')) { st.status = b.dataset.status; table.page = 1; O.App.refresh(); }
        else if (b.dataset.act === 'new') openForm(null, { direction: st.dir });
        else if (b.dataset.act === 'csv') exportCSV(rows);
        else if (b.dataset.pay) settle(S.get('invoices', b.dataset.pay));
        else if (b.dataset.issue) { await S.update('invoices', b.dataset.issue, { status: 'emise' }); UI.toast('Facture émise.'); }
        else if (b.dataset.edit) openForm(S.get('invoices', b.dataset.edit));
        else if (b.dataset.del) {
          const inv = S.get('invoices', b.dataset.del);
          if (await UI.confirm('Supprimer la facture ' + inv.number + ' ?', { danger: true, ok: 'Supprimer', detail: inv.transactionId ? "L'opération de règlement associée est conservée (le lien est retiré)." : '' })) {
            try { await S.remove('invoices', inv.id); UI.toast('Facture supprimée.'); } catch (err) { UI.error(err); }
          }
        }
      });
    }
  };
})(window.Ondea);
