/* ==========================================================================
   Vue — Trésorerie : comptes, virements internes, prévisionnel
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, F = O.F, UI = O.UI, Fm = O.Forms, Ch = O.Charts;
  O.Views = O.Views || {};
  const st = { horizon: 90 };

  function accountForm(a) {
    const isEdit = !!(a && a.id);
    const x = a || { color: '#D4AF37', openingBalance: 0 };
    UI.modal({
      title: isEdit ? 'Modifier le compte' : 'Nouveau compte de trésorerie', body: '<form novalidate id="accForm"><div class="form-grid">' +
        Fm.input({ name: 'name', label: 'Nom du compte', value: x.name, required: true, attrs: ' maxlength="60"' }) +
        Fm.input({ name: 'bank', label: 'Établissement', value: x.bank, attrs: ' maxlength="60"' }) +
        Fm.input({ name: 'iban', label: 'IBAN (masqué conseillé)', value: x.iban, attrs: ' maxlength="40"', hint: 'Ex. : FR76 •••• •••• 1234' }) +
        Fm.input({ name: 'openingBalance', label: "Solde d'ouverture", value: U.centsToInput(x.openingBalance || 0), affix: '€', attrs: ' inputmode="decimal"', required: true, hint: 'Peut être négatif (découvert).' }) +
        '<div class="field"><label for="accColor">Couleur</label><input id="accColor" type="color" name="color" class="color-input" value="' + U.esc(x.color) + '"></div>' +
        '</div></form>',
      foot: '<button type="button" class="btn" data-close>Annuler</button><button type="submit" form="accForm" class="btn btn-primary">' + O.icon('check') + 'Enregistrer</button>',
      onOpen(dlg, api) {
        const form = dlg.querySelector('#accForm'); Fm.liveClear(form);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const signed = (v) => (isNaN(U.toCents(v)) ? 'Montant invalide.' : null);
          if (!Fm.validate(form, { name: [Fm.R.required, Fm.R.max(60)], openingBalance: [Fm.R.required, signed] })) return;
          const v = Fm.values(form);
          try { const rec = { name: v.name, bank: v.bank, iban: v.iban, openingBalance: U.toCents(v.openingBalance), color: v.color }; isEdit ? await S.update('accounts', x.id, rec) : await S.create('accounts', rec); UI.toast('Compte enregistré.'); api.close(); } catch (err) { UI.error(err); }
        });
      }
    });
  }

  function transferForm(t) {
    const isEdit = !!(t && t.id);
    const accs = S.all('accounts');
    if (accs.length < 2) { UI.toast('Créez au moins deux comptes pour effectuer un virement interne.', 'info'); return; }
    const x = t || { date: U.today(), fromId: accs[0].id, toId: accs[1].id };
    UI.modal({
      title: isEdit ? 'Modifier le virement' : 'Virement entre comptes', body: '<form novalidate id="trfForm"><div class="form-grid">' +
        Fm.select({ name: 'fromId', label: 'Compte débité', value: x.fromId, required: true, options: Fm.optAccounts() }) +
        Fm.select({ name: 'toId', label: 'Compte crédité', value: x.toId, required: true, options: Fm.optAccounts() }) +
        Fm.money({ name: 'amount', label: 'Montant', value: x.amount, required: true }) +
        Fm.input({ name: 'date', label: 'Date', type: 'date', value: x.date, required: true }) +
        Fm.input({ name: 'label', label: 'Libellé', value: x.label || 'Virement interne', full: true, attrs: ' maxlength="80"' }) +
        '</div><p class="muted small">Un virement interne ne modifie ni le résultat ni la trésorerie globale : il déplace des fonds entre vos comptes.</p></form>',
      foot: '<button type="button" class="btn" data-close>Annuler</button><button type="submit" form="trfForm" class="btn btn-primary">' + O.icon('transfer') + 'Valider</button>',
      onOpen(dlg, api) {
        const form = dlg.querySelector('#trfForm'); Fm.liveClear(form);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const diff = (v, all) => (v === all.fromId ? 'Choisissez deux comptes différents.' : null);
          if (!Fm.validate(form, { fromId: [Fm.R.required], toId: [Fm.R.required, diff], amount: [Fm.R.money], date: [Fm.R.required, Fm.R.date] })) return;
          const v = Fm.values(form);
          try { const rec = { fromId: v.fromId, toId: v.toId, amount: U.toCents(v.amount), date: v.date, label: v.label || 'Virement interne' }; isEdit ? await S.update('transfers', x.id, rec) : await S.create('transfers', rec); UI.toast('Virement enregistré.'); api.close(); } catch (err) { UI.error(err); }
        });
      }
    });
  }

  O.Views.treasury = {
    title: 'Trésorerie',
    render(root) {
      const today = U.today();
      const accs = S.all('accounts');
      const months = U.lastMonths(12);
      const total = F.totalBalance(today);
      const fc = F.forecast(st.horizon);
      const up = F.upcoming(st.horizon);
      const transfers = S.all('transfers').slice().sort((a, b) => b.date.localeCompare(a.date));
      const series = F.cashSeries(months);
      const burn = Math.round(U.sum(series.slice(-3), (s) => s.exp) / 3);
      const runway = burn ? total / burn : null;

      root.innerHTML = '<div class="view">' +
        '<div class="page-head"><div><div class="eyebrow">Liquidités</div><h1>Trésorerie</h1><p>Soldes réels (opérations payées) et prévisionnel intégrant factures, échéances et opérations en attente.</p></div>' +
        '<div class="page-actions"><button class="btn" data-act="transfer">' + O.icon('transfer') + 'Virement interne</button><button class="btn btn-primary" data-act="new-acc">' + O.icon('plus') + 'Nouveau compte</button></div></div>' +
        '<section class="grid grid-kpi stagger mb">' +
        '<div class="card kpi hero"><div class="kpi-top"><span class="kpi-label">Trésorerie totale</span><span class="kpi-icon">' + O.icon('wallet') + '</span></div><div class="kpi-value" data-count="' + total + '">—</div><div class="kpi-foot">au ' + U.fmtDate(today) + '</div></div>' +
        '<div class="card kpi ' + (fc.end >= total ? 'inc' : 'exp') + '"><div class="kpi-top"><span class="kpi-label">Solde prévu à ' + st.horizon + ' j</span><span class="kpi-icon">' + O.icon(fc.end >= total ? 'trendUp' : 'trendDown') + '</span></div><div class="kpi-value" data-count="' + fc.end + '">—</div><div class="kpi-foot">' + U.moneySigned(fc.end - total) + '</div></div>' +
        '<div class="card kpi ' + (fc.min.value < 0 ? 'exp' : 'warn') + '"><div class="kpi-top"><span class="kpi-label">Point bas prévu</span><span class="kpi-icon">' + O.icon('alert') + '</span></div><div class="kpi-value" data-count="' + fc.min.value + '">—</div><div class="kpi-foot">le ' + U.fmtDate(fc.min.date) + '</div></div>' +
        '<div class="card kpi info"><div class="kpi-top"><span class="kpi-label">Autonomie financière</span><span class="kpi-icon">' + O.icon('clock') + '</span></div><div class="kpi-value">' + (runway == null ? '—' : runway.toFixed(1).replace('.', ',') + ' mois') + '</div><div class="kpi-foot">sur décaissements moyens (3 mois) : ' + U.money(burn) + '</div></div>' +
        '</section>' +
        (fc.min.value < 0 ? '<div class="alert danger">' + O.icon('alert') + '<p><strong>Risque de découvert :</strong> la trésorerie prévisionnelle passe sous zéro le ' + U.fmtDateLong(fc.min.date) + '. Anticipez une relance client ou un report de charge.</p></div>' : '') +
        '<div class="grid grid-3 stagger mb">' + accs.map((a) => { const b = F.balance(a.id, today); const hist = months.map((m) => F.balance(a.id, U.monthEnd(m))); return '<article class="card account-card"><span class="stripe" style="background:' + U.esc(a.color) + '"></span><div class="flex between"><div><h3 style="margin:0;font-family:var(--font-body)">' + U.esc(a.name) + '</h3><div class="bank">' + U.esc(a.bank || '') + (a.iban ? ' · <span class="mono">' + U.esc(a.iban) + '</span>' : '') + '</div></div><div><button class="icon-btn sm" data-edit-acc="' + a.id + '" aria-label="Modifier ' + U.esc(a.name) + '">' + O.icon('edit') + '</button> <button class="icon-btn sm danger" data-del-acc="' + a.id + '" aria-label="Supprimer ' + U.esc(a.name) + '">' + O.icon('trash') + '</button></div></div><div class="bal ' + (b < 0 ? 'amount-exp' : '') + '">' + U.money(b) + '</div><div class="flex between"><span class="cell-sub">' + U.pct(total ? (b / total) * 100 : 0) + ' de la trésorerie</span>' + Ch.spark(hist, U.esc(a.color)) + '</div><a class="btn btn-sm btn-ghost mt" href="#operations" data-filter-acc="' + a.id + '">Voir les opérations</a></article>'; }).join('') + '</div>' +
        '<section class="card mb"><div class="card-head"><div><h2>Prévisionnel de trésorerie</h2><p class="card-sub">Solde quotidien projeté</p></div><div class="tabs" role="tablist" aria-label="Horizon de prévision">' + [30, 60, 90, 180].map((n) => '<button type="button" role="tab" aria-selected="' + (st.horizon === n) + '" data-h="' + n + '">' + n + ' j</button>').join('') + '</div></div>' +
        Ch.line({ title: 'Prévision de trésorerie', points: fc.points, color: 'var(--gold)' }) + '</section>' +
        '<div class="grid grid-2">' +
        '<section class="card"><div class="card-head"><h2>Mouvements prévus</h2><span class="badge b-gold plain">' + up.length + '</span></div>' + (up.length ? '<ul class="list">' + up.slice(0, 14).map((it) => '<li><div class="grow"><div class="title">' + U.esc(it.label) + '</div><div class="cell-sub">' + U.fmtDate(it.date) + (it.overdue ? ' · <span class="badge b-danger">En retard</span>' : '') + '</div></div><span class="num ' + (it.type === 'recette' ? 'amount-inc' : 'amount-exp') + '">' + (it.type === 'recette' ? '+' : '−') + U.money(it.amount) + '</span></li>').join('') + '</ul>' + (up.length > 14 ? '<p class="muted small mt">… et ' + (up.length - 14) + ' autre(s). Voir l’<a href="#echeancier">échéancier</a>.</p>' : '') : UI.empty('Aucun mouvement prévu', '')) + '</section>' +
        '<section class="card"><div class="card-head"><h2>Virements internes</h2><button class="btn btn-sm" data-act="transfer">' + O.icon('plus') + 'Ajouter</button></div>' + (transfers.length ? '<ul class="list">' + transfers.slice(0, 12).map((t) => '<li><div class="grow"><div class="title">' + U.esc(t.label) + '</div><div class="cell-sub">' + U.fmtDate(t.date) + ' · ' + U.esc(S.name('accounts', t.fromId)) + ' → ' + U.esc(S.name('accounts', t.toId)) + '</div></div><span class="num">' + U.money(t.amount) + '</span><button class="icon-btn sm" data-edit-trf="' + t.id + '" aria-label="Modifier le virement">' + O.icon('edit') + '</button><button class="icon-btn sm danger" data-del-trf="' + t.id + '" aria-label="Supprimer le virement">' + O.icon('trash') + '</button></li>').join('') + '</ul>' : UI.empty('Aucun virement', 'Déplacez des fonds entre vos comptes.')) + '</section>' +
        '</div></div>';
      UI.countUp(root);

      root.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-filter-acc]');
        if (a) { O.Views.operations.filterBy({ accountId: a.dataset.filterAcc }); return; }
        const b = e.target.closest('button'); if (!b) return;
        try {
          if (b.dataset.h) { st.horizon = Number(b.dataset.h); O.App.refresh(); }
          else if (b.dataset.act === 'new-acc') accountForm();
          else if (b.dataset.act === 'transfer') transferForm();
          else if (b.dataset.editAcc) accountForm(S.get('accounts', b.dataset.editAcc));
          else if (b.dataset.delAcc) { const x = S.get('accounts', b.dataset.delAcc); if (await UI.confirm('Supprimer le compte « ' + x.name + ' » ?', { danger: true, ok: 'Supprimer' })) { await S.remove('accounts', x.id); UI.toast('Compte supprimé.'); } }
          else if (b.dataset.editTrf) transferForm(S.get('transfers', b.dataset.editTrf));
          else if (b.dataset.delTrf && await UI.confirm('Supprimer ce virement interne ?', { danger: true, ok: 'Supprimer' })) { await S.remove('transfers', b.dataset.delTrf); UI.toast('Virement supprimé.'); }
        } catch (err) { UI.error(err); }
      });
    }
  };
})(window.Ondea);
