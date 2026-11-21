/* ==========================================================================
   Ondea Finance — Moteur de calculs financiers
   Conventions :
     • Montants en centimes entiers.
     • Trésorerie = flux TTC réellement payés (statut « payee »).
     • Résultat / budgets / rapports = montants HT (TVA récupérable exclue).
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store;

  const F = {};
  F.FREQ = {
    mensuelle: { label: 'Mensuelle', months: 1 },
    trimestrielle: { label: 'Trimestrielle', months: 3 },
    semestrielle: { label: 'Semestrielle', months: 6 },
    annuelle: { label: 'Annuelle', months: 12 },
    ponctuelle: { label: 'Ponctuelle', months: 0 }
  };
  F.VAT_RATES = [20, 10, 5.5, 2.1, 0];

  /** Calcule HT / TVA / TTC à partir d'une base HT ou TTC */
  F.amounts = (value, rate, base) => {
    const r = Number(rate) || 0;
    if (base === 'ttc') {
      const ht = Math.round((value * 100) / (100 + r));
      return { amountHT: ht, amountVAT: value - ht, amountTTC: value };
    }
    const vat = U.vat(value, r);
    return { amountHT: value, amountVAT: vat, amountTTC: value + vat };
  };

  F.inRange = (iso, from, to) => (!from || iso >= from) && (!to || iso <= to);
  F.sign = (t) => (t.type === 'recette' ? 1 : -1);

  /* ---- Comptes & trésorerie ---- */
  F.balance = (accountId, upTo) => {
    const acc = S.get('accounts', accountId);
    if (!acc) return 0;
    let b = acc.openingBalance || 0;
    S.all('transactions').forEach((t) => {
      if (t.accountId === accountId && t.status === 'payee' && (!upTo || t.date <= upTo)) b += F.sign(t) * t.amountTTC;
    });
    S.all('transfers').forEach((tr) => {
      if (upTo && tr.date > upTo) return;
      if (tr.toId === accountId) b += tr.amount;
      if (tr.fromId === accountId) b -= tr.amount;
    });
    return b;
  };
  F.totalBalance = (upTo) => U.sum(S.all('accounts'), (a) => F.balance(a.id, upTo));

  /* ---- Agrégats ---- */
  /** Catégorie « hors résultat » (TVA reversée, emprunts, apports…) : impacte la trésorerie, pas le résultat */
  F.isNeutral = (catId) => { const c = S.get('categories', catId); return !!(c && c.neutral); };
  F.ops = (filter) => S.all('transactions').filter((t) => {
    const f = filter || {};
    if (!f.withNeutral && !f.categoryId && F.isNeutral(t.categoryId)) return false;
    if (f.type && t.type !== f.type) return false;
    if (f.status && t.status !== f.status) return false;
    if (f.categoryId && t.categoryId !== f.categoryId) return false;
    if (f.accountId && t.accountId !== f.accountId) return false;
    return F.inRange(t.date, f.from, f.to);
  });
  F.total = (filter, field) => U.sum(F.ops(filter), (t) => t[field || 'amountHT'] || 0);

  /** Flux mensuels : encaissements / décaissements TTC payés + solde de fin de mois */
  F.cashSeries = (months) => months.map((k) => {
    const from = U.monthStart(k), to = U.monthEnd(k);
    const inc = F.total({ type: 'recette', status: 'payee', from, to, withNeutral: true }, 'amountTTC');
    const exp = F.total({ type: 'depense', status: 'payee', from, to, withNeutral: true }, 'amountTTC');
    return { key: k, inc, exp, net: inc - exp, balance: F.totalBalance(to) };
  });
  /** Résultat mensuel HT (toutes opérations datées du mois) */
  F.resultSeries = (months) => months.map((k) => {
    const from = U.monthStart(k), to = U.monthEnd(k);
    const inc = F.total({ type: 'recette', from, to });
    const exp = F.total({ type: 'depense', from, to });
    return { key: k, inc, exp, result: inc - exp };
  });
  F.byCategory = (type, from, to) => {
    const map = new Map();
    F.ops({ type, from, to }).forEach((t) => map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amountHT));
    return Array.from(map, ([id, value]) => {
      const c = S.get('categories', id);
      return { id, label: c ? c.name : 'Sans catégorie', color: c ? c.color : '#888', icon: c ? c.icon : '•', value };
    }).sort((a, b) => b.value - a.value);
  };
  F.byThirdParty = (type, from, to) => {
    const map = new Map();
    F.ops({ type, from, to }).forEach((t) => { if (t.thirdPartyId) map.set(t.thirdPartyId, (map.get(t.thirdPartyId) || 0) + t.amountHT); });
    return Array.from(map, ([id, value]) => ({ id, label: S.name('thirdParties', id), value })).sort((a, b) => b.value - a.value);
  };
  F.vatSummary = (from, to) => {
    const collected = F.total({ type: 'recette', from, to }, 'amountVAT');
    const deductible = F.total({ type: 'depense', from, to }, 'amountVAT');
    const byRate = {};
    F.ops({ from, to }).forEach((t) => {
      const k = String(t.vatRate);
      byRate[k] = byRate[k] || { rate: t.vatRate, collected: 0, deductible: 0, baseInc: 0, baseExp: 0 };
      if (t.type === 'recette') { byRate[k].collected += t.amountVAT; byRate[k].baseInc += t.amountHT; }
      else { byRate[k].deductible += t.amountVAT; byRate[k].baseExp += t.amountHT; }
    });
    const paid = U.sum(S.all('transactions').filter((t) => t.type === 'depense' && t.status === 'payee' && F.inRange(t.date, from, to) && (S.get('categories', t.categoryId) || {}).system === 'tva'), (t) => t.amountTTC);
    return { collected, deductible, due: collected - deductible, paid, byRate: Object.values(byRate).sort((a, b) => b.rate - a.rate) };
  };
  F.variation = (cur, prev) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null);

  /* ---- Factures ---- */
  F.invoiceState = (inv) => {
    if (inv.status === 'brouillon') return { key: 'brouillon', label: 'Brouillon', cls: 'b-muted' };
    if (inv.status === 'payee') return { key: 'payee', label: inv.direction === 'client' ? 'Encaissée' : 'Payée', cls: 'b-inc' };
    if (inv.dueDate < U.today()) return { key: 'retard', label: 'En retard', cls: 'b-danger' };
    return { key: 'attente', label: inv.direction === 'client' ? 'À encaisser' : 'À payer', cls: 'b-warn' };
  };
  F.openInvoices = (direction) => S.all('invoices').filter((i) => i.direction === direction && i.status === 'emise');

  /* ---- Échéancier ---- */
  F.occurrences = (sch, from, to) => {
    const out = [];
    if (!sch.active || !sch.nextDate) return out;
    const step = (F.FREQ[sch.frequency] || {}).months || 0;
    let d = sch.nextDate, guard = 0;
    while (d <= to && guard++ < 400) {
      if (sch.endDate && d > sch.endDate) break;
      if (d >= from) out.push(d);
      if (!step) break;
      d = U.addMonths(sch.nextDate, step * guard);
    }
    return out;
  };
  F.nextAfter = (sch) => {
    const step = (F.FREQ[sch.frequency] || {}).months || 0;
    if (!step) return null;
    const n = U.addMonths(sch.nextDate, step);
    return sch.endDate && n > sch.endDate ? null : n;
  };
  /** Liste chronologique des flux à venir (échéances, factures ouvertes, opérations en attente) */
  F.upcoming = (days) => {
    const today = U.today(), to = U.addDays(today, days);
    const items = [];
    S.all('schedules').forEach((s) => F.occurrences(s, U.addDays(today, -60), to).forEach((d) => items.push({
      kind: 'echeance', date: d, label: s.label, type: s.type, amount: s.amountTTC, ref: s, overdue: d < today
    })));
    S.all('invoices').filter((i) => i.status === 'emise').forEach((i) => {
      if (i.dueDate <= to) items.push({ kind: 'facture', date: i.dueDate, label: (i.direction === 'client' ? 'Encaissement ' : 'Règlement ') + i.number + ' — ' + S.name('thirdParties', i.thirdPartyId), type: i.direction === 'client' ? 'recette' : 'depense', amount: i.amountTTC, ref: i, overdue: i.dueDate < today });
    });
    S.all('transactions').filter((t) => t.status === 'en_attente' && t.date <= to).forEach((t) => items.push({
      kind: 'operation', date: t.date, label: t.label, type: t.type, amount: t.amountTTC, ref: t, overdue: t.date < today
    }));
    return items.sort((a, b) => a.date.localeCompare(b.date));
  };
  /** Prévision de trésorerie jour par jour */
  F.forecast = (days) => {
    const today = U.today();
    const start = F.totalBalance(today);
    const deltas = {};
    F.upcoming(days).forEach((it) => {
      const d = it.date < today ? today : it.date;
      deltas[d] = (deltas[d] || 0) + (it.type === 'recette' ? 1 : -1) * it.amount;
    });
    const pts = []; let bal = start, min = { date: today, value: start };
    for (let i = 0; i <= days; i++) {
      const d = U.addDays(today, i);
      bal += deltas[d] || 0;
      pts.push({ date: d, value: bal });
      if (bal < min.value) min = { date: d, value: bal };
    }
    return { start, end: bal, min, points: pts };
  };

  /* ---- Budgets (HT) ---- */
  F.budgetUsage = (b, monthKey) => {
    const mk = monthKey || U.monthKey(U.today());
    let from, to, limit;
    if (b.period === 'annuel') { from = mk.slice(0, 4) + '-01-01'; to = mk.slice(0, 4) + '-12-31'; limit = b.amount; }
    else { from = U.monthStart(mk); to = U.monthEnd(mk); limit = b.amount; }
    const spent = F.total({ type: 'depense', categoryId: b.categoryId, from, to });
    const pct = limit ? (spent / limit) * 100 : 0;
    const alert = b.alert || S.settings.budgetAlert || 80;
    const state = pct >= 100 ? 'over' : pct >= alert ? 'warn' : 'ok';
    return { spent, limit, remaining: limit - spent, pct, state, from, to };
  };

  O.F = F;
})(window.Ondea);
