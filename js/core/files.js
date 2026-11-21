/* ==========================================================================
   Ondea Finance — Espace de stockage personnel (justificatifs, factures, reçus)
   Binaires dans IndexedDB ; métadonnées mises en cache en mémoire.
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U;

  const FOLDERS = [
    { id: 'factures', name: 'Factures', icon: 'invoice' },
    { id: 'recus', name: 'Reçus & tickets', icon: 'receipt' },
    { id: 'justificatifs', name: 'Justificatifs', icon: 'shield' },
    { id: 'contrats', name: 'Contrats', icon: 'file' },
    { id: 'banque', name: 'Relevés bancaires', icon: 'bank' },
    { id: 'divers', name: 'Divers', icon: 'folder' }
  ];
  const MAX_FILE = 25 * 1024 * 1024; // 25 Mo par fichier
  const ACCEPT = /^(image\/|application\/pdf|text\/|application\/(json|xml|zip|msword|vnd\.))/;

  const Files = {
    driver: null,
    available: false,
    meta: [],
    FOLDERS,
    MAX_FILE,

    async init(driver) {
      this.driver = driver;
      try { await driver.open(); this.meta = await driver.list(); this.available = true; }
      catch (e) { this.available = false; this.error = e.message; this.meta = []; }
    },
    all() { return this.meta.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); },
    getMeta(id) { return this.meta.find((m) => m.id === id) || null; },
    used() { return U.sum(this.meta, (m) => m.size || 0); },
    quota() { return (O.Store.settings.storageQuotaMB || 500) * 1024 * 1024; },
    folderName(id) { const f = FOLDERS.find((x) => x.id === id); return f ? f.name : 'Divers'; },

    validate(file) {
      if (!file) return 'Aucun fichier.';
      if (file.size > MAX_FILE) return '« ' + file.name + ' » dépasse 25 Mo.';
      if (file.type && !ACCEPT.test(file.type)) return 'Type non accepté pour « ' + file.name + ' ».';
      if (this.used() + file.size > this.quota()) return 'Quota de l’espace personnel atteint (' + U.bytes(this.quota()) + ').';
      return null;
    },
    /** Ajoute un fichier (File ou Blob) ; renvoie ses métadonnées */
    async add(file, opts) {
      if (!this.available) throw new Error('Stockage de fichiers indisponible dans ce navigateur.');
      const err = this.validate(file);
      if (err) throw new Error(err);
      const o = opts || {};
      const rec = {
        id: U.uid('file'),
        name: o.name || file.name || 'document',
        type: file.type || 'application/octet-stream',
        size: file.size,
        folder: o.folder || 'justificatifs',
        tags: o.tags || [],
        note: o.note || '',
        createdAt: o.createdAt || new Date().toISOString(),
        blob: file
      };
      await this.driver.put(rec);
      const { blob, ...meta } = rec;
      this.meta.push(meta);
      O.Store.emit('files');
      return meta;
    },
    async get(id) { return this.driver.get(id); },
    async patch(id, patch) {
      const m = await this.driver.patch(id, patch);
      const i = this.meta.findIndex((x) => x.id === id);
      if (i >= 0) this.meta[i] = m;
      O.Store.emit('files');
      return m;
    },
    async remove(id) {
      await this.driver.remove(id);
      this.meta = this.meta.filter((m) => m.id !== id);
      await O.Store.detachFile(id);
      O.Store.emit('files');
    },
    async clear() { if (this.available) await this.driver.clear(); this.meta = []; O.Store.emit('files'); },
    async objectURL(id) { const r = await this.get(id); return r && r.blob ? URL.createObjectURL(r.blob) : null; },
    /** Où ce fichier est-il utilisé ? */
    links(id) {
      const out = [];
      O.Store.all('transactions').forEach((t) => { if ((t.attachments || []).includes(id)) out.push({ entity: 'transactions', id: t.id, label: t.label }); });
      O.Store.all('invoices').forEach((i) => { if ((i.attachments || []).includes(id)) out.push({ entity: 'invoices', id: i.id, label: 'Facture ' + i.number }); });
      return out;
    },
    async estimate() {
      try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) { /* non supporté */ }
      return null;
    },
    async persisted() { try { return navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch (e) { return false; } },
    async persist() { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; } },
    kind(type, name) {
      if (/^image\//.test(type)) return 'image';
      if (type === 'application/pdf') return 'pdf';
      if (/^text\//.test(type) || /\.(txt|csv|md|json)$/i.test(name || '')) return 'text';
      return 'other';
    },
    ext(name) { const m = String(name).match(/\.([a-z0-9]{1,5})$/i); return m ? m[1].toUpperCase() : 'FICHIER'; }
  };

  O.Files = Files;
})(window.Ondea);
