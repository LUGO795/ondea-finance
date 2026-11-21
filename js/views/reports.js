/* ==========================================================================
   Vue — Rapports financiers : compte de résultat, TVA, évolution mensuelle
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, F = O.F, UI = O.UI, Ch = O.Charts;
  O.Views = O.Views || {};
  const st = { period: 'rolling', from: '', to: '' };
  const P = { rolling: '12 mois glissants', year: 'Année en cours', prevyear: 'Année précédente', quarter: 'Trimestre en cours', month: 'Mois en cours', custom: 'Personnalisée' };

  function range() {
    const t = U.today(), y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7));
    switch (st.period) {
      case 'year': return [y + '-01-01', y + '-12-31'];
      case 'prevyear': return [(y - 1) + '-01-01', (y - 1) + '-12-31'];
      case 'quarter': { const q0 = Math.floor((m - 1) / 3) * 3 + 1; const s = y + '-' + String(q0).padStart(2, '0'); return [s + '-01', U.monthEnd(U.monthKey(U.addMonths(s + '-01', 2)))]; }
      case 'month': return [U.monthStart(U.monthKey(t)), U.monthEnd(U.monthKey(t))];
      case 'custom': return [st.from || U.addDays(t, -90), st.to || t];
      default: return [U.monthStart(U.lastMonths(12)[0]), U.monthEnd(U.monthKey(t))];
    }
  }
  function monthsBetween(from, to) {
    const out = []; let k = U.monthKey(from);
    while (k <= U.monthKey(to) && out.length < 60) { out.push(k); k = U.monthKey(U.addMonths(k + '-01', 1)); }
    return out;
  }

  O.Views.reports = {
    title: 'Rapports',
    render(root) {
      const [from, to] = range();
      const inc = F.byCategory('recette', from, to), exp = F.byCategory('depense', from, to);
      const tInc = U.sum(inc, (c) => c.value), tExp = U.sum(exp, (c) => c.value), result = tInc - tExp;
      const vat = F.vatSummary(from, to);
      const months = monthsBetween(from, to);
      const rs = F.resultSeries(months);
      const topC = F.byThirdParty('recette', from, to).slice(0, 5), topS = F.byThirdParty('depense', from, to).slice(0, 5);
      const cashIn = F.total({ type: 'recette', status: 'payee', from, to }, 'amountTTC'), cashOut = F.total({ type: 'depense', status: 'payee', from, to }, 'amountTTC');
      const salaries = U.sum(exp.filter((c) => /salaires/i.test(c.label)), (c) => c.value);
      const row = (c, total) => '<div class="stat-row"><span class="flex" style="gap:.5rem"><span class="dot" style="background:' + c.color + '"></span>' + U.esc(c.label) + '</span><span><span class="num">' + U.money(c.value) + '</span> <span class="small muted mono">' + U.pct(total ? (c.value / total) * 100 : 0) + '</span></span></div>';

      root.innerHTML = '<div class="view">' +
        '<div class="print-only"><h1>' + U.esc(S.settings.companyName) + ' — Rapport financier</h1><p>Période du ' + U.fmtDate(from) + ' au ' + U.fmtDate(to) + ' · édité le ' + U.fmtDate(U.today()) + '</p></div>' +
        '<div class="page-head"><div><div class="eyebrow">Analyse</div><h1>Rapports financiers</h1><p>Du ' + U.fmtDateLong(from) + ' au ' + U.fmtDateLong(to) + ' — montants HT sauf mention.</p></div>' +
        '<div class="page-actions"><button class="btn" data-act="csv">' + O.icon('download') + 'Exporter CSV</button><button class="btn" data-act="print">' + O.icon('printer') + 'Imprimer / PDF</button></div></div>' +
        '<div class="toolbar card mb" style="border-radius:var(--radius-l)"><label for="rpP" class="small" style="font-weight:700">Période</label><select id="rpP" class="input" data-period>' + Object.keys(P).map((k) => '<option value="' + k + '"' + (k === st.period ? ' selected' : '') + '>' + P[k] + '</option>').join('') + '</select>' +
        (st.period === 'custom' ? '<label for="rpF" class="small">Du</label><input id="rpF" type="date" class="input" data-from value="' + from + '"><label for="rpT" class="small">au</label><input id="rpT" type="date" class="input" data-to value="' + to + '">' : '') + '</div>' +
        '<section class="grid grid-kpi stagger mb">' +
        '<div class="card kpi inc"><div class="kpi-top"><span class="kpi-label">Chiffre d’affaires HT</span><span class="kpi-icon">' + O.icon('trendUp') + '</span></div><div class="kpi-value" data-count="' + tInc + '">—</div></div>' +
        '<div class="card kpi exp"><div class="kpi-top"><span class="kpi-label">Charges HT</span><span class="kpi-icon">' + O.icon('trendDown') + '</span></div><div class="kpi-value" data-count="' + tExp + '">—</div></div>' +
        '<div class="card kpi hero"><div class="kpi-top"><span class="kpi-label">Résultat</span><span class="kpi-icon">' + O.icon('target') + '</span></div><div class="kpi-value" data-count="' + result + '">—</div><div class="kpi-foot">Marge nette ' + (tInc ? U.pct((result / tInc) * 100) : '—') + '</div></div>' +
        '<div class="card kpi info"><div class="kpi-top"><span class="kpi-label">TVA nette (collectée − déductible)</span><span class="kpi-icon">' + O.icon('receipt') + '</span></div><div class="kpi-value" data-count="' + vat.due + '">—</div><div class="kpi-foot">' + (vat.due < 0 ? 'Crédit de TVA' : 'collectée − déductible') + '</div></div>' +
        '</section>' +
        '<section class="card mb"><div class="card-head"><div><h2>Évolution du résultat</h2><p class="card-sub">Produits, charges et résultat mensuels (HT)</p></div></div>' +
        Ch.bars({ title: 'Résultat mensuel', labels: months.map((m) => U.monthLabel(m)), series: [{ name: 'Produits', color: 'var(--inc)', values: rs.map((r) => r.inc) }, { name: 'Charges', color: 'var(--exp)', values: rs.map((r) => r.exp) }], line: { name: 'Résultat', color: 'var(--gold)', values: rs.map((r) => r.result) } }) + '</section>' +
        '<div class="grid grid-2 mb stagger">' +
        '<section class="card"><h2>Compte de résultat simplifié</h2><h3 class="mt" style="color:var(--inc);font-family:var(--font-body);font-size:1rem">Produits</h3>' + (inc.map((c) => row(c, tInc)).join('') || '<p class="muted">Aucun produit.</p>') + '<div class="stat-row total"><span>Total produits</span><span class="num amount-inc">' + U.money(tInc) + '</span></div>' +
        '<h3 class="mt" style="color:var(--exp);font-family:var(--font-body);font-size:1rem">Charges</h3>' + (exp.map((c) => row(c, tExp)).join('') || '<p class="muted">Aucune charge.</p>') + '<div class="stat-row total"><span>Total charges</span><span class="num amount-exp">' + U.money(tExp) + '</span></div>' +
        '<div class="stat-row total" style="font-size:1.2rem"><span>Résultat de la période</span><span class="num" style="color:' + (result >= 0 ? 'var(--inc)' : 'var(--exp)') + '">' + U.moneySigned(result) + '</span></div></section>' +
        '<div class="grid" style="gap:1.25rem;align-content:start">' +
        '<section class="card"><h2>Synthèse de TVA</h2><div class="table-wrap"><table class="data"><caption class="sr-only">TVA par taux</caption><thead><tr><th scope="col">Taux</th><th scope="col" class="r">Base ventes</th><th scope="col" class="r">Collectée</th><th scope="col" class="r">Base achats</th><th scope="col" class="r">Déductible</th></tr></thead><tbody>' +
        vat.byRate.map((r) => '<tr><td class="mono">' + String(r.rate).replace('.', ',') + ' %</td><td class="r num">' + U.money(r.baseInc) + '</td><td class="r num">' + U.money(r.collected) + '</td><td class="r num">' + U.money(r.baseExp) + '</td><td class="r num">' + U.money(r.deductible) + '</td></tr>').join('') +
        '</tbody><tfoot><tr><td>Total</td><td></td><td class="r num">' + U.money(vat.collected) + '</td><td></td><td class="r num">' + U.money(vat.deductible) + '</td></tr></tfoot></table></div>' +
        '<div class="stat-row total"><span>' + (vat.due >= 0 ? 'TVA nette de la période' : 'Crédit de TVA') + '</span><span class="num">' + U.money(Math.abs(vat.due)) + '</span></div><div class="stat-row"><span class="muted">TVA déjà reversée sur la période</span><span class="num">' + U.money(vat.paid) + '</span></div><p class="small muted">Estimation indicative fondée sur les opérations saisies ; à rapprocher de votre déclaration CA3.</p></section>' +
        '<section class="card"><h2>Indicateurs clés</h2>' +
        '<div class="stat-row"><span class="muted">Encaissements TTC</span><span class="num">' + U.money(cashIn) + '</span></div>' +
        '<div class="stat-row"><span class="muted">Décaissements TTC</span><span class="num">' + U.money(cashOut) + '</span></div>' +
        '<div class="stat-row"><span class="muted">Flux net de trésorerie</span><span class="num ' + (cashIn - cashOut >= 0 ? 'amount-inc' : 'amount-exp') + '">' + U.moneySigned(cashIn - cashOut) + '</span></div>' +
        '<div class="stat-row"><span class="muted">Poids de la masse salariale</span><span class="num">' + (tInc ? U.pct((salaries / tInc) * 100) : '—') + ' du CA</span></div>' +
        '<div class="stat-row"><span class="muted">Résultat mensuel moyen</span><span class="num">' + U.money(months.length ? Math.round(result / months.length) : 0) + '</span></div>' +
        '<div class="stat-row"><span class="muted">Meilleur mois</span><span>' + (rs.length ? (() => { const b = rs.reduce((a, x) => (x.result > a.result ? x : a)); return U.monthLabel(b.key, true) + ' · <span class="num">' + U.money(b.result) + '</span>'; })() : '—') + '</span></div></section></div></div>' +
        '<div class="grid grid-2 mb stagger"><section class="card"><h2>Top clients</h2>' + (topC.length ? Ch.hbars(topC, 'var(--inc)') : '<p class="muted">—</p>') + '</section><section class="card"><h2>Top fournisseurs</h2>' + (topS.length ? Ch.hbars(topS, 'var(--exp)') : '<p class="muted">—</p>') + '</section></div>' +
        '<section class="card flush"><div class="card-head" style="padding-bottom:1rem"><h2>Tableau mensuel</h2></div><div class="table-wrap"><table class="data"><caption class="sr-only">Produits, charges et résultat par mois</caption><thead><tr><th scope="col">Mois</th><th scope="col" class="r">Produits HT</th><th scope="col" class="r">Charges HT</th><th scope="col" class="r">Résultat</th><th scope="col" class="r">Marge</th></tr></thead><tbody>' +
        rs.map((r) => '<tr><td>' + U.monthLabel(r.key, true) + '</td><td class="r num">' + U.money(r.inc) + '</td><td class="r num">' + U.money(r.exp) + '</td><td class="r num ' + (r.result >= 0 ? 'amount-inc' : 'amount-exp') + '">' + U.moneySigned(r.result) + '</td><td class="r num">' + (r.inc ? U.pct((r.result / r.inc) * 100) : '—') + '</td></tr>').join('') +
        '</tbody><tfoot><tr><td>Total</td><td class="r num">' + U.money(tInc) + '</td><td class="r num">' + U.money(tExp) + '</td><td class="r num">' + U.moneySigned(result) + '</td><td class="r num">' + (tInc ? U.pct((result / tInc) * 100) : '—') + '</td></tr></tfoot></table></div></section></div>';
      UI.countUp(root); UI.animateBars(root);

      root.querySelector('[data-period]').addEventListener('change', (e) => { st.period = e.target.value; O.App.refresh(); });
      const f = root.querySelector('[data-from]'), t = root.querySelector('[data-to]');
      if (f) [f, t].forEach((el) => el.addEventListener('change', () => {
        if (!U.validDate(f.value) || !U.validDate(t.value) || f.value > t.value) { UI.toast('Période invalide : la date de début doit précéder la date de fin.', 'warn'); return; }
        st.from = f.value; st.to = t.value; O.App.refresh();
      }));
      root.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.act === 'print') window.print();
        if (b.dataset.act === 'csv') {
          const rows = [['Rapport financier', S.settings.companyName], ['Période', U.fmtDate(from) + ' au ' + U.fmtDate(to)], [], ['Section', 'Libellé', 'Montant HT']];
          inc.forEach((c) => rows.push(['Produits', c.label, U.num(c.value)]));
          rows.push(['Produits', 'TOTAL', U.num(tInc)]);
          exp.forEach((c) => rows.push(['Charges', c.label, U.num(c.value)]));
          rows.push(['Charges', 'TOTAL', U.num(tExp)], ['Résultat', '', U.num(result)], [], ['TVA', 'Collectée', U.num(vat.collected)], ['TVA', 'Déductible', U.num(vat.deductible)], ['TVA', 'Nette', U.num(vat.due)], [], ['Mois', 'Produits HT', 'Charges HT', 'Résultat']);
          rs.forEach((r) => rows.push([U.monthLabel(r.key, true), U.num(r.inc), U.num(r.exp), U.num(r.result)]));
          U.download(U.csv(rows), 'rapport-financier-' + from + '_' + to + '.csv');
          UI.toast('Rapport exporté.');
        }
      });
    }
  };
})(window.Ondea);
