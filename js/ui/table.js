/* ==========================================================================
   Ondea Finance — Tableau de données interactif
   Tri accessible (aria-sort), pagination, sélection multiple, pied de totaux,
   rendu en cartes sur mobile.
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U;

  class DataTable {
    constructor(opts) {
      this.o = Object.assign({ pageSize: 15, selectable: false, caption: '' }, opts);
      this.sort = this.o.sort || { key: null, dir: 'desc' };
      this.page = 1;
      this.selected = new Set();
      this.rows = [];
      this.el = null;
    }
    setRows(rows) {
      this.rows = rows;
      const ids = new Set(rows.map((r) => r.id));
      this.selected.forEach((id) => { if (!ids.has(id)) this.selected.delete(id); });
      return this;
    }
    sorted() {
      const col = this.o.columns.find((c) => c.key === this.sort.key);
      if (!col) return this.rows.slice();
      const get = col.sortValue || ((r) => r[col.key]);
      const dir = this.sort.dir === 'asc' ? 1 : -1;
      return this.rows.slice().sort((a, b) => {
        const x = get(a), y = get(b);
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
        return String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), 'fr', { numeric: true }) * dir;
      });
    }
    mount(el) {
      this.el = el;
      el.addEventListener('click', (e) => {
        const sb = e.target.closest('[data-sort]');
        if (sb && el.contains(sb)) {
          const k = sb.dataset.sort;
          this.sort = { key: k, dir: this.sort.key === k && this.sort.dir === 'desc' ? 'asc' : 'desc' };
          this.page = 1; this.render();
          const again = el.querySelector('[data-sort="' + k + '"]'); if (again) again.focus();
          return;
        }
        const pg = e.target.closest('[data-page]');
        if (pg && el.contains(pg)) { this.page = Number(pg.dataset.page); this.render(); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      });
      el.addEventListener('change', (e) => {
        if (e.target.matches('[data-selall]')) {
          this.pageRows().forEach((r) => e.target.checked ? this.selected.add(r.id) : this.selected.delete(r.id));
          this.render(); this.changed();
        } else if (e.target.matches('[data-sel]')) {
          e.target.checked ? this.selected.add(e.target.dataset.sel) : this.selected.delete(e.target.dataset.sel);
          const tr = e.target.closest('tr'); if (tr) tr.classList.toggle('selected', e.target.checked);
          const all = el.querySelector('[data-selall]');
          if (all) { const pr = this.pageRows(); all.checked = pr.length > 0 && pr.every((r) => this.selected.has(r.id)); }
          this.changed();
        } else if (e.target.matches('[data-pagesize]')) {
          this.o.pageSize = Number(e.target.value); this.page = 1; this.render();
        }
      });
      return this;
    }
    changed() { if (this.o.onSelect) this.o.onSelect(Array.from(this.selected)); }
    clearSelection() { this.selected.clear(); this.changed(); }
    pageRows() {
      const s = this.sorted(), ps = this.o.pageSize;
      const pages = Math.max(1, Math.ceil(s.length / ps));
      this.page = U.clamp(this.page, 1, pages);
      return s.slice((this.page - 1) * ps, this.page * ps);
    }
    render() {
      if (!this.el) return;
      const o = this.o, total = this.rows.length;
      if (!total) { this.el.innerHTML = o.empty || O.UI.empty('Aucun élément', 'Modifiez vos filtres ou ajoutez un élément.'); return; }
      const rows = this.pageRows();
      const pages = Math.max(1, Math.ceil(total / o.pageSize));
      const allSel = rows.length > 0 && rows.every((r) => this.selected.has(r.id));
      let h = '<div class="table-wrap"><table class="data responsive">' + (o.caption ? '<caption class="sr-only">' + U.esc(o.caption) + '</caption>' : '') + '<thead><tr>';
      if (o.selectable) h += '<th scope="col" class="c" style="width:44px"><input type="checkbox" class="check" data-selall aria-label="Tout sélectionner sur cette page"' + (allSel ? ' checked' : '') + '></th>';
      o.columns.forEach((c) => {
        const sortable = c.sortable !== false && c.key && !c.actions;
        const aria = sortable ? ' aria-sort="' + (this.sort.key === c.key ? (this.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') + '"' : '';
        h += '<th scope="col" class="' + (c.cls || '') + '"' + aria + '>' + (sortable ? '<button type="button" data-sort="' + c.key + '">' + U.esc(c.label) + '</button>' : (c.label ? U.esc(c.label) : '<span class="sr-only">Actions</span>')) + '</th>';
      });
      h += '</tr></thead><tbody>';
      rows.forEach((r) => {
        const sel = this.selected.has(r.id);
        h += '<tr data-row="' + U.esc(r.id) + '"' + (sel ? ' class="selected"' : '') + '>';
        if (o.selectable) h += '<td class="c sel-cell"><input type="checkbox" class="check" data-sel="' + U.esc(r.id) + '" aria-label="Sélectionner la ligne"' + (sel ? ' checked' : '') + '></td>';
        o.columns.forEach((c) => {
          h += '<td class="' + (c.cls || '') + (c.actions ? ' actions' : '') + '" data-label="' + U.esc(c.label || '') + '">' + (c.render ? c.render(r) : U.esc(r[c.key])) + '</td>';
        });
        h += '</tr>';
      });
      h += '</tbody>';
      if (o.footer) h += '<tfoot>' + o.footer(this.rows) + '</tfoot>';
      h += '</table></div>';
      const from = (this.page - 1) * o.pageSize + 1, to = Math.min(total, this.page * o.pageSize);
      h += '<div class="pager"><span>' + from + '–' + to + ' sur ' + total + '</span><div class="btns">' +
        '<label class="sr-only" for="ps-' + this._id() + '">Lignes par page</label><select class="input" style="width:auto;min-height:34px" id="ps-' + this._id() + '" data-pagesize>' + [10, 15, 25, 50, 100].map((n) => '<option' + (n === o.pageSize ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
        '<button type="button" class="icon-btn sm" data-page="' + (this.page - 1) + '" aria-label="Page précédente"' + (this.page <= 1 ? ' disabled' : '') + '>' + O.icon('chevronLeft') + '</button>' +
        '<span class="mono" aria-live="polite">' + this.page + ' / ' + pages + '</span>' +
        '<button type="button" class="icon-btn sm" data-page="' + (this.page + 1) + '" aria-label="Page suivante"' + (this.page >= pages ? ' disabled' : '') + '>' + O.icon('chevronRight') + '</button></div></div>';
      this.el.innerHTML = h;
    }
    _id() { if (!this.__id) this.__id = U.uid('t'); return this.__id; }
  }

  O.DataTable = DataTable;
})(window.Ondea);
