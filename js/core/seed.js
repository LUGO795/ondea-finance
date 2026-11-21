/* ==========================================================================
   Ondea Finance — Données de démonstration (générées au premier lancement)
   12 mois d'activité réaliste d'une TPE de services, relative à la date du jour.
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, F = O.F;

  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function build() {
    const r = rng(83300);
    const rand = (a, b) => Math.round(a + r() * (b - a));
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const today = U.today();
    const months = U.lastMonths(12);
    const now = new Date().toISOString();
    const D = { accounts: [], categories: [], thirdParties: [], paymentMethods: [], transactions: [], invoices: [], schedules: [], budgets: [], transfers: [] };
    const mk = (e, p, o) => { const rec = Object.assign({ id: p + '_' + (D[e].length + 1).toString(36) + Math.floor(r() * 1e6).toString(36), createdAt: now, updatedAt: now }, o); D[e].push(rec); return rec; };

    /* Comptes */
    const acc = mk('accounts', 'acc', { name: 'Compte courant pro', bank: 'Banque Méditerranée', iban: 'FR76 •••• •••• 4821', openingBalance: 1850000, color: '#D4AF37' });
    const sav = mk('accounts', 'acc', { name: 'Livret épargne pro', bank: 'Banque Méditerranée', iban: 'FR76 •••• •••• 9930', openingBalance: 2500000, color: '#2F8F83' });
    const cash = mk('accounts', 'acc', { name: 'Caisse', bank: 'Espèces', iban: '', openingBalance: 60000, color: '#C2573D' });

    /* Moyens de paiement */
    const pmVir = mk('paymentMethods', 'pm', { name: 'Virement bancaire', kind: 'virement', accountId: acc.id });
    const pmCB = mk('paymentMethods', 'pm', { name: 'Carte bancaire pro', kind: 'carte', accountId: acc.id });
    const pmPrl = mk('paymentMethods', 'pm', { name: 'Prélèvement SEPA', kind: 'prelevement', accountId: acc.id });
    const pmChq = mk('paymentMethods', 'pm', { name: 'Chèque', kind: 'cheque', accountId: acc.id });
    const pmEsp = mk('paymentMethods', 'pm', { name: 'Espèces', kind: 'especes', accountId: cash.id });

    /* Catégories */
    const C = {};
    [
      ['loyer', 'Loyer & charges locatives', 'depense', '#B8901F', '🏢'],
      ['salaires', 'Salaires & charges sociales', 'depense', '#5468C4', '👥'],
      ['fournitures', 'Fournitures & petit matériel', 'depense', '#2F8F83', '📦'],
      ['logiciels', 'Logiciels & abonnements', 'depense', '#A1559A', '💻'],
      ['marketing', 'Marketing & communication', 'depense', '#C2573D', '📣'],
      ['deplacements', 'Déplacements & repas', 'depense', '#2F7FBF', '🚗'],
      ['telecom', 'Télécom & internet', 'depense', '#5E8F2E', '📶'],
      ['energie', 'Énergie', 'depense', '#B9731F', '⚡'],
      ['assurances', 'Assurances', 'depense', '#4C7A6D', '🛡️'],
      ['honoraires', 'Honoraires & conseil', 'depense', '#8E5A66', '⚖️'],
      ['banque', 'Frais bancaires', 'depense', '#6B7280', '🏦'],
      ['impots', 'Impôts & taxes', 'depense', '#9B3B3B', '🧾'],
      ['prestations', 'Prestations de services', 'recette', '#2F8F83', '🛠️'],
      ['ventes', 'Ventes de produits', 'recette', '#D4AF37', '🛍️'],
      ['abonnements', 'Abonnements clients', 'recette', '#5468C4', '🔁'],
      ['autres', 'Autres produits', 'recette', '#5E8F2E', '✨']
    ].forEach(([k, name, type, color, icon]) => { C[k] = mk('categories', 'cat', { name, type, color, icon }); });
    C.tva = mk('categories', 'cat', { name: 'TVA reversée', type: 'depense', color: '#7A7F8C', icon: '🏛️', neutral: true, system: 'tva' });

    /* Tiers */
    const T = {};
    [
      ['sci', 'SCI Les Oliviers', 'fournisseur', 'Draguignan'], ['cloud', 'CloudSuite Pro', 'fournisseur', 'Lyon'], ['compta', 'Compta+ Online', 'fournisseur', 'Paris'],
      ['azur', 'Azur Télécom', 'fournisseur', 'Nice'], ['energie', 'Énergie Provence', 'fournisseur', 'Marseille'], ['bureau', 'Bureau Var Fournitures', 'fournisseur', 'Toulon'],
      ['expert', 'Cabinet Varois Expertise', 'fournisseur', 'Draguignan'], ['assur', 'Mutuelle Pro Sud', 'fournisseur', 'Aix-en-Provence'], ['print', 'Imprimerie du Lac', 'fournisseur', 'Fréjus'],
      ['studio', 'Studio Design App', 'fournisseur', 'Bordeaux'], ['sncf', 'Rail & Route Voyages', 'fournisseur', 'Paris'], ['urssaf', 'Organisme social régional', 'fournisseur', 'Toulon'],
      ['c1', 'Hôtel Bellevue Saint-Raphaël', 'client', 'Saint-Raphaël'], ['c2', 'Domaine des Vignes Hautes', 'client', 'Lorgues'], ['c3', 'Cabinet Médical Estérel', 'client', 'Fréjus'],
      ['c4', 'Garage Provence Auto', 'client', 'Draguignan'], ['c5', 'Boulangerie Le Fournil', 'client', 'Trans-en-Provence'], ['c6', 'Association Var Culture', 'client', 'Toulon'],
      ['c7', 'Pharmacie des Arcades', 'client', 'Le Muy'], ['c8', 'Mairie de Figanières', 'client', 'Figanières']
    ].forEach(([k, name, kind, city], i) => {
      T[k] = mk('thirdParties', 'tp', {
        name, kind, city,
        siret: String(30000000000000 + i * 7919731).slice(0, 14).replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4'),
        email: 'contact@' + U.norm(name).replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '').slice(0, 22) + '.fr',
        phone: '04 94 ' + String(rand(10, 99)) + ' ' + String(rand(10, 99)) + ' ' + String(rand(10, 99)),
        address: rand(2, 140) + ' avenue de la République, ' + city,
        paymentTerms: kind === 'client' ? 30 : 30, notes: ''
      });
    });
    const clients = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'].map((k) => T[k]);

    const tx = (o) => {
      const a = F.amounts(o.ht, o.vat == null ? 20 : o.vat);
      const status = o.status || (o.date > today ? 'en_attente' : (U.diffDays(o.date, today) < 3 && r() < .5 ? 'en_attente' : 'payee'));
      return mk('transactions', 'tx', Object.assign({ reference: '', notes: '', attachments: [], invoiceId: null, scheduleId: null }, o, { vatRate: o.vat == null ? 20 : o.vat, status, accountId: o.accountId || acc.id }, a, { ht: undefined, vat: undefined }));
    };
    const clean = (t) => { delete t.ht; delete t.vat; return t; };

    months.forEach((m, mi) => {
      const day = (d) => { const last = Number(U.monthEnd(m).slice(8)); return m + '-' + String(Math.min(d, last)).padStart(2, '0'); };
      const ok = (d) => d <= today;
      const D5 = day(5);
      if (ok(D5)) clean(tx({ type: 'depense', date: D5, label: 'Loyer bureaux ' + U.monthLabel(m), ht: 145000, categoryId: C.loyer.id, thirdPartyId: T.sci.id, paymentMethodId: pmPrl.id }));
      const D28 = day(28);
      if (ok(D28)) clean(tx({ type: 'depense', date: D28, label: 'Salaires ' + U.monthLabel(m, true), ht: 980000 + (mi > 6 ? 120000 : 0), vat: 0, categoryId: C.salaires.id, thirdPartyId: null, paymentMethodId: pmVir.id }));
      const D15 = day(15);
      if (ok(D15)) clean(tx({ type: 'depense', date: D15, label: 'Cotisations sociales', ht: 412000 + (mi > 6 ? 50000 : 0), vat: 0, categoryId: C.salaires.id, thirdPartyId: T.urssaf.id, paymentMethodId: pmPrl.id }));
      [[3, 'Abonnement CloudSuite Pro', 8900, T.cloud], [4, 'Logiciel Compta+ Online', 3900, T.compta], [9, 'Licence Studio Design App', 5400, T.studio]].forEach(([d, l, v, t]) => { if (ok(day(d))) clean(tx({ type: 'depense', date: day(d), label: l, ht: v, categoryId: C.logiciels.id, thirdPartyId: t.id, paymentMethodId: pmCB.id })); });
      if (ok(day(12))) clean(tx({ type: 'depense', date: day(12), label: 'Forfait fibre + mobiles', ht: 7990, categoryId: C.telecom.id, thirdPartyId: T.azur.id, paymentMethodId: pmPrl.id }));
      if (mi % 2 === 0 && ok(day(18))) clean(tx({ type: 'depense', date: day(18), label: 'Électricité bimestrielle', ht: rand(16000, 26000), categoryId: C.energie.id, thirdPartyId: T.energie.id, paymentMethodId: pmPrl.id }));
      if (ok(day(20))) clean(tx({ type: 'depense', date: day(20), label: 'Honoraires expert-comptable', ht: 28000, categoryId: C.honoraires.id, thirdPartyId: T.expert.id, paymentMethodId: pmVir.id }));
      if (ok(day(27))) clean(tx({ type: 'depense', date: day(27), label: 'Frais de tenue de compte', ht: 1850, vat: 0, categoryId: C.banque.id, thirdPartyId: null, paymentMethodId: pmPrl.id }));
      if (mi % 3 === 1 && ok(day(10))) clean(tx({ type: 'depense', date: day(10), label: 'Assurance RC Pro & multirisque', ht: 42000, vat: 0, categoryId: C.assurances.id, thirdPartyId: T.assur.id, paymentMethodId: pmPrl.id }));
      for (let i = 0, n = rand(2, 4); i < n; i++) { const d = day(rand(1, 28)); if (ok(d)) clean(tx({ type: 'depense', date: d, label: pick(['Papeterie & consommables', 'Cartouches imprimante', 'Petit matériel informatique', 'Mobilier de bureau', 'Câbles & accessoires']), ht: rand(3500, 42000), categoryId: C.fournitures.id, thirdPartyId: T.bureau.id, paymentMethodId: pick([pmCB, pmCB, pmChq]).id })); }
      for (let i = 0, n = rand(1, 3); i < n; i++) { const d = day(rand(1, 28)); if (ok(d)) { const esp = r() < .25; clean(tx({ type: 'depense', date: d, label: pick(['Déplacement client', 'Repas d’affaires', 'Billets de train Paris', 'Péage & carburant', 'Parking centre-ville']), ht: rand(2500, 26000), vat: pick([10, 20, 20]), categoryId: C.deplacements.id, thirdPartyId: r() < .5 ? T.sncf.id : null, paymentMethodId: esp ? pmEsp.id : pmCB.id, accountId: esp ? cash.id : acc.id })); } }
      for (let i = 0, n = rand(0, 2); i < n; i++) { const d = day(rand(1, 28)); if (ok(d)) clean(tx({ type: 'depense', date: d, label: pick(['Campagne réseaux sociaux', 'Flyers & cartes de visite', 'Salon professionnel', 'Référencement local']), ht: rand(18000, 95000), categoryId: C.marketing.id, thirdPartyId: T.print.id, paymentMethodId: pmCB.id })); }
      if (m.endsWith('-12') && ok(day(15))) clean(tx({ type: 'depense', date: day(15), label: 'Cotisation foncière des entreprises', ht: 64000, vat: 0, categoryId: C.impots.id, thirdPartyId: null, paymentMethodId: pmVir.id }));
      // Recettes
      for (let i = 0, n = rand(6, 9); i < n; i++) { const d = day(rand(2, 28)); if (ok(d)) clean(tx({ type: 'recette', date: d, label: pick(['Création site vitrine', 'Maintenance applicative', 'Refonte e-commerce', 'Audit cybersécurité', 'Formation équipe', 'Développement sur mesure', 'Intégration API']), ht: rand(80000, 420000), categoryId: C.prestations.id, thirdPartyId: pick(clients).id, paymentMethodId: pick([pmVir, pmVir, pmChq]).id })); }
      for (let i = 0, n = rand(3, 6); i < n; i++) { const d = day(rand(1, 28)); if (ok(d)) clean(tx({ type: 'recette', date: d, label: pick(['Vente template premium', 'Vente kit graphique', 'Pack licences']), ht: rand(9000, 160000), categoryId: C.ventes.id, thirdPartyId: pick(clients).id, paymentMethodId: pmVir.id })); }
      if (ok(day(2))) clients.slice(0, 3).forEach((c) => clean(tx({ type: 'recette', date: day(2), label: 'Abonnement hébergement & support', ht: 29000, categoryId: C.abonnements.id, thirdPartyId: c.id, paymentMethodId: pmPrl.id })));
      if (mi === 7 && ok(day(22))) clean(tx({ type: 'recette', date: day(22), label: 'Aide régionale à la numérisation', ht: 250000, vat: 0, categoryId: C.autres.id, thirdPartyId: null, paymentMethodId: pmVir.id }));
    });

    /* Reversement mensuel de la TVA (déclaration CA3 du mois précédent, le 19) */
    months.forEach((m, mi) => {
      if (!mi) return;
      const prev = months[mi - 1], d = m + '-19';
      if (d > today) return;
      const inPrev = (t) => t.date.slice(0, 7) === prev && t.categoryId !== C.tva.id;
      const due = U.sum(D.transactions.filter((t) => inPrev(t) && t.type === 'recette'), (t) => t.amountVAT) - U.sum(D.transactions.filter((t) => inPrev(t) && t.type === 'depense'), (t) => t.amountVAT);
      if (due > 0) clean(tx({ type: 'depense', date: d, label: 'TVA à reverser — ' + U.monthLabel(prev, true), ht: due, vat: 0, categoryId: C.tva.id, thirdPartyId: null, paymentMethodId: pmVir.id, status: 'payee', reference: 'CA3-' + prev }));
    });

    /* Opérations à venir (en attente) */
    clean(tx({ type: 'depense', date: U.addDays(today, 6), label: 'Achat poste de travail', ht: 129000, categoryId: C.fournitures.id, thirdPartyId: T.bureau.id, paymentMethodId: pmCB.id, status: 'en_attente' }));
    clean(tx({ type: 'recette', date: U.addDays(today, 9), label: 'Acompte refonte site', ht: 150000, categoryId: C.prestations.id, thirdPartyId: T.c2.id, paymentMethodId: pmVir.id, status: 'en_attente' }));

    /* Virements internes */
    months.slice(-6).forEach((m, i) => { const d = m + '-25'; if (d <= today && i % 2 === 0) mk('transfers', 'trf', { date: d, fromId: acc.id, toId: sav.id, amount: 200000, label: 'Épargne de précaution' }); });
    mk('transfers', 'trf', { date: U.addDays(today, -20) <= today ? U.addDays(today, -20) : today, fromId: acc.id, toId: cash.id, amount: 30000, label: 'Approvisionnement caisse' });

    /* Factures */
    let nCli = 1, nSup = 1;
    const year = today.slice(0, 4);
    const inv = (o) => { const a = F.amounts(o.ht, o.vat == null ? 20 : o.vat); const rec = mk('invoices', 'inv', Object.assign({ attachments: [], notes: '', transactionId: null, paidDate: null }, o, { vatRate: o.vat == null ? 20 : o.vat }, a)); delete rec.ht; delete rec.vat; return rec; };
    // Factures clients déjà encaissées, liées aux opérations existantes
    D.transactions.filter((t) => t.type === 'recette' && t.categoryId === C.prestations.id && t.status === 'payee').slice(-8).forEach((t) => {
      const i = inv({ direction: 'client', number: 'FAC-' + year + '-' + String(nCli++).padStart(4, '0'), thirdPartyId: t.thirdPartyId, categoryId: t.categoryId, label: t.label, issueDate: U.addDays(t.date, -21), dueDate: U.addDays(t.date, 9), ht: t.amountHT, vat: t.vatRate, status: 'payee', paidDate: t.date, transactionId: t.id });
      t.invoiceId = i.id;
    });
    // Factures clients en attente / en retard
    [[-45, 330000, 'c4', 'Application de gestion atelier'], [-38, 96000, 'c5', 'Site de commande en ligne'], [-12, 214000, 'c1', 'Module réservation'], [-5, 180000, 'c6', 'Billetterie en ligne'], [-2, 62000, 'c7', 'Maintenance trimestrielle']].forEach(([d, ht, c, l]) => {
      inv({ direction: 'client', number: 'FAC-' + year + '-' + String(nCli++).padStart(4, '0'), thirdPartyId: T[c].id, categoryId: C.prestations.id, label: l, issueDate: U.addDays(today, d), dueDate: U.addDays(today, d + 30), ht, status: 'emise' });
    });
    inv({ direction: 'client', number: 'FAC-' + year + '-' + String(nCli++).padStart(4, '0'), thirdPartyId: T.c8.id, categoryId: C.prestations.id, label: 'Portail citoyen — phase 1', issueDate: today, dueDate: U.addDays(today, 30), ht: 450000, status: 'brouillon' });
    // Factures fournisseurs
    [[-40, 'print', 78000, 'Impression catalogues', C.marketing], [-18, 'bureau', 54000, 'Fauteuils ergonomiques', C.fournitures], [-6, 'expert', 120000, 'Bilan annuel & liasse fiscale', C.honoraires], [-3, 'energie', 31000, 'Régularisation énergie', C.energie]].forEach(([d, t, ht, l, cat]) => {
      inv({ direction: 'fournisseur', number: 'F-' + String(nSup++).padStart(5, '0') + '-' + T[t].name.split(' ')[0].toUpperCase().slice(0, 4), thirdPartyId: T[t].id, categoryId: cat.id, label: l, issueDate: U.addDays(today, d), dueDate: U.addDays(today, d + 30), ht, status: 'emise' });
    });

    /* Échéancier récurrent */
    const nextDay = (d) => { let x = today.slice(0, 8) + String(d).padStart(2, '0'); if (x <= today) x = U.addMonths(x, 1); return x; };
    const sch = (o) => { const a = F.amounts(o.ht, o.vat == null ? 20 : o.vat); const rec = mk('schedules', 'sch', Object.assign({ active: true, endDate: '', accountId: acc.id }, o, { vatRate: o.vat == null ? 20 : o.vat }, a)); delete rec.ht; delete rec.vat; return rec; };
    sch({ label: 'Loyer bureaux', type: 'depense', ht: 145000, categoryId: C.loyer.id, thirdPartyId: T.sci.id, paymentMethodId: pmPrl.id, frequency: 'mensuelle', nextDate: nextDay(5) });
    sch({ label: 'Salaires', type: 'depense', ht: 1100000, vat: 0, categoryId: C.salaires.id, thirdPartyId: null, paymentMethodId: pmVir.id, frequency: 'mensuelle', nextDate: nextDay(28) });
    sch({ label: 'Cotisations sociales', type: 'depense', ht: 462000, vat: 0, categoryId: C.salaires.id, thirdPartyId: T.urssaf.id, paymentMethodId: pmPrl.id, frequency: 'mensuelle', nextDate: nextDay(15) });
    sch({ label: 'Abonnement CloudSuite Pro', type: 'depense', ht: 8900, categoryId: C.logiciels.id, thirdPartyId: T.cloud.id, paymentMethodId: pmCB.id, frequency: 'mensuelle', nextDate: nextDay(3) });
    sch({ label: 'Assurance RC Pro & multirisque', type: 'depense', ht: 42000, vat: 0, categoryId: C.assurances.id, thirdPartyId: T.assur.id, paymentMethodId: pmPrl.id, frequency: 'trimestrielle', nextDate: U.addDays(today, 24) });
    sch({ label: 'Cotisation foncière des entreprises', type: 'depense', ht: 64000, vat: 0, categoryId: C.impots.id, thirdPartyId: null, paymentMethodId: pmVir.id, frequency: 'annuelle', nextDate: U.addMonths(today.slice(0, 4) + '-12-15', today.slice(5) > '12-15' ? 12 : 0) });
    clients.slice(0, 3).forEach((c) => sch({ label: 'Abonnement support — ' + c.name, type: 'recette', ht: 29000, categoryId: C.abonnements.id, thirdPartyId: c.id, paymentMethodId: pmPrl.id, frequency: 'mensuelle', nextDate: nextDay(2) }));

    /* Budgets mensuels HT */
    [['loyer', 150000], ['salaires', 1600000], ['fournitures', 70000], ['logiciels', 20000], ['marketing', 60000], ['deplacements', 30000], ['telecom', 9000], ['energie', 15000], ['honoraires', 30000], ['banque', 2500]].forEach(([k, amt]) => mk('budgets', 'bud', { categoryId: C[k].id, period: 'mensuel', amount: amt, alert: 80 }));
    mk('budgets', 'bud', { categoryId: C.assurances.id, period: 'annuel', amount: 180000, alert: 85 });

    return { data: D, refs: { acc, T, C } };
  }

  /** Génère quelques justificatifs SVG (reçus / factures) pour la démonstration */
  function receiptSVG(title, lines, total, color) {
    const rows = lines.map((l, i) => '<text x="40" y="' + (230 + i * 34) + '" font-size="20" fill="#333">' + U.esc(l[0]) + '</text><text x="560" y="' + (230 + i * 34) + '" font-size="20" fill="#333" text-anchor="end">' + U.esc(l[1]) + '</text>').join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="600" height="800" fill="#fffdf7"/><rect width="600" height="120" fill="' + color + '"/>' +
      '<text x="40" y="72" font-family="Georgia,serif" font-size="34" fill="#fff" font-weight="bold">' + U.esc(title) + '</text>' +
      '<text x="40" y="170" font-family="Arial" font-size="18" fill="#555">Document de démonstration — Ondea Finance</text><line x1="40" y1="195" x2="560" y2="195" stroke="#ccc"/>' +
      '<g font-family="Arial">' + rows + '</g><line x1="40" y1="' + (250 + lines.length * 34) + '" x2="560" y2="' + (250 + lines.length * 34) + '" stroke="#999"/>' +
      '<text x="40" y="' + (290 + lines.length * 34) + '" font-family="Arial" font-size="24" font-weight="bold" fill="#111">TOTAL TTC</text><text x="560" y="' + (290 + lines.length * 34) + '" font-family="Arial" font-size="24" font-weight="bold" fill="#111" text-anchor="end">' + U.esc(total) + '</text>' +
      '<text x="300" y="760" font-family="Arial" font-size="14" fill="#888" text-anchor="middle">Merci de votre confiance</text></svg>';
  }

  async function seedFiles(D) {
    if (!O.Files.available) return;
    const pick = (pred) => D.transactions.filter(pred).slice(-1)[0];
    const items = [
      { tx: pick((t) => t.label.startsWith('Loyer')), folder: 'factures', title: 'Avis d’échéance loyer', color: '#7E5E06' },
      { tx: pick((t) => t.categoryId && O.Store.get('categories', t.categoryId) && O.Store.get('categories', t.categoryId).name.startsWith('Déplacements')), folder: 'recus', title: 'Reçu — Déplacement', color: '#2F7FBF' },
      { tx: pick((t) => t.label.startsWith('Forfait fibre')), folder: 'factures', title: 'Facture Azur Télécom', color: '#5E8F2E' },
      { tx: pick((t) => t.label.startsWith('Honoraires')), folder: 'justificatifs', title: 'Note d’honoraires', color: '#8E5A66' }
    ];
    for (const it of items) {
      if (!it.tx) continue;
      const svg = receiptSVG(it.title, [['Libellé', it.tx.label.slice(0, 28)], ['Date', U.fmtDate(it.tx.date)], ['Montant HT', U.money(it.tx.amountHT)], ['TVA ' + it.tx.vatRate + ' %', U.money(it.tx.amountVAT)]], U.money(it.tx.amountTTC), it.color);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const meta = await O.Files.add(blob, { name: it.title.replace(/[^\wÀ-ÿ]+/g, '-').replace(/-+$/, '') + '.svg', folder: it.folder, createdAt: new Date(it.tx.date + 'T10:00:00').toISOString() });
      await O.Store.update('transactions', it.tx.id, { attachments: [meta.id] }, true);
    }
    const note = new Blob(['Contrat de maintenance — Résumé\n\nClient : Hôtel Bellevue Saint-Raphaël\nDurée : 12 mois reconductibles\nMontant : 290,00 € HT / mois\n\nDocument de démonstration généré par Ondea Finance.'], { type: 'text/plain' });
    await O.Files.add(note, { name: 'Contrat-maintenance-Bellevue.txt', folder: 'contrats' });
  }

  O.Seed = {
    /** Référentiels de base (catégories, moyens de paiement, un compte) sans aucune opération */
    async base() {
      const { data } = build();
      const acc = Object.assign({}, data.accounts[0], { openingBalance: 0, iban: '' });
      const empty = { accounts: [acc], categories: data.categories, paymentMethods: data.paymentMethods.map((p) => Object.assign({}, p, { accountId: acc.id })), thirdParties: [], transactions: [], invoices: [], schedules: [], budgets: [], transfers: [] };
      await O.Store.replaceAll(empty, Object.assign({}, O.Store.settings));
    },
    async run() {
      const { data } = build();
      await O.Store.replaceAll(data, Object.assign({}, O.Store.settings));
      await seedFiles(O.Store.exportData());
      O.Store.emit('*');
    }
  };
})(window.Ondea);
