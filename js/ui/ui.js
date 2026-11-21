/* ==========================================================================
   Ondea Finance — Composants d'interface : toasts, modales, confirmation,
   infobulles, micro-interactions, compteurs animés
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U;
  const UI = {};
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Toasts ---------- */
  UI.toast = (msg, type) => {
    const t = type || 'success';
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + t;
    el.setAttribute('role', t === 'error' ? 'alert' : 'status');
    el.innerHTML = O.icon({ success: 'checkCircle', error: 'alert', warn: 'alert', info: 'info' }[t] || 'info') + '<div>' + U.esc(msg) + '</div>';
    box.appendChild(el);
    const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
    setTimeout(kill, t === 'error' ? 6500 : 3800);
    el.addEventListener('click', kill);
  };
  UI.error = (e) => UI.toast((e && e.message) || String(e), 'error');

  /* ---------- Modales accessibles (piège à focus, Échap) ---------- */
  const stack = [];
  UI.modal = (opts) => {
    const root = document.getElementById('modalRoot');
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    const id = U.uid('mdl');
    back.innerHTML =
      '<div class="modal ' + (opts.size || '') + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '">' +
      '<div class="modal-head"><h2 id="' + id + '">' + U.esc(opts.title) + '</h2>' +
      '<button type="button" class="icon-btn" data-close aria-label="Fermer la fenêtre">' + O.icon('close') + '</button></div>' +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      (opts.foot !== false ? '<div class="modal-foot">' + (opts.foot || '<button type="button" class="btn" data-close>Fermer</button>') + '</div>' : '') +
      '</div>';
    const prevFocus = document.activeElement;
    root.appendChild(back);
    document.body.style.overflow = 'hidden';
    const dlg = back.querySelector('.modal');
    let closed = false;
    const api = {
      el: dlg,
      close(result) {
        if (closed) return; closed = true;
        back.classList.add('closing');
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        setTimeout(() => {
          back.remove();
          if (!stack.length) document.body.style.overflow = '';
          if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
          if (opts.onClose) opts.onClose(result);
        }, reduced() ? 0 : 170);
      }
    };
    stack.push(api);
    back.addEventListener('mousedown', (e) => { if (e.target === back && opts.dismissable !== false) api.close(); });
    back.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
    back.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); api.close(); }
      if (e.key === 'Tab') {
        const f = U.$$('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', dlg).filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    O.hydrateIcons(dlg);
    if (opts.onOpen) opts.onOpen(dlg, api);
    requestAnimationFrame(() => {
      const target = dlg.querySelector('[autofocus]') || dlg.querySelector('.modal-body input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), .modal-body select, .modal-body textarea') || dlg.querySelector('[data-close]');
      if (target) target.focus();
    });
    return api;
  };
  UI.confirm = (message, opts) => new Promise((resolve) => {
    const o = opts || {};
    let ok = false;
    const m = UI.modal({
      title: o.title || 'Confirmation',
      size: 'sm',
      body: '<p>' + U.esc(message) + '</p>' + (o.detail ? '<p class="muted small">' + U.esc(o.detail) + '</p>' : ''),
      foot: '<button type="button" class="btn" data-close>Annuler</button><button type="button" class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + U.esc(o.ok || 'Confirmer') + '</button>',
      onOpen(dlg, api) { const b = dlg.querySelector('[data-ok]'); b.addEventListener('click', () => { ok = true; api.close(); }); setTimeout(() => b.focus(), 30); },
      onClose() { resolve(ok); }
    });
    return m;
  });

  /* ---------- Infobulles des graphiques ---------- */
  UI.initTooltips = () => {
    const tip = document.getElementById('tooltip');
    const show = (el, x, y) => {
      tip.innerHTML = el.getAttribute('data-tip');
      tip.classList.add('show');
      const r = tip.getBoundingClientRect();
      let left = x + 14, top = y - r.height - 12;
      if (left + r.width > innerWidth - 8) left = x - r.width - 14;
      if (top < 8) top = y + 18;
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
    };
    document.addEventListener('mousemove', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el) show(el, e.clientX, e.clientY); else tip.classList.remove('show');
    });
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (el) { const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.top); }
    });
    document.addEventListener('focusout', () => tip.classList.remove('show'));
    document.addEventListener('scroll', () => tip.classList.remove('show'), true);
  };

  /* ---------- Effet d'onde sur les boutons ---------- */
  UI.initRipple = () => {
    document.addEventListener('pointerdown', (e) => {
      if (reduced()) return;
      const b = e.target.closest('.btn');
      if (!b || b.disabled) return;
      const r = b.getBoundingClientRect();
      const s = document.createElement('span');
      const size = Math.max(r.width, r.height);
      s.className = 'ripple';
      s.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (e.clientX - r.left - size / 2) + 'px;top:' + (e.clientY - r.top - size / 2) + 'px';
      if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
      b.style.overflow = 'hidden';
      b.appendChild(s);
      setTimeout(() => s.remove(), 600);
    });
  };

  /* ---------- Compteurs animés ---------- */
  UI.countUp = (root) => {
    U.$$('[data-count]', root).forEach((el) => {
      const target = Number(el.dataset.count) || 0;
      const fmt = el.dataset.fmt === 'int' ? (v) => String(Math.round(v)) : (v) => U.money(Math.round(v));
      if (reduced()) { el.textContent = fmt(target); return; }
      const dur = 900, t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * e);
        if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(target);
      };
      requestAnimationFrame(step);
    });
  };
  /** Anime les barres de progression (largeur depuis 0) */
  UI.animateBars = (root) => requestAnimationFrame(() => U.$$('[data-w]', root).forEach((el) => { el.style.width = el.dataset.w + '%'; }));

  UI.empty = (title, text, action) => '<div class="empty">' + O.icon('sparkle') + '<h3>' + U.esc(title) + '</h3><p>' + U.esc(text || '') + '</p>' + (action || '') + '</div>';
  UI.badgeType = (type) => type === 'recette' ? '<span class="badge b-inc">Recette</span>' : '<span class="badge b-exp">Dépense</span>';
  UI.badgeStatus = (s) => s === 'payee' ? '<span class="badge b-inc">Payée</span>' : '<span class="badge b-warn">En attente</span>';
  UI.amount = (t) => '<span class="num ' + (t.type === 'recette' ? 'amount-inc' : 'amount-exp') + '">' + (t.type === 'recette' ? '+' : '−') + U.money(t.amountTTC) + '</span>';
  UI.catChip = (id) => {
    const c = O.Store.get('categories', id);
    if (!c) return '<span class="muted">—</span>';
    return '<span class="flex" style="gap:.45rem;flex-wrap:nowrap"><span class="dot" style="background:' + U.esc(c.color) + '"></span>' + U.esc(c.name) + '</span>';
  };
  UI.setBusy = (btn, busy) => { if (!btn) return; btn.disabled = busy; btn.setAttribute('aria-busy', busy ? 'true' : 'false'); };

  O.UI = UI;
})(window.Ondea);
