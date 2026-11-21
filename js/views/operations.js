/* ==========================================================================
   Vue — Opérations (dépenses & recettes)
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, F = O.F, UI = O.UI, Fm = O.Forms;
  O.Views = O.Views || {};

  const st = { q: '', type: '', status: '', categoryId: '', accountId: '', thirdPartyId: '', period: 'year', from: '', to: '' };
  let table = null;

  const PERIODS = {
    month: 'Mois en cours', prev: 'Mois précédent', q3: '3 derniers mois', year: '12 derniers mois', ytd: 'Année civile', all: 'Toute la période', custom: 'Personnalisée'
  };
  function range() {
    const t = U.today(), mk = U.monthKey(t);
    switch (st.period) {
      case 'month': return [U.monthStart(mk), U.monthEnd(mk)];
      case 'prev': { const p = U.lastMonths(2)[0]; return [U.monthStart(p), U.monthEnd(p)]; }
      case 'q3': return [U.monthStart(U.lastMonths(3)[0]), U.monthEnd(mk)];
      case 'year': return [U.monthStart(U.lastMonths(12)[0]), '9999-12-31'];
      case 'ytd': return [t.slice(0, 4) + '-01-01', t.slice(0, 4) + '-12-31'];
      case 'custom': return [st.from || '0000-01-01', st.to || '9999-12-31'];
      default: return ['0000-01-01', '9999-12-31'];
    }
  }
  function filtered() {
    const [from, to] = range(), q = U.norm(st.q);
    return S.all('transactions').filter((t) => {
      if (st.type && t.type !== st.type) return false;
      if (st.status && t.status !== st.status) return false;
      if (st.categoryId && t.categoryId !== st.categoryId) return false;
      if (st.accountId && t.accountId !== st.accountId) return false;
      if (st.thirdPartyId && t.thirdPartyId !== st.thirdPartyId) return false;
      if (t.date < from || t.date > to) return false;
      if (q) {
        const hay = U.norm([t.label, t.reference, t.notes, S.name('thirdParties', t.thirdPartyId, ''), S.name('categories', t.categoryId, ''), U.num(t.amountTTC)].join(' '));
        if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }
  function exportCSV(rows) {
    const head = ['Date', 'Type', 'Libellé', 'Catégorie', 'Tiers', 'Compte', 'Moyen de paiement', 'Statut', 'Référence', 'HT', 'Taux TVA', 'TVA', 'TTC', 'Justificatifs'];
    const data = rows.slice().sort((a, b) => a.date.localeCompare(b.date)).map((t) => [U.fmtDate(t.date), t.type === 'recette' ? 'Recette' : 'Dépense', t.label, S.name('categories', t.categoryId, ''), S.name('thirdParties', t.thirdPartyId, ''), S.name('accounts', t.accountId, ''), S.name('paymentMethods', t.paymentMethodId, ''), t.status === 'payee' ? 'Payée' : 'En attente', t.reference || '', U.num(t.amountHT), String(t.vatRate).replace('.', ','), U.num(t.amountVAT), U.num(t.amountTTC), (t.attachments || []).length]);
    U.download(U.csv([head].concat(data)), 'operations-' + U.today() + '.csv');
    UI.toast(rows.length + ' opération(s) exportée(s) au format CSV.');
  }
  async function remove(ids) {
    const ok = await UI.confirm(ids.length > 1 ? 'Supprimer ' + ids.length + ' opérations ?' : 'Supprimer cette opération ?', { danger: true, ok: 'Supprimer', detail: 'Les justificatifs restent disponibles dans le coffre-fort. Une facture liée repassera au statut « émise ».' });
    if (!ok) return;
    try { for (const id of ids) await S.remove('transactions', id, true); table.clearSelection(); S.emit('transactions'); UI.toast(ids.length + ' opération(s) supprimée(s).'); }
    catch (e) { UI.error(e); }
  }

  O.Views.operations = {
    title: 'Opérations',
    setQuery(q) { st.q = q || ''; },
    filterBy(patch) { Object.assign(st, { q: '', type: '', status: '', categoryId: '', accountId: '', thirdPartyId: '', period: 'all' }, patch); },
    render(main, params) {
      if (params && params.q != null) { st.q = params.q; st.period = 'all'; }
      const rows = filtered();
      const inc = U.sum(rows.filter((t) => t.type === 'recette'), (t) => t.amountTTC);
      const exp = U.sum(rows.filter((t) => t.type === 'depense'), (t) => t.amountTTC);
      const pending = rows.filter((t) => t.status === 'en_attente').length;
      const opt = (arr, val, ph) => '<option value="">' + ph + '</option>' + arr.map((o) => '<option value="' + U.esc(o.value) + '"' + (o.value === val ? ' selected' : '') + '>' + U.esc(o.label) + '</option>').join('');

      main.innerHTML = '<div class="view">' +
        '<div class="page-head"><div><div class="eyebrow">Flux financiers</div><h1>Dépenses & recettes</h1><p>Saisissez, filtrez et justifiez chaque mouvement. Montants calculés au centime près.</p></div>' +
        '<div class="page-actions"><button class="btn" data-act="csv">' + O.icon('download') + 'Exporter CSV</button><button class="btn" data-act="new-inc">' + O.icon('arrowDown') + 'Recette</button><button class="btn btn-primary" data-act="new-exp">' + O.icon('plus') + 'Dépense</button></div></div>' +
        '<section class="grid grid-kpi stagger mb">' +
        '<div class="card kpi inc"><div class="kpi-top"><span class="kpi-label">Recettes filtrées (TTC)</span><span class="kpi-icon">' + O.icon('arrowDown') + '</span></div><div class="kpi-value" data-count="' + inc + '">' + U.money(inc) + '</div></div>' +
        '<div class="card kpi exp"><div class="kpi-top"><span class="kpi-label">Dépenses filtrées (TTC)</span><span class="kpi-icon">' + O.icon('arrowUp') + '</span></div><div class="kpi-value" data-count="' + exp + '">' + U.money(exp) + '</div></div>' +
        '<div class="card kpi ' + (inc - exp >= 0 ? 'info' : 'exp') + '"><div class="kpi-top"><span class="kpi-label">Solde net</span><span class="kpi-icon">' + O.icon('swap') + '</span></div><div class="kpi-value" data-count="' + (inc - exp) + '">' + U.money(inc - exp) + '</div></div>' +
        '<div class="card kpi warn"><div class="kpi-top"><span class="kpi-label">En attente</span><span class="kpi-icon">' + O.icon('clock') + '</span></div><div class="kpi-value" data-count="' + pending + '" data-fmt="int">' + pending + '</div><div class="kpi-foot">' + rows.length + ' opération(s) affichée(s)</div></div>' +
        '</section>' +
        '<section class="card flush">' +
        '<form class="toolbar" role="search" aria-label="Filtrer les opérations" data-filters>' +
        '<label class="sr-only" for="opQ">Rechercher</label><input id="opQ" class="input grow" type="search" name="q" placeholder="Rechercher libellé, tiers, référence, montant…" value="' + U.esc(st.q) + '">' +
        '<label class="sr-only" for="opPeriod">Période</label><select class="input" id="opPeriod" name="period">' + Object.keys(PERIODS).map((k) => '<option value="' + k + '"' + (k === st.period ? ' selected' : '') + '>' + PERIODS[k] + '</option>').join('') + '</select>' +
        (st.period === 'custom' ? '<label class="sr-only" for="opFrom">Du</label><input class="input" type="date" id="opFrom" name="from" value="' + st.from + '"><label class="sr-only" for="opTo">Au</label><input class="input" type="date" id="opTo" name="to" value="' + st.to + '">' : '') +
        '<label class="sr-only" for="opType">Type</label><select class="input" id="opType" name="type">' + opt([{ value: 'depense', label: 'Dépenses' }, { value: 'recette', label: 'Recettes' }], st.type, 'Tous types') + '</select>' +
        '<label class="sr-only" for="opStatus">Statut</label><select class="input" id="opStatus" name="status">' + opt([{ value: 'payee', label: 'Payées' }, { value: 'en_attente', label: 'En attente' }], st.status, 'Tous statuts') + '</select>' +
        '<label class="sr-only" for="opCat">Catégorie</label><select class="input" id="opCat" name="categoryId">' + opt(Fm.optCategories(st.type), st.categoryId, 'Toutes catégories') + '</select>' +
        '<label class="sr-only" for="opAcc">Compte</label><select class="input" id="opAcc" name="accountId">' + opt(Fm.optAccounts(), st.accountId, 'Tous comptes') + '</select>' +
        '<label class="sr-only" for="opTp">Tiers</label><select class="input" id="opTp" name="thirdPartyId">' + opt(S.all('thirdParties').slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((t) => ({ value: t.id, label: t.name })), st.thirdPartyId, 'Tous tiers') + '</select>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="reset">' + O.icon('refresh') + 'Réinitialiser</button>' +
        '</form>' +
        '<div class="bulkbar" data-bulk><span data-bulk-n></span><button class="btn btn-sm" data-act="bulk-paid">' + O.icon('check') + 'Marquer payées</button><button class="btn btn-sm" data-act="bulk-csv">' + O.icon('download') + 'Exporter</button><button class="btn btn-sm btn-danger" data-act="bulk-del">' + O.icon('trash') + 'Supprimer</button><button class="btn btn-sm btn-ghost" data-act="bulk-clear">Annuler la sélection</button></div>' +
        '<div data-table></div></section></div>';

      if (!table) {
        table = new O.DataTable({
          caption: 'Liste des opérations', selectable: true, pageSize: 15, sort: { key: 'date', dir: 'desc' },
          columns: [
            { key: 'date', label: 'Date', cls: 'nowrap', render: (t) => '<span class="num">' + U.fmtDate(t.date) + '</span>' },
            { key: 'label', label: 'Libellé', cls: 'w-lg', render: (t) => '<div class="cell-main">' + U.esc(t.label) + ((t.attachments || []).length ? ' <span title="' + t.attachments.length + ' justificatif(s)" style="color:var(--gold)">' + O.icon('paperclip', ' style="width:14px;height:14px;vertical-align:-2px"') + '<span class="sr-only">' + t.attachments.length + ' justificatif(s)</span></span>' : '') + (t.invoiceId ? ' <span class="badge plain b-info">Facture</span>' : '') + '</div><div class="cell-sub">' + U.esc(S.name('thirdParties', t.thirdPartyId, '')) + (t.reference ? ' · ' + U.esc(t.reference) : '') + '</div>' },
            { key: 'categoryId', label: 'Catégorie', sortValue: (t) => S.name('categories', t.categoryId, ''), render: (t) => UI.catChip(t.categoryId) },
            { key: 'accountId', label: 'Compte', cls: 'nowrap', sortValue: (t) => S.name('accounts', t.accountId, ''), render: (t) => '<div>' + U.esc(S.name('accounts', t.accountId)) + '</div><div class="cell-sub">' + U.esc(S.name('paymentMethods', t.paymentMethodId, '')) + '</div>' },
            { key: 'status', label: 'Statut', render: (t) => UI.badgeStatus(t.status) },
            { key: 'amountHT', label: 'HT', cls: 'r', sortValue: (t) => F.sign(t) * t.amountHT, render: (t) => '<span class="num muted">' + U.money(t.amountHT) + '</span>' },
            { key: 'amountTTC', label: 'TTC', cls: 'r', sortValue: (t) => F.sign(t) * t.amountTTC, render: (t) => UI.amount(t) },
            { key: '', label: '', actions: true, render: (t) => '<button class="icon-btn sm" data-edit="' + t.id + '" aria-label="Modifier ' + U.esc(t.label) + '">' + O.icon('edit') + '</button><button class="icon-btn sm" data-dup="' + t.id + '" aria-label="Dupliquer ' + U.esc(t.label) + '">' + O.icon('copy') + '</button><button class="icon-btn sm danger" data-del="' + t.id + '" aria-label="Supprimer ' + U.esc(t.label) + '">' + O.icon('trash') + '</button>' }
          ],
          footer: (rs) => {
            const i = U.sum(rs.filter((t) => t.type === 'recette'), (t) => t.amountTTC), e = U.sum(rs.filter((t) => t.type === 'depense'), (t) => t.amountTTC);
            return '<tr><td colspan="7" data-label="">Total des ' + rs.length + ' opérations filtrées</td><td class="r" data-label="Solde"><span class="num ' + (i - e >= 0 ? 'amount-inc' : 'amount-exp') + '">' + U.moneySigned(i - e) + '</span></td><td></td></tr>';
          },
          onSelect: (ids) => {
            const bar = document.querySelector('[data-bulk]');
            if (!bar) return;
            bar.classList.toggle('show', ids.length > 0);
            bar.querySelector('[data-bulk-n]').textContent = ids.length + ' sélectionnée(s)';
          }
        });
      }
      table.setRows(rows).mount(main.querySelector('[data-table]')).render();
      table.changed();
      UI.countUp(main);

      const form = main.querySelector('[data-filters]');
      const apply = () => {
        const v = Fm.values(form);
        const periodChanged = v.period !== st.period;
        const typeChanged = v.type !== st.type;
        Object.assign(st, { q: v.q || '', period: v.period, type: v.type, status: v.status, categoryId: typeChanged ? '' : v.categoryId, accountId: v.accountId, thirdPartyId: v.thirdPartyId, from: v.from || st.from, to: v.to || st.to });
        table.page = 1;
        if (periodChanged || typeChanged) { O.App.refresh(); return; }
        const r = filtered();
        table.setRows(r).render(); table.changed();
        const keep = document.activeElement && document.activeElement.id;
        // mise à jour rapide des indicateurs
        const i = U.sum(r.filter((t) => t.type === 'recette'), (t) => t.amountTTC), e = U.sum(r.filter((t) => t.type === 'depense'), (t) => t.amountTTC);
        const vals = main.querySelectorAll('.kpi-value');
        vals[0].textContent = U.money(i); vals[1].textContent = U.money(e); vals[2].textContent = U.money(i - e); vals[3].textContent = r.filter((t) => t.status === 'en_attente').length;
        main.querySelector('.kpi-foot').textContent = r.length + ' opération(s) affichée(s)';
        if (keep) { const el = document.getElementById(keep); if (el) el.focus(); }
      };
      form.addEventListener('input', U.debounce((e) => { if (e.target.name === 'q') apply(); }, 220));
      form.addEventListener('change', (e) => { if (e.target.name !== 'q') apply(); });
      form.addEventListener('submit', (e) => e.preventDefault());

      main.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b || !main.contains(b)) return;
        const act = b.dataset.act;
        if (act === 'new-exp') Fm.openTransaction(null, { type: 'depense' });
        else if (act === 'new-inc') Fm.openTransaction(null, { type: 'recette', categoryId: (S.all('categories').find((c) => c.type === 'recette') || {}).id });
        else if (act === 'csv') exportCSV(filtered());
        else if (act === 'reset') { Object.assign(st, { q: '', type: '', status: '', categoryId: '', accountId: '', thirdPartyId: '', period: 'year' }); table.clearSelection(); O.App.refresh(); }
        else if (act === 'bulk-clear') { table.clearSelection(); table.render(); }
        else if (act === 'bulk-del') remove(Array.from(table.selected));
        else if (act === 'bulk-csv') exportCSV(S.all('transactions').filter((t) => table.selected.has(t.id)));
        else if (act === 'bulk-paid') {
          const ids = Array.from(table.selected).filter((id) => (S.get('transactions', id) || {}).status !== 'payee');
          for (const id of ids) await S.update('transactions', id, { status: 'payee' }, true);
          table.clearSelection(); S.emit('transactions'); UI.toast(ids.length + ' opération(s) marquée(s) payée(s).');
        } else if (b.dataset.edit) Fm.openTransaction(S.get('transactions', b.dataset.edit));
        else if (b.dataset.dup) {
          const src = S.get('transactions', b.dataset.dup);
          const copy = Object.assign({}, src, { date: U.today(), status: 'en_attente', invoiceId: null, attachments: [], label: src.label + ' (copie)' });
          delete copy.id;
          Fm.openTransaction(null, copy);
        } else if (b.dataset.del) remove([b.dataset.del]);
      });
    }
  };
})(window.Ondea);
