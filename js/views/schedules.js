/* ==========================================================================
   Vue — Échéancier (charges et recettes récurrentes, échéances à venir)
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, F = O.F, UI = O.UI, Fm = O.Forms;
  O.Views = O.Views || {};
  const st = { horizon: 90 };

  function openForm(sch) {
    const isEdit = !!(sch && sch.id);
    const s = sch || { type: 'depense', frequency: 'mensuelle', nextDate: U.addDays(U.today(), 7), vatRate: S.settings.vatDefault, active: true, accountId: (S.all('accounts')[0] || {}).id };
    const body = '<form novalidate id="schForm"><div class="form-grid">' +
      Fm.typeSwitch('type', s.type) +
      Fm.input({ name: 'label', label: 'Libellé', value: s.label, required: true, full: true, attrs: ' maxlength="120"' }) +
      Fm.select({ name: 'frequency', label: 'Fréquence', value: s.frequency, options: Object.keys(F.FREQ).map((k) => ({ value: k, label: F.FREQ[k].label })) }) +
      Fm.input({ name: 'nextDate', label: 'Prochaine échéance', type: 'date', value: s.nextDate, required: true }) +
      Fm.money({ name: 'amount', label: 'Montant HT', value: s.amountHT, required: true }) +
      Fm.select({ name: 'vatRate', label: 'Taux de TVA', value: s.vatRate, options: Fm.optVat() }) +
      Fm.select({ name: 'categoryId', label: 'Catégorie', value: s.categoryId, required: true, placeholder: 'Choisir…', options: Fm.optCategories(s.type) }) +
      Fm.select({ name: 'thirdPartyId', label: 'Tiers', value: s.thirdPartyId, placeholder: 'Aucun', options: Fm.optThirdParties(s.type === 'recette' ? 'client' : 'fournisseur') }) +
      Fm.select({ name: 'accountId', label: 'Compte', value: s.accountId, required: true, options: Fm.optAccounts() }) +
      Fm.select({ name: 'paymentMethodId', label: 'Moyen de paiement', value: s.paymentMethodId, placeholder: 'Non précisé', options: Fm.optPayments() }) +
      Fm.input({ name: 'endDate', label: 'Date de fin (facultatif)', type: 'date', value: s.endDate }) +
      Fm.check({ name: 'active', label: 'Échéance active', checked: s.active !== false }) +
      '</div></form>';
    UI.modal({
      title: isEdit ? "Modifier l'échéance" : 'Nouvelle échéance récurrente', size: 'lg', body,
      foot: '<button type="button" class="btn" data-close>Annuler</button><button type="submit" form="schForm" class="btn btn-primary">' + O.icon('check') + 'Enregistrer</button>',
      onOpen(dlg, api) {
        const form = dlg.querySelector('#schForm');
        Fm.liveClear(form);
        form.addEventListener('change', (e) => {
          if (e.target.name === 'type') {
            const t = e.target.value;
            form.querySelector('[name="categoryId"]').innerHTML = '<option value="">Choisir…</option>' + Fm.optionsHTML(Fm.optCategories(t));
            form.querySelector('[name="thirdPartyId"]').innerHTML = '<option value="">Aucun</option>' + Fm.optionsHTML(Fm.optThirdParties(t === 'recette' ? 'client' : 'fournisseur'));
          }
        });
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const R = Fm.R;
          const endOk = (v, all) => (v && U.validDate(v) && v < all.nextDate ? 'La date de fin doit suivre la prochaine échéance.' : null);
          if (!Fm.validate(form, { label: [R.required, R.max(120)], nextDate: [R.required, R.date], amount: [R.money], categoryId: [R.required], accountId: [R.required], endDate: [R.date, endOk] })) return;
          const v = Fm.values(form);
          const rec = Object.assign({ type: v.type, label: v.label, frequency: v.frequency, nextDate: v.nextDate, endDate: v.endDate || '', vatRate: Number(v.vatRate), categoryId: v.categoryId, thirdPartyId: v.thirdPartyId || null, accountId: v.accountId, paymentMethodId: v.paymentMethodId || null, active: !!v.active }, F.amounts(U.toCents(v.amount), v.vatRate));
          try { isEdit ? await S.update('schedules', s.id, rec) : await S.create('schedules', rec); UI.toast('Échéance enregistrée.'); api.close(); }
          catch (err) { UI.error(err); }
        });
      }
    });
  }

  /** Génère l'opération de l'échéance courante et avance la date */
  async function generate(sch, silent) {
    const date = sch.nextDate;
    await S.create('transactions', {
      type: sch.type, date, label: sch.label, amountHT: sch.amountHT, amountVAT: sch.amountVAT, amountTTC: sch.amountTTC, vatRate: sch.vatRate,
      categoryId: sch.categoryId, thirdPartyId: sch.thirdPartyId, accountId: sch.accountId, paymentMethodId: sch.paymentMethodId,
      status: date <= U.today() ? 'payee' : 'en_attente', reference: 'ECH-' + date, notes: 'Générée depuis l’échéancier', attachments: [], invoiceId: null, scheduleId: sch.id
    }, true);
    const next = F.nextAfter(sch);
    await S.update('schedules', sch.id, next ? { nextDate: next } : { active: false }, true);
    if (!silent) { S.emit('transactions'); UI.toast('Opération générée' + (next ? ' — prochaine échéance le ' + U.fmtDate(next) : ' — échéance terminée') + '.'); }
  }

  O.Views.schedules = {
    title: 'Échéancier',
    render(root) {
      const today = U.today();
      const items = F.upcoming(st.horizon);
      const due = S.all('schedules').filter((s) => s.active && s.nextDate <= today);
      const inc = U.sum(items.filter((i) => i.type === 'recette' && !i.overdue), (i) => i.amount);
      const exp = U.sum(items.filter((i) => i.type === 'depense' && !i.overdue), (i) => i.amount);
      const monthlyFixed = U.sum(S.all('schedules').filter((s) => s.active && s.type === 'depense'), (s) => { const m = F.FREQ[s.frequency].months; return m ? Math.round(s.amountTTC / m) : 0; });
      const groups = {};
      items.forEach((it) => { const k = it.overdue ? 'retard' : U.monthKey(it.date); (groups[k] = groups[k] || []).push(it); });

      root.innerHTML = '<div class="view">' +
        '<div class="page-head"><div><div class="eyebrow">Planification</div><h1>Échéancier</h1><p>Charges fixes, abonnements, factures et opérations à venir.</p></div>' +
        '<div class="page-actions">' + (due.length ? '<button class="btn" data-act="gen-all">' + O.icon('zap') + 'Générer les ' + due.length + ' échéance(s) échue(s)</button>' : '') + '<button class="btn btn-primary" data-act="new">' + O.icon('plus') + 'Nouvelle échéance</button></div></div>' +
        (due.length ? '<div class="alert warn">' + O.icon('alert') + '<p><strong>' + due.length + ' échéance(s) récurrente(s)</strong> sont arrivées à terme. Générez-les pour les enregistrer en trésorerie.</p></div>' : '') +
        '<section class="grid grid-kpi stagger mb">' +
        '<div class="card kpi inc"><div class="kpi-top"><span class="kpi-label">Entrées prévues (' + st.horizon + ' j)</span><span class="kpi-icon">' + O.icon('arrowDown') + '</span></div><div class="kpi-value" data-count="' + inc + '">—</div></div>' +
        '<div class="card kpi exp"><div class="kpi-top"><span class="kpi-label">Sorties prévues (' + st.horizon + ' j)</span><span class="kpi-icon">' + O.icon('arrowUp') + '</span></div><div class="kpi-value" data-count="' + exp + '">—</div></div>' +
        '<div class="card kpi"><div class="kpi-top"><span class="kpi-label">Charges fixes mensualisées</span><span class="kpi-icon">' + O.icon('calendar') + '</span></div><div class="kpi-value" data-count="' + monthlyFixed + '">—</div><div class="kpi-foot">TTC / mois, échéances actives</div></div>' +
        '</section>' +
        '<div class="grid grid-main">' +
        '<section class="card"><div class="card-head"><h2>Calendrier des flux</h2><div class="tabs" role="tablist" aria-label="Horizon">' + [30, 90, 180].map((n) => '<button role="tab" type="button" aria-selected="' + (st.horizon === n) + '" data-h="' + n + '">' + n + ' j</button>').join('') + '</div></div>' +
        (items.length ? Object.keys(groups).map((k) => '<h3 class="mt" style="font-size:1rem;color:' + (k === 'retard' ? 'var(--danger)' : 'var(--gold)') + '">' + (k === 'retard' ? 'En retard' : U.monthLabel(k, true)) + '</h3><ul class="list">' + groups[k].map((it) => { const d = U.parse(it.date); return '<li><div class="date-tile"><b>' + d.getDate() + '</b><span>' + U.MONTHS[d.getMonth()] + '</span></div><div class="grow"><div class="title">' + U.esc(it.label) + '</div><div class="cell-sub">' + (it.kind === 'echeance' ? 'Échéance ' + F.FREQ[it.ref.frequency].label.toLowerCase() : it.kind === 'facture' ? 'Facture' : 'Opération en attente') + ' · ' + U.relDays(it.date) + '</div></div><span class="num ' + (it.type === 'recette' ? 'amount-inc' : 'amount-exp') + '">' + (it.type === 'recette' ? '+' : '−') + U.money(it.amount) + '</span></li>'; }).join('') + '</ul>').join('') : UI.empty('Aucun flux prévu', 'Ajoutez des échéances récurrentes pour anticiper votre trésorerie.')) +
        '</section>' +
        '<section class="card"><div class="card-head"><h2>Échéances récurrentes</h2><span class="badge b-gold plain">' + S.all('schedules').length + '</span></div>' +
        (S.all('schedules').length ? '<ul class="list">' + S.all('schedules').slice().sort((a, b) => (b.active - a.active) || a.nextDate.localeCompare(b.nextDate)).map((s) => '<li style="align-items:flex-start"><div class="grow"><div class="title">' + U.esc(s.label) + '</div><div class="cell-sub">' + F.FREQ[s.frequency].label + ' · ' + (s.active ? 'prochaine le ' + U.fmtDate(s.nextDate) : '<span class="badge b-muted">En pause</span>') + '</div><div class="num ' + (s.type === 'recette' ? 'amount-inc' : 'amount-exp') + '" style="margin-top:.2rem">' + (s.type === 'recette' ? '+' : '−') + U.money(s.amountTTC) + '</div>' +
          '<div class="flex" style="margin-top:.45rem;gap:.35rem">' + (s.active ? '<button class="btn btn-sm" data-gen="' + s.id + '">' + O.icon('zap') + 'Générer</button>' : '') +
          '<button class="icon-btn sm" data-toggle="' + s.id + '" aria-label="' + (s.active ? 'Mettre en pause ' : 'Réactiver ') + U.esc(s.label) + '">' + O.icon(s.active ? 'pause' : 'play') + '</button>' +
          '<button class="icon-btn sm" data-edit="' + s.id + '" aria-label="Modifier ' + U.esc(s.label) + '">' + O.icon('edit') + '</button><button class="icon-btn sm danger" data-del="' + s.id + '" aria-label="Supprimer ' + U.esc(s.label) + '">' + O.icon('trash') + '</button></div></div></li>').join('') + '</ul>' : UI.empty('Aucune échéance', '')) +
        '</section></div></div>';
      UI.countUp(root);

      root.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        try {
          if (b.dataset.h) { st.horizon = Number(b.dataset.h); O.App.refresh(); }
          else if (b.dataset.act === 'new') openForm();
          else if (b.dataset.act === 'gen-all') {
            let n = 0;
            for (let guard = 0; guard < 500; guard++) {
              const s = S.all('schedules').find((x) => x.active && x.nextDate <= U.today());
              if (!s) break; await generate(s, true); n++;
            }
            S.emit('transactions'); UI.toast(n + ' opération(s) générée(s) depuis l’échéancier.');
          } else if (b.dataset.gen) await generate(S.get('schedules', b.dataset.gen));
          else if (b.dataset.toggle) { const s = S.get('schedules', b.dataset.toggle); await S.update('schedules', s.id, { active: !s.active }); UI.toast(s.active ? 'Échéance mise en pause.' : 'Échéance réactivée.'); }
          else if (b.dataset.edit) openForm(S.get('schedules', b.dataset.edit));
          else if (b.dataset.del) { const s = S.get('schedules', b.dataset.del); if (await UI.confirm('Supprimer l’échéance « ' + s.label + ' » ?', { danger: true, ok: 'Supprimer', detail: 'Les opérations déjà générées sont conservées.' })) { await S.remove('schedules', s.id); UI.toast('Échéance supprimée.'); } }
        } catch (err) { UI.error(err); }
      });
    }
  };
})(window.Ondea);
