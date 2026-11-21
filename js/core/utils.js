/* ==========================================================================
   Ondea Finance — Utilitaires (formatage, dates, montants en centimes)
   Tous les montants sont stockés en CENTIMES entiers pour des calculs exacts.
   ========================================================================== */
(function (O) {
  'use strict';
  const cfg = O.config;
  const U = {};

  const moneyFmt = new Intl.NumberFormat(cfg.locale, { style: 'currency', currency: cfg.currency });
  const numFmt = new Intl.NumberFormat(cfg.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pctFmt = new Intl.NumberFormat(cfg.locale, { maximumFractionDigits: 1 });
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MONTHS_FULL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  U.MONTHS = MONTHS;
  U.MONTHS_FULL = MONTHS_FULL;
  U.uid = (p) => (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---- Montants ---- */
  U.money = (cents) => moneyFmt.format((Number(cents) || 0) / 100).replace(/ /g, ' ');
  U.moneySigned = (cents) => (cents > 0 ? '+' : '') + U.money(cents);
  U.num = (cents) => numFmt.format((Number(cents) || 0) / 100);
  U.moneyShort = (cents) => {
    const v = (cents || 0) / 100, a = Math.abs(v);
    if (a >= 1e6) return pctFmt.format(v / 1e6) + ' M€';
    if (a >= 1e3) return pctFmt.format(v / 1e3) + ' k€';
    return Math.round(v) + ' €';
  };
  U.pct = (v) => pctFmt.format(v) + ' %';
  /** Convertit une saisie (« 1 234,56 », « 1234.5 ») en centimes. Renvoie NaN si invalide. */
  U.toCents = (str) => {
    if (typeof str === 'number') return Math.round(str * 100);
    const s = String(str || '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!/^-?\d+(\.\d{0,2})?$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * 100);
  };
  U.centsToInput = (c) => (c == null || c === '' ? '' : ((Number(c) || 0) / 100).toFixed(2).replace('.', ','));
  /** TVA arrondie au centime (règle de l'arrondi commercial). rate en % (20, 10, 5.5…) */
  U.vat = (htCents, rate) => Math.round((htCents * (Number(rate) || 0)) / 100);
  U.ttc = (htCents, rate) => htCents + U.vat(htCents, rate);
  U.sum = (arr, fn) => arr.reduce((s, x) => s + (fn ? fn(x) : x), 0);

  /* ---- Dates (ISO AAAA-MM-JJ, heure locale) ---- */
  const pad = (n) => String(n).padStart(2, '0');
  U.iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  U.today = () => U.iso(new Date());
  U.parse = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  U.validDate = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') && !isNaN(U.parse(iso)) && U.iso(U.parse(iso)) === iso;
  U.fmtDate = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; };
  U.fmtDateLong = (iso) => { if (!iso) return '—'; const d = U.parse(iso); return d.getDate() + ' ' + MONTHS_FULL[d.getMonth()] + ' ' + d.getFullYear(); };
  U.addDays = (iso, n) => { const d = U.parse(iso); d.setDate(d.getDate() + n); return U.iso(d); };
  U.addMonths = (iso, n) => {
    const d = U.parse(iso), day = d.getDate();
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(day, last));
    return U.iso(t);
  };
  U.diffDays = (a, b) => Math.round((U.parse(b) - U.parse(a)) / 86400000);
  U.monthKey = (iso) => String(iso).slice(0, 7);
  U.monthStart = (key) => key + '-01';
  U.monthEnd = (key) => { const [y, m] = key.split('-').map(Number); return U.iso(new Date(y, m, 0)); };
  U.monthLabel = (key, full) => { const [y, m] = key.split('-').map(Number); return (full ? MONTHS_FULL : MONTHS)[m - 1] + ' ' + y; };
  U.lastMonths = (n, fromKey) => {
    const base = U.parse((fromKey || U.monthKey(U.today())) + '-01');
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(U.monthKey(U.iso(new Date(base.getFullYear(), base.getMonth() - i, 1))));
    return out;
  };
  U.relDays = (iso) => {
    const d = U.diffDays(U.today(), iso);
    if (d === 0) return "aujourd'hui";
    if (d === 1) return 'demain';
    if (d === -1) return 'hier';
    return d > 0 ? 'dans ' + d + ' j' : 'il y a ' + -d + ' j';
  };

  /* ---- Divers ---- */
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 200); }; };
  U.bytes = (n) => {
    if (!n) return '0 o';
    const u = ['o', 'Ko', 'Mo', 'Go']; let i = 0; let v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return pctFmt.format(v) + ' ' + u[i];
  };
  U.initials = (name) => String(name || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  U.norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  /** Téléchargement : capacité « downloads » si la page est hébergée dans Claude, sinon lien classique */
  U.download = async (blob, name) => {
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        const dl = await window.claude.use('downloads');
        if (dl) {
          try { await dl.save({ filename: name, data: blob }); }
          catch (e) { if (e && e.code !== 'declined' && O.UI) O.UI.toast('Téléchargement indisponible ici (' + (e.code || 'erreur') + ').', 'warn'); }
          return;
        }
      }
    } catch (e) { /* repli sur le lien classique */ }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  /** CSV compatible Excel FR : séparateur « ; », BOM UTF-8 */
  U.csv = (rows) => {
    const cell = (v) => { const s = String(v == null ? '' : v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return new Blob(['﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  };
  U.hashColor = (str) => {
    const pal = ['#B8901F', '#2F8F83', '#C2573D', '#5468C4', '#A1559A', '#5E8F2E', '#B9731F', '#2F7FBF', '#8E5A66', '#4C7A6D'];
    let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return pal[h % pal.length];
  };
  U.fileToDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  U.dataURLToBlob = (url) => {
    const [head, b64] = url.split(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  O.U = U;
})(window.Ondea);
