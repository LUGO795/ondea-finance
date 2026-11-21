/* ==========================================================================
   Vue — Budgets par catégorie (HT)
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, F = O.F, UI = O.UI, Fm = O.Forms, Ch = O.Charts;
  O.Views = O.Views || {};
  const st = { month: null };

  function openForm(b, catId) {
    const isEdit = !!(b && b.id);
    const x = b || { categoryId: catId || '', period: 'mensuel', alert: S.settings.budgetAlert || 80 };
    const used = new Set(S.all('budgets').filter((y) => y.id !== x.id).map((y) => y.categoryId));
    const cats = Fm.optCategories('depense').filter((c) => !used.has(c.value));
    if (!cats.length && !isEdit) { UI.toast('Toutes les catégories de dépenses ont déjà un budget.', 'info'); return; }
    UI.modal({
      title: isEdit ? 'Modifier le budget' : 'Nouveau budget', body: '<form novalidate id="budForm"><div class="form-grid">' +
        Fm.select({ name: 'categoryId', label: 'Catégorie de dépense', value: x.categoryId, required: true, placeholder: 'Choisir…', options: cats, full: true }) +
        Fm.select({ name: 'period', label: 'Périodicité', value: x.period, options: [{ value: 'mensuel', label: 'Mensuel' }, { value: 'annuel', label: 'Annuel (année civile)' }] }) +
        Fm.money({ name: 'amount', label: 'Plafond HT', value: x.amount, required: true }) +
        Fm.input({ name: 'alert', label: "Seuil d'alerte", value: x.alert, affix: '%', attrs: ' inputmode="numeric"', hint: 'Une alerte apparaît dès ce pourcentage atteint.' }) +
        '</div></form>',
      foot: '<button type="button" class="btn" data-close>Annuler</button><button type="submit" form="budForm" class="btn btn-primary">' + O.icon('check') + 'Enregistrer</button>',
      onOpen(dlg, api) {
        const form = dlg.querySelector('#budForm'); Fm.liveClear(form);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!Fm.validate(form, { categoryId: [Fm.R.required], amount: [Fm.R.money], alert: [Fm.R.required, Fm.R.pct] })) return;
          const v = Fm.values(form);
          const rec = { categoryId: v.categoryId, period: v.period, amount: U.toCents(v.amount), alert: Number(String(v.alert).replace(',', '.')) };
          try { isEdit ? await S.update('budgets', x.id, rec) : await S.create('budgets', rec); UI.toast('Budget enregistré.'); api.close(); } catch (err) { UI.error(err); }
        });
      }
    });
  }

  O.Views.budgets = {
    title: 'Budgets',
    render(root) {
      const mk = st.month || U.monthKey(U.today());
      const list = S.all('budgets').map((b) => Object.assign({ b, c: S.get('categories', b.categoryId) || { name: '?', color: '#888' } }, F.budgetUsage(b, mk))).sort((a, b) => b.pct - a.pct);
      const monthly = list.filter((x) => x.b.period === 'mensuel');
      const totLimit = U.sum(monthly, (x) => x.limit), totSpent = U.sum(monthly, (x) => x.spent);
      const over = list.filter((x) => x.state === 'over').length, warn = list.filter((x) => x.state === 'warn').length;
      const months = U.lastMonths(6, mk);
      const hist = months.map((m) => ({ m, limit: totLimit, spent: U.sum(S.all('budgets').filter((b) => b.period === 'mensuel'), (b) => F.budgetUsage(b, m).spent) }));
      const nobudget = S.all('categories').filter((c) => c.type === 'depense' && !S.all('budgets').some((b) => b.categoryId === c.id));
      const pctTot = totLimit ? (totSpent / totLimit) * 100 : 0;

      root.innerHTML = '<div class="view">' +
        '<div class="page-head"><div><div class="eyebrow">Maîtrise des coûts</div><h1>Budgets</h1><p>Plafonds HT par catégorie, consommation en temps réel et alertes.</p></div>' +
        '<div class="page-actions"><div class="flex" role="group" aria-label="Mois analysé"><button class="icon-btn" data-m="-1" aria-label="Mois précédent">' + O.icon('chevronLeft') + '</button><strong style="min-width:150px;text-align:center" aria-live="polite">' + U.monthLabel(mk, true) + '</strong><button class="icon-btn" data-m="1" aria-label="Mois suivant">' + O.icon('chevronRight') + '</button></div><button class="btn btn-primary" data-act="new">' + O.icon('plus') + 'Nouveau budget</button></div></div>' +
        '<section class="grid grid-kpi stagger mb">' +
        '<div class="card kpi hero"><div class="kpi-top"><span class="kpi-label">Budget mensuel total</span><span class="kpi-icon">' + O.icon('target') + '</span></div><div class="kpi-value" data-count="' + totLimit + '">—</div><div class="kpi-foot">' + monthly.length + ' budgets mensuels</div></div>' +
        '<div class="card kpi exp"><div class="kpi-top"><span class="kpi-label">Consommé</span><span class="kpi-icon">' + O.icon('arrowUp') + '</span></div><div class="kpi-value" data-count="' + totSpent + '">—</div><div class="kpi-foot"><div class="progress ' + (pctTot >= 100 ? 'over' : pctTot >= 80 ? 'warn' : 'ok') + '" style="flex:1"><span data-w="' + Math.min(100, pctTot).toFixed(1) + '"></span></div><span class="mono">' + U.pct(pctTot) + '</span></div></div>' +
        '<div class="card kpi ' + (totLimit - totSpent >= 0 ? 'inc' : 'exp') + '"><div class="kpi-top"><span class="kpi-label">Disponible</span><span class="kpi-icon">' + O.icon('wallet') + '</span></div><div class="kpi-value" data-count="' + (totLimit - totSpent) + '">—</div></div>' +
        '<div class="card kpi warn"><div class="kpi-top"><span class="kpi-label">Alertes</span><span class="kpi-icon">' + O.icon('alert') + '</span></div><div class="kpi-value">' + (over + warn) + '</div><div class="kpi-foot"><span class="badge b-danger">' + over + ' dépassé(s)</span><span class="badge b-warn">' + warn + ' proche(s)</span></div></div>' +
        '</section>' +
        '<section class="card mb"><div class="card-head"><div><h2>Budget vs réalisé</h2><p class="card-sub">Budgets mensuels cumulés — 6 derniers mois</p></div></div>' +
        Ch.bars({ title: 'Budget contre réalisé', labels: hist.map((h) => U.monthLabel(h.m)), series: [{ name: 'Budget', color: 'var(--gold-2)', values: hist.map((h) => h.limit) }, { name: 'Réalisé', color: 'var(--exp)', values: hist.map((h) => h.spent) }], height: 240 }) + '</section>' +
        '<div class="grid grid-3 stagger">' + list.map((x) => '<article class="card budget-card"><div class="head"><span class="cat-icon" style="background:' + x.c.color + '22">' + U.esc(x.c.icon || '•') + '</span><div style="flex:1;min-width:0"><h3 style="margin:0;font-family:var(--font-body);font-size:1rem">' + U.esc(x.c.name) + '</h3><span class="cell-sub">' + (x.b.period === 'annuel' ? 'Annuel ' + mk.slice(0, 4) : 'Mensuel') + ' · alerte à ' + x.b.alert + ' %</span></div><span class="badge ' + (x.state === 'over' ? 'b-danger' : x.state === 'warn' ? 'b-warn' : 'b-inc') + '">' + U.pct(x.pct) + '</span></div>' +
          '<div class="progress lg ' + x.state + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(Math.min(100, x.pct)) + '" aria-label="Consommation ' + U.esc(x.c.name) + '"><span data-w="' + Math.min(100, x.pct).toFixed(1) + '"></span></div>' +
          '<div class="nums"><span>Consommé <strong class="num" style="color:var(--text)">' + U.money(x.spent) + '</strong></span><span>Plafond <strong class="num" style="color:var(--text)">' + U.money(x.limit) + '</strong></span></div>' +
          '<div class="nums"><span class="' + (x.remaining < 0 ? 'amount-exp' : 'amount-inc') + '">' + (x.remaining < 0 ? 'Dépassement ' + U.money(-x.remaining) : 'Reste ' + U.money(x.remaining)) + '</span><span><button class="icon-btn sm" data-edit="' + x.b.id + '" aria-label="Modifier le budget ' + U.esc(x.c.name) + '">' + O.icon('edit') + '</button> <button class="icon-btn sm danger" data-del="' + x.b.id + '" aria-label="Supprimer le budget ' + U.esc(x.c.name) + '">' + O.icon('trash') + '</button></span></div></article>').join('') + '</div>' +
        (nobudget.length ? '<section class="card mt"><h2>Catégories sans budget</h2><div class="flex">' + nobudget.map((c) => '<button class="chip" data-newcat="' + c.id + '">' + U.esc((c.icon || '') + ' ' + c.name) + ' ' + O.icon('plus', ' style="width:14px;height:14px"') + '</button>').join('') + '</div></section>' : '') +
        '</div>';
      UI.countUp(root); UI.animateBars(root);
      root.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.m) { st.month = U.monthKey(U.addMonths(mk + '-01', Number(b.dataset.m))); O.App.refresh(); }
        else if (b.dataset.act === 'new') openForm();
        else if (b.dataset.newcat) openForm(null, b.dataset.newcat);
        else if (b.dataset.edit) openForm(S.get('budgets', b.dataset.edit));
        else if (b.dataset.del && await UI.confirm('Supprimer ce budget ?', { danger: true, ok: 'Supprimer' })) { await S.remove('budgets', b.dataset.del); UI.toast('Budget supprimé.'); }
      });
    }
  };
})(window.Ondea);
