/* ==========================================================================
   Ondea Finance — Store (cache mémoire + événements)
   Les vues lisent ici de façon synchrone ; les écritures passent par le pilote.
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U;

  const PREFIX = { accounts: 'acc', categories: 'cat', thirdParties: 'tp', paymentMethods: 'pm', transactions: 'tx', invoices: 'inv', schedules: 'sch', budgets: 'bud', transfers: 'trf' };
  const DEFAULT_SETTINGS = {
    companyName: 'Atelier Méditerranée SARL',
    siret: '',
    address: '',
    email: '',
    vatDefault: 20,
    theme: null,
    fontScale: 100,
    storageQuotaMB: 500,
    invoicePrefix: 'FAC-',
    budgetAlert: 80
  };

  /** Règles d'intégrité : qui référence quoi (empêche les orphelins) */
  const REFS = {
    accounts: [['transactions', 'accountId'], ['schedules', 'accountId'], ['transfers', 'fromId'], ['transfers', 'toId'], ['paymentMethods', 'accountId']],
    categories: [['transactions', 'categoryId'], ['invoices', 'categoryId'], ['schedules', 'categoryId'], ['budgets', 'categoryId']],
    thirdParties: [['transactions', 'thirdPartyId'], ['invoices', 'thirdPartyId'], ['schedules', 'thirdPartyId']],
    paymentMethods: [['transactions', 'paymentMethodId'], ['schedules', 'paymentMethodId']]
  };
  const LABELS = { transactions: 'opération(s)', invoices: 'facture(s)', schedules: 'échéance(s)', budgets: 'budget(s)', transfers: 'virement(s)', paymentMethods: 'moyen(s) de paiement' };

  const Store = {
    driver: null,
    state: {},
    settings: Object.assign({}, DEFAULT_SETTINGS),
    listeners: new Set(),

    async init(driver) {
      this.driver = driver;
      await this.reload();
    },
    async reload() {
      for (const e of O.ENTITIES) this.state[e] = (await this.driver.list(e)) || [];
      this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.driver.getSettings()) || {});
    },
    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    emit(entity) { this.listeners.forEach((fn) => { try { fn(entity); } catch (e) { console.warn(e); } }); },

    all(e) { return this.state[e] || []; },
    get(e, id) { return (this.state[e] || []).find((r) => r.id === id) || null; },
    name(e, id, fallback) { const r = this.get(e, id); return r ? r.name : (fallback == null ? '—' : fallback); },

    async create(e, data, silent) {
      const now = new Date().toISOString();
      const rec = Object.assign({}, data, { id: data.id || U.uid(PREFIX[e] || e), createdAt: data.createdAt || now, updatedAt: now });
      const saved = (await this.driver.create(e, rec)) || rec;
      this.state[e].push(saved);
      if (!silent) this.emit(e);
      return saved;
    },
    async update(e, id, patch, silent) {
      const cur = this.get(e, id);
      if (!cur) throw new Error('Élément introuvable');
      const rec = Object.assign({}, cur, patch, { id, updatedAt: new Date().toISOString() });
      const saved = (await this.driver.update(e, id, rec)) || rec;
      const i = this.state[e].findIndex((r) => r.id === id);
      this.state[e][i] = saved;
      if (!silent) this.emit(e);
      return saved;
    },
    /** Renvoie la liste des usages bloquants d'un enregistrement */
    usages(e, id) {
      const out = [];
      (REFS[e] || []).forEach(([ent, field]) => {
        const n = this.all(ent).filter((r) => r[field] === id).length;
        if (n) out.push(n + ' ' + (LABELS[ent] || ent));
      });
      return out;
    },
    async remove(e, id, silent) {
      const used = this.usages(e, id);
      if (used.length) throw new Error('Suppression impossible : utilisé par ' + used.join(', ') + '.');
      // Effets de bord cohérents
      if (e === 'transactions') {
        for (const inv of this.all('invoices').filter((i) => i.transactionId === id)) {
          await this.update('invoices', inv.id, { transactionId: null, status: 'emise', paidDate: null }, true);
        }
      }
      if (e === 'invoices') {
        for (const tx of this.all('transactions').filter((t) => t.invoiceId === id)) {
          await this.update('transactions', tx.id, { invoiceId: null }, true);
        }
      }
      await this.driver.remove(e, id);
      this.state[e] = this.state[e].filter((r) => r.id !== id);
      if (!silent) this.emit(e);
      return true;
    },
    async saveSettings(patch) {
      this.settings = Object.assign({}, this.settings, patch);
      await this.driver.saveSettings(this.settings);
      this.emit('settings');
    },
    /** Retire un fichier de toutes les pièces jointes */
    async detachFile(fileId) {
      for (const e of ['transactions', 'invoices']) {
        for (const r of this.all(e).filter((x) => (x.attachments || []).includes(fileId))) {
          await this.update(e, r.id, { attachments: r.attachments.filter((a) => a !== fileId) }, true);
        }
      }
      this.emit('transactions');
    },
    exportData() {
      const data = {};
      O.ENTITIES.forEach((e) => { data[e] = this.all(e); });
      return data;
    },
    async replaceAll(data, settings) {
      await this.driver.replaceAll(data);
      if (settings) await this.driver.saveSettings(Object.assign({}, DEFAULT_SETTINGS, settings));
      await this.driver.markInitialized();
      await this.reload();
      this.emit('*');
    },
    async clearAll() {
      const keep = this.settings;
      await this.driver.clearAll();
      await this.driver.saveSettings(keep);
      await this.driver.markInitialized();
      await this.reload();
      this.emit('*');
    }
  };

  O.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  O.Store = Store;
})(window.Ondea);
