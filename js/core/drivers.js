/* ==========================================================================
   Ondea Finance — Pilotes de persistance (couche d'accès aux données)
   --------------------------------------------------------------------------
   Contrat commun (asynchrone, basé sur des Promesses) :
     list(entity)                → Array
     create(entity, record)      → record
     update(entity, id, record)  → record
     remove(entity, id)          → true
     getSettings() / saveSettings(obj)
     replaceAll(dataset)         → restauration complète
     clearAll()
   Pilotes de fichiers :
     list() / get(id) / put(record) / patch(id, patch) / remove(id) / clear()
   Remplacer LocalStorage par PHP/MySQL = changer de pilote dans config.js.
   ========================================================================== */
(function (O) {
  'use strict';
  const cfg = O.config;

  O.ENTITIES = ['accounts', 'categories', 'thirdParties', 'paymentMethods', 'transactions', 'invoices', 'schedules', 'budgets', 'transfers'];

  /* ---------------- Pilote LocalStorage (autonome) ---------------- */
  class LocalStorageDriver {
    constructor(prefix) { this.prefix = prefix; this.name = 'LocalStorage'; }
    key(e) { return this.prefix + e; }
    read(e, fallback) {
      try { const raw = localStorage.getItem(this.key(e)); return raw ? JSON.parse(raw) : fallback; }
      catch (err) { return fallback; }
    }
    write(e, value) {
      try { localStorage.setItem(this.key(e), JSON.stringify(value)); }
      catch (err) {
        const e2 = new Error("Espace LocalStorage saturé : exportez une sauvegarde puis supprimez d'anciennes données.");
        e2.cause = err; throw e2;
      }
    }
    async list(e) { return this.read(e, []); }
    async create(e, rec) { const rows = this.read(e, []); rows.push(rec); this.write(e, rows); return rec; }
    async update(e, id, rec) {
      const rows = this.read(e, []); const i = rows.findIndex((r) => r.id === id);
      if (i < 0) throw new Error('Élément introuvable');
      rows[i] = rec; this.write(e, rows); return rec;
    }
    async remove(e, id) { this.write(e, this.read(e, []).filter((r) => r.id !== id)); return true; }
    async getSettings() { return this.read('settings', {}); }
    async saveSettings(s) { this.write('settings', s); return s; }
    async isInitialized() { return this.read('meta', null) !== null; }
    async markInitialized() { this.write('meta', { initializedAt: new Date().toISOString(), schema: 1 }); }
    async replaceAll(data) { O.ENTITIES.forEach((e) => this.write(e, Array.isArray(data[e]) ? data[e] : [])); }
    async clearAll() {
      Object.keys(localStorage).filter((k) => k.startsWith(this.prefix)).forEach((k) => localStorage.removeItem(k));
    }
    /** Octets utilisés par l'application dans LocalStorage (UTF-16 ≈ 2 o / caractère) */
    usage() {
      let n = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.prefix)) n += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
      return n;
    }
  }

  /* ---------------- Pilote API REST (PHP 8 / MySQL / PDO) ---------------- */
  class ApiDriver {
    constructor(base) { this.base = base; this.name = 'API PHP/MySQL'; }
    async req(method, params, body) {
      const url = this.base + '?' + new URLSearchParams(params).toString();
      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erreur serveur (' + res.status + ')');
      return json.data;
    }
    list(e) { return this.req('GET', { entity: e }); }
    create(e, rec) { return this.req('POST', { entity: e }, rec); }
    update(e, id, rec) { return this.req('PUT', { entity: e, id }, rec); }
    remove(e, id) { return this.req('DELETE', { entity: e, id }); }
    getSettings() { return this.req('GET', { entity: 'settings' }); }
    saveSettings(s) { return this.req('PUT', { entity: 'settings' }, s); }
    async isInitialized() { const r = await this.req('GET', { entity: 'meta' }); return !!(r && r.initialized); }
    markInitialized() { return this.req('POST', { entity: 'meta' }, { initialized: true }); }
    replaceAll(data) { return this.req('POST', { action: 'restore' }, data); }
    clearAll() { return this.req('POST', { action: 'clear' }, {}); }
    usage() { return 0; }
  }

  /* ---------------- Pilote de fichiers IndexedDB ---------------- */
  class IndexedDBFileDriver {
    constructor(name) { this.dbName = name; this.db = null; this.name = 'IndexedDB'; }
    open() {
      return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) { reject(new Error('IndexedDB indisponible')); return; }
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('files')) {
            const st = db.createObjectStore('files', { keyPath: 'id' });
            st.createIndex('folder', 'folder', { unique: false });
          }
        };
        req.onsuccess = () => { this.db = req.result; resolve(); };
        req.onerror = () => reject(req.error || new Error('Ouverture IndexedDB impossible'));
        req.onblocked = () => reject(new Error('IndexedDB bloquée par un autre onglet'));
      });
    }
    tx(mode, fn) {
      return new Promise((resolve, reject) => {
        const t = this.db.transaction('files', mode);
        const st = t.objectStore('files');
        let result;
        const r = fn(st);
        if (r) r.onsuccess = () => { result = r.result; };
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error('Transaction annulée (quota atteint ?)'));
      });
    }
    /** Liste des métadonnées (sans les binaires) via un curseur */
    list() {
      return new Promise((resolve, reject) => {
        const out = [];
        const t = this.db.transaction('files', 'readonly');
        const req = t.objectStore('files').openCursor();
        req.onsuccess = () => {
          const c = req.result;
          if (c) { const { blob, ...meta } = c.value; out.push(meta); c.continue(); }
        };
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
      });
    }
    get(id) { return this.tx('readonly', (st) => st.get(id)); }
    put(rec) { return this.tx('readwrite', (st) => st.put(rec)); }
    async patch(id, patch) { const r = await this.get(id); if (!r) throw new Error('Fichier introuvable'); Object.assign(r, patch); await this.put(r); const { blob, ...m } = r; return m; }
    remove(id) { return this.tx('readwrite', (st) => st.delete(id)); }
    clear() { return this.tx('readwrite', (st) => st.clear()); }
  }

  /* ---------------- Pilote de fichiers API (upload multipart) ---------------- */
  class ApiFileDriver {
    constructor(base) { this.base = base; this.name = 'API fichiers'; }
    async open() { /* rien à ouvrir côté client */ }
    async call(method, params, body, isForm) {
      const res = await fetch(this.base + '?' + new URLSearchParams(Object.assign({ entity: 'files' }, params)), {
        method, credentials: 'same-origin',
        headers: isForm ? undefined : (body ? { 'Content-Type': 'application/json' } : undefined),
        body: isForm ? body : (body ? JSON.stringify(body) : undefined)
      });
      if (params.raw) return res.blob();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erreur serveur');
      return json.data;
    }
    list() { return this.call('GET', {}); }
    async get(id) { const meta = await this.call('GET', { id }); meta.blob = await this.call('GET', { id, raw: 1 }); return meta; }
    put(rec) { const fd = new FormData(); const { blob, ...meta } = rec; fd.append('meta', JSON.stringify(meta)); fd.append('file', blob, rec.name); return this.call('POST', {}, fd, true); }
    patch(id, patch) { return this.call('PUT', { id }, patch); }
    remove(id) { return this.call('DELETE', { id }); }
    clear() { return this.call('POST', { action: 'clear-files' }, {}); }
  }

  O.Drivers = { LocalStorageDriver, ApiDriver, IndexedDBFileDriver, ApiFileDriver };
  O.createDrivers = () => cfg.driver === 'api'
    ? { data: new ApiDriver(cfg.apiBase), files: new ApiFileDriver(cfg.apiBase) }
    : { data: new LocalStorageDriver(cfg.storagePrefix), files: new IndexedDBFileDriver(cfg.idbName) };
})(window.Ondea);
