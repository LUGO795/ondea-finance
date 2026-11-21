/* ==========================================================================
   Vue — Tableau de bord
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, F = O.F, UI = O.UI, Ch = O.Charts;
  O.Views = O.Views || {};

  const st = { range: 12 };

  O.Views.dashboard = {
    title: 'Tableau de bord',
    render(main) {
      const today = U.today(), mk = U.monthKey(today);
      const prevMk = U.lastMonths(2)[0];
      const cur = F.cashSeries([mk])[0], prev = F.cashSeries([prevMk])[0];
      const res = F.resultSeries([mk])[0], resPrev = F.resultSeries([prevMk])[0];
      const months = U.lastMonths(st.range);
      const series = F.cashSeries(months);
      const bal = F.totalBalance(today);
      const toCollect = F.openInvoices('client'), toPay = F.openInvoices('fournisseur');
      const overdueC = toCollect.filter((i) => i.dueDate < today), overdueS = toPay.filter((i) => i.dueDate < today);
      const fc = F.forecast(30);
      const upcoming = F.upcoming(30).slice(0, 7);
      const budgets = S.all('budgets').map((b) => Object.assign({ b }, F.budgetUsage(b))).filter((x) => x.state !== 'ok').sort((a, b) => b.pct - a.pct);
      const cats = F.byCategory('depense', U.monthStart(months[0]), today);
      const recent = S.all('transactions').slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 6);
      const delta = (c, p, invert) => {
        const v = F.variation(c, p); if (v == null) return '<span class="muted small">—</span>';
        const good = invert ? v <= 0 : v >= 0;
        return '<span class="delta ' + (good ? 'up' : 'down') + '" title="Par rapport au mois précédent">' + (v >= 0 ? '▲ ' : '▼ ') + U.pct(Math.abs(v)) + '</span>';
      };
      const spark = (key, color) => Ch.spark(series.map((s) => s[key]), color);
      const hour = new Date().getHours();

      main.innerHTML = '<div class="view">' +
        '<div class="page-head"><div><div class="eyebrow">' + U.esc(S.settings.companyName) + '</div><h1>' + (hour < 18 ? 'Bonjour' : 'Bonsoir') + ', voici vos finances</h1><p>Situation au ' + U.fmtDateLong(today) + ' — trésorerie en TTC, résultat en HT.</p></div>' +
        '<div class="page-actions"><a class="btn" href="#rapports">' + O.icon('chart') + 'Rapports</a><button class="btn btn-primary" data-act="new">' + O.icon('plus') + 'Nouvelle opération</button></div></div>' +

        '<section class="grid grid-kpi6 stagger" aria-label="Indicateurs clés">' +
        '<article class="card kpi hero"><div class="kpi-top"><span class="kpi-label">Trésorerie disponible</span><span class="kpi-icon">' + O.icon('wallet') + '</span></div><div class="kpi-value" data-count="' + bal + '">' + U.money(bal) + '</div><div class="kpi-foot"><span>' + S.all('accounts').length + ' comptes</span>' + spark('balance', 'var(--gold)') + '</div></article>' +
        '<article class="card kpi inc"><div class="kpi-top"><span class="kpi-label">Encaissements du mois</span><span class="kpi-icon">' + O.icon('arrowDown') + '</span></div><div class="kpi-value" data-count="' + cur.inc + '">' + U.money(cur.inc) + '</div><div class="kpi-foot">' + delta(cur.inc, prev.inc) + spark('inc', 'var(--inc)') + '</div></article>' +
        '<article class="card kpi exp"><div class="kpi-top"><span class="kpi-label">Décaissements du mois</span><span class="kpi-icon">' + O.icon('arrowUp') + '</span></div><div class="kpi-value" data-count="' + cur.exp + '">' + U.money(cur.exp) + '</div><div class="kpi-foot">' + delta(cur.exp, prev.exp, true) + spark('exp', 'var(--exp)') + '</div></article>' +
        '<article class="card kpi ' + (res.result >= 0 ? 'info' : 'exp') + '"><div class="kpi-top"><span class="kpi-label">Résultat du mois (HT)</span><span class="kpi-icon">' + O.icon(res.result >= 0 ? 'trendUp' : 'trendDown') + '</span></div><div class="kpi-value" data-count="' + res.result + '">' + U.money(res.result) + '</div><div class="kpi-foot">' + delta(res.result, resPrev.result) + '<span class="small">Marge ' + (res.inc ? U.pct((res.result / res.inc) * 100) : '—') + '</span></div></article>' +
        '<article class="card kpi warn"><div class="kpi-top"><span class="kpi-label">À encaisser</span><span class="kpi-icon">' + O.icon('invoice') + '</span></div><div class="kpi-value" data-count="' + U.sum(toCollect, (i) => i.amountTTC) + '">' + U.money(U.sum(toCollect, (i) => i.amountTTC)) + '</div><div class="kpi-foot"><span>' + toCollect.length + ' facture(s)</span>' + (overdueC.length ? '<span class="badge b-danger">' + overdueC.length + ' en retard</span>' : '<span class="badge b-inc">À jour</span>') + '</div></article>' +
        '<article class="card kpi"><div class="kpi-top"><span class="kpi-label">À payer</span><span class="kpi-icon">' + O.icon('receipt') + '</span></div><div class="kpi-value" data-count="' + U.sum(toPay, (i) => i.amountTTC) + '">' + U.money(U.sum(toPay, (i) => i.amountTTC)) + '</div><div class="kpi-foot"><span>' + toPay.length + ' facture(s)</span>' + (overdueS.length ? '<span class="badge b-danger">' + overdueS.length + ' en retard</span>' : '<span class="badge b-inc">À jour</span>') + '</div></article>' +
        '</section>' +

        '<div class="grid grid-main mt stagger">' +
        '<section class="card"><div class="card-head"><div><h2>Flux de trésorerie</h2><p class="card-sub">Encaissements et décaissements TTC payés, solde de fin de mois</p></div>' +
        '<div class="tabs" role="tablist" aria-label="Période du graphique">' + [6, 12].map((n) => '<button role="tab" type="button" aria-selected="' + (st.range === n) + '" data-range="' + n + '">' + n + ' mois</button>').join('') + '</div></div>' +
        Ch.bars({ title: 'Flux de trésorerie mensuels', labels: months.map((m) => U.monthLabel(m).replace(/ \d{4}$/, '')), series: [{ name: 'Encaissements', color: 'var(--inc)', values: series.map((s) => s.inc) }, { name: 'Décaissements', color: 'var(--exp)', values: series.map((s) => s.exp) }], line: { name: 'Solde total', color: 'var(--gold)', values: series.map((s) => s.balance) } }) +
        '</section>' +
        '<section class="card"><div class="card-head"><div><h2>Dépenses par catégorie</h2><p class="card-sub">' + st.range + ' derniers mois, HT</p></div></div>' + Ch.donut({ title: 'Dépenses par catégorie', items: cats.map((c) => ({ label: c.label, value: c.value, color: c.color })), centerLabel: 'Dépenses', max: 7 }) + '</section>' +
        '</div>' +

        '<div class="grid grid-3 mt stagger">' +
        '<section class="card"><div class="card-head"><h2>Prochaines échéances</h2><a href="#echeancier" class="btn btn-sm btn-ghost">Tout voir</a></div>' +
        (upcoming.length ? '<ul class="list">' + upcoming.map((it) => { const d = U.parse(it.date); return '<li><div class="date-tile"><b>' + d.getDate() + '</b><span>' + U.MONTHS[d.getMonth()] + '</span></div><div class="grow"><div class="title">' + U.esc(it.label) + '</div><div class="cell-sub">' + (it.overdue ? '<span class="badge b-danger">En retard</span> ' : '') + U.esc({ echeance: 'Échéance récurrente', facture: 'Facture', operation: 'Opération en attente' }[it.kind]) + ' · ' + U.relDays(it.date) + '</div></div><span class="num ' + (it.type === 'recette' ? 'amount-inc' : 'amount-exp') + '">' + (it.type === 'recette' ? '+' : '−') + U.money(it.amount) + '</span></li>'; }).join('') + '</ul>' : UI.empty('Rien à venir', 'Aucune échéance sur 30 jours.')) +
        '</section>' +
        '<section class="card"><div class="card-head"><h2>Prévision à 30 jours</h2><a href="#tresorerie" class="btn btn-sm btn-ghost">Détails</a></div>' +
        '<div class="stat-row"><span class="muted">Solde actuel</span><span class="num">' + U.money(fc.start) + '</span></div>' +
        '<div class="stat-row"><span class="muted">Point bas prévu</span><span class="num ' + (fc.min.value < 0 ? 'amount-exp' : '') + '">' + U.money(fc.min.value) + ' <span class="small muted">(' + U.fmtDate(fc.min.date) + ')</span></span></div>' +
        '<div class="stat-row total"><span>Solde dans 30 jours</span><span class="num" style="color:var(--gold)">' + U.money(fc.end) + '</span></div>' +
        Ch.line({ title: 'Prévision de trésorerie à 30 jours', points: fc.points, color: 'var(--gold)', height: 190 }) +
        '</section>' +
        '<section class="card"><div class="card-head"><h2>Alertes budgétaires</h2><a href="#budgets" class="btn btn-sm btn-ghost">Budgets</a></div>' +
        (budgets.length ? '<ul class="list">' + budgets.slice(0, 5).map((x) => { const c = S.get('categories', x.b.categoryId) || {}; return '<li style="display:block"><div class="flex between" style="margin-bottom:.4rem"><span class="title">' + U.esc((c.icon || '') + ' ' + (c.name || '')) + '</span><span class="badge ' + (x.state === 'over' ? 'b-danger' : 'b-warn') + '">' + U.pct(x.pct) + '</span></div><div class="progress ' + x.state + '"><span data-w="' + Math.min(100, x.pct).toFixed(1) + '"></span></div><div class="cell-sub" style="margin-top:.3rem">' + U.money(x.spent) + ' sur ' + U.money(x.limit) + ' (' + (x.b.period === 'annuel' ? 'annuel' : 'ce mois') + ')</div></li>'; }).join('') + '</ul>' : '<div class="alert info">' + O.icon('checkCircle') + '<p>Tous vos budgets sont maîtrisés ce mois-ci.</p></div>') +
        '</section></div>' +

        '<section class="card flush mt"><div class="card-head" style="padding-bottom:1rem"><h2>Dernières opérations</h2><a href="#operations" class="btn btn-sm btn-ghost">Toutes les opérations</a></div>' +
        '<div class="table-wrap"><table class="data responsive"><caption class="sr-only">Six dernières opérations</caption><thead><tr><th scope="col">Date</th><th scope="col">Libellé</th><th scope="col">Catégorie</th><th scope="col">Statut</th><th scope="col" class="r">Montant TTC</th></tr></thead><tbody>' +
        recent.map((t) => '<tr><td data-label="Date" class="num">' + U.fmtDate(t.date) + '</td><td data-label="Libellé"><div class="cell-main">' + U.esc(t.label) + '</div><div class="cell-sub">' + U.esc(S.name('thirdParties', t.thirdPartyId, '')) + '</div></td><td data-label="Catégorie">' + UI.catChip(t.categoryId) + '</td><td data-label="Statut">' + UI.badgeStatus(t.status) + '</td><td data-label="Montant" class="r">' + UI.amount(t) + '</td></tr>').join('') +
        '</tbody></table></div></section>' +
        '</div>';

      UI.countUp(main);
      UI.animateBars(main);
      main.querySelector('[data-act="new"]').addEventListener('click', () => O.Forms.openTransaction());
      main.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => { st.range = Number(b.dataset.range); O.App.refresh(); }));
    }
  };
})(window.Ondea);
