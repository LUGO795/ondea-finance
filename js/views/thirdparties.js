/* ==========================================================================
   Vue — Tiers : fournisseurs & clients
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, F = O.F, UI = O.UI, Fm = O.Forms;
  O.Views = O.Views || {};
  const st = { kind: 'fournisseur', q: '' };
  let table = null;

  function stats(tp) {
    const from = U.addDays(U.today(), -365);
    const ops = S.all('transactions').filter((t) => t.thirdPartyId === tp.id);
    const y = ops.filter((t) => t.date >= from);
    const open = S.all('invoices').filter((i) => i.thirdPartyId === tp.id && i.status === 'emise');
    return { count: ops.length, volume: U.sum(y, (t) => t.amountHT), open: U.sum(open, (i) => i.amountTTC), openN: open.length, last: ops.reduce((m, t) => (t.date > m ? t.date : m), '') };
  }

  function openForm(tp) {
    const isEdit = !!(tp && tp.id);
    const x = tp || { kind: st.kind, paymentTerms: 30 };
    UI.modal({
      title: isEdit ? 'Modifier ' + x.name : 'Nouveau tiers', size: 'lg', body: '<form novalidate id="tpForm"><div class="form-grid">' +
        '<fieldset class="field full" style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:.35rem">Type de tiers</legend><div class="segmented"><label class="exp"><input type="radio" name="kind" value="fournisseur"' + (x.kind !== 'client' ? ' checked' : '') + '><span>Fournisseur</span></label><label class="inc"><input type="radio" name="kind" value="client"' + (x.kind === 'client' ? ' checked' : '') + '><span>Client</span></label></div></fieldset>' +
        Fm.input({ name: 'name', label: 'Raison sociale', value: x.name, required: true, attrs: ' maxlength="80"' }) +
        Fm.input({ name: 'siret', label: 'SIRET', value: x.siret, attrs: ' inputmode="numeric" maxlength="17"', hint: '14 chiffres' }) +
        Fm.input({ name: 'email', label: 'E-mail', type: 'email', value: x.email, attrs: ' maxlength="120" autocomplete="off"' }) +
        Fm.input({ name: 'phone', label: 'Téléphone', type: 'tel', value: x.phone, attrs: ' maxlength="25"' }) +
        Fm.input({ name: 'address', label: 'Adresse', value: x.address, full: true, attrs: ' maxlength="160"' }) +
        Fm.input({ name: 'city', label: 'Ville', value: x.city, attrs: ' maxlength="60"' }) +
        Fm.input({ name: 'paymentTerms', label: 'Délai de paiement', value: x.paymentTerms, affix: 'j', attrs: ' inputmode="numeric"', hint: "Sert au calcul automatique des échéances." }) +
        Fm.textarea({ name: 'notes', label: 'Notes', value: x.notes, max: 500 }) + '</div></form>',
      foot: '<button type="button" class="btn" data-close>Annuler</button><button type="submit" form="tpForm" class="btn btn-primary">' + O.icon('check') + 'Enregistrer</button>',
      onOpen(dlg, api) {
        const form = dlg.querySelector('#tpForm'); Fm.liveClear(form);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const R = Fm.R;
          const unique = (v) => (S.all('thirdParties').some((t) => t.id !== x.id && U.norm(t.name) === U.norm(v)) ? 'Un tiers porte déjà ce nom.' : null);
          const days = (v) => (/^\d{1,3}$/.test(String(v)) && Number(v) <= 120 ? null : 'Entre 0 et 120 jours.');
          if (!Fm.validate(form, { name: [R.required, R.max(80), unique], siret: [R.siret], email: [R.email], paymentTerms: [R.required, days] })) return;
          const v = Fm.values(form);
          const rec = { kind: v.kind, name: v.name, siret: v.siret, email: v.email, phone: v.phone, address: v.address, city: v.city, paymentTerms: Number(v.paymentTerms), notes: v.notes };
          try { isEdit ? await S.update('thirdParties', x.id, rec) : await S.create('thirdParties', rec); UI.toast('Tiers enregistré.'); api.close(); } catch (err) { UI.error(err); }
        });
      }
    });
  }

  function detail(tp) {
    const s = stats(tp);
    const ops = S.all('transactions').filter((t) => t.thirdPartyId === tp.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    const invs = S.all('invoices').filter((i) => i.thirdPartyId === tp.id).sort((a, b) => b.issueDate.localeCompare(a.issueDate)).slice(0, 8);
    UI.modal({
      title: tp.name, size: 'lg',
      body: '<div class="grid grid-2"><dl class="kv"><dt>Type</dt><dd>' + (tp.kind === 'client' ? 'Client' : 'Fournisseur') + '</dd><dt>SIRET</dt><dd class="mono">' + U.esc(tp.siret || '—') + '</dd><dt>E-mail</dt><dd>' + (tp.email ? '<a href="mailto:' + U.esc(tp.email) + '">' + U.esc(tp.email) + '</a>' : '—') + '</dd><dt>Téléphone</dt><dd>' + U.esc(tp.phone || '—') + '</dd><dt>Adresse</dt><dd>' + U.esc(tp.address || '—') + '</dd><dt>Délai</dt><dd>' + (tp.paymentTerms || 0) + ' jours</dd></dl>' +
        '<div><div class="stat-row"><span class="muted">Volume HT (12 mois)</span><strong class="num">' + U.money(s.volume) + '</strong></div><div class="stat-row"><span class="muted">Opérations</span><strong>' + s.count + '</strong></div><div class="stat-row"><span class="muted">Factures ouvertes</span><strong class="num">' + U.money(s.open) + ' (' + s.openN + ')</strong></div><div class="stat-row"><span class="muted">Dernier mouvement</span><strong>' + U.fmtDate(s.last) + '</strong></div></div></div>' +
        '<h3 class="mt">Dernières opérations</h3>' + (ops.length ? '<ul class="list">' + ops.map((t) => '<li><span class="num muted">' + U.fmtDate(t.date) + '</span><span class="grow title">' + U.esc(t.label) + '</span>' + UI.amount(t) + '</li>').join('') + '</ul>' : '<p class="muted">Aucune opération.</p>') +
        '<h3 class="mt">Factures</h3>' + (invs.length ? '<ul class="list">' + invs.map((i) => { const z = F.invoiceState(i); return '<li><span class="mono">' + U.esc(i.number) + '</span><span class="grow title">' + U.esc(i.label) + '</span><span class="badge ' + z.cls + '">' + z.label + '</span><span class="num">' + U.money(i.amountTTC) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">Aucune facture.</p>'),
      foot: '<button type="button" class="btn" data-close>Fermer</button><button type="button" class="btn" data-ops>' + O.icon('swap') + 'Voir toutes les opérations</button><button type="button" class="btn btn-primary" data-edit>' + O.icon('edit') + 'Modifier</button>',
      onOpen(dlg, api) {
        dlg.querySelector('[data-edit]').addEventListener('click', () => { api.close(); setTimeout(() => openForm(tp), 200); });
        dlg.querySelector('[data-ops]').addEventListener('click', () => { api.close(); O.Views.operations.filterBy({ thirdPartyId: tp.id }); location.hash = '#operations'; });
      }
    });
  }

  O.Views.thirdparties = {
    title: 'Tiers',
    render(root) {
      const all = S.all('thirdParties');
      const rows = all.filter((t) => (st.kind === 'tous' || t.kind === st.kind) && (!st.q || U.norm(t.name + ' ' + (t.city || '') + ' ' + (t.email || '') + ' ' + (t.siret || '')).includes(U.norm(st.q)))).map((t) => Object.assign({}, t, { _s: stats(t) }));
      const nC = all.filter((t) => t.kind === 'client').length, nF = all.length - nC;
      const top = F.byThirdParty(st.kind === 'client' ? 'recette' : 'depense', U.addDays(U.today(), -365)).slice(0, 6);
      root.innerHTML = '<div class="view">' +
        '<div class="page-head"><div><div class="eyebrow">Relations</div><h1>Fournisseurs & clients</h1><p>Fiches tiers, volumes d’affaires et encours.</p></div><div class="page-actions"><button class="btn btn-primary" data-act="new">' + O.icon('plus') + 'Nouveau tiers</button></div></div>' +
        '<div class="tabs mb" role="tablist" aria-label="Type de tiers">' + [['fournisseur', 'Fournisseurs (' + nF + ')'], ['client', 'Clients (' + nC + ')'], ['tous', 'Tous (' + all.length + ')']].map(([k, l]) => '<button type="button" role="tab" aria-selected="' + (st.kind === k) + '" data-kind="' + k + '">' + l + '</button>').join('') + '</div>' +
        '<div class="grid grid-main">' +
        '<section class="card flush"><div class="toolbar"><label class="sr-only" for="tpQ">Rechercher un tiers</label><input id="tpQ" class="input grow" type="search" placeholder="Nom, ville, e-mail, SIRET…" value="' + U.esc(st.q) + '"></div><div data-table></div></section>' +
        '<section class="card"><div class="card-head"><h2>' + (st.kind === 'client' ? 'Meilleurs clients' : 'Principaux fournisseurs') + '</h2><span class="card-sub">12 mois, HT</span></div>' + (top.length ? O.Charts.hbars(top, st.kind === 'client' ? 'var(--inc)' : 'var(--exp)') : UI.empty('Pas encore de données', '')) + '</section>' +
        '</div></div>';
      table = table || new O.DataTable({
        caption: 'Liste des tiers', pageSize: 15, sort: { key: 'name', dir: 'asc' },
        columns: [
          { key: 'name', label: 'Tiers', render: (t) => '<button type="button" class="cell-flex" data-open="' + t.id + '" style="all:unset;cursor:pointer;display:flex;gap:.65rem;align-items:center"><span class="avatar" style="background:' + U.hashColor(t.name) + '" aria-hidden="true">' + U.esc(U.initials(t.name)) + '</span><span><span class="cell-main" style="display:block">' + U.esc(t.name) + '</span><span class="cell-sub">' + U.esc(t.city || '') + (t.kind === 'client' ? ' · Client' : ' · Fournisseur') + '</span></span></button>' },
          { key: 'email', label: 'Contact', render: (t) => '<div class="small">' + U.esc(t.email || '—') + '</div><div class="cell-sub">' + U.esc(t.phone || '') + '</div>' },
          { key: 'volume', label: 'Volume 12 m', cls: 'r', sortValue: (t) => t._s.volume, render: (t) => '<span class="num">' + U.money(t._s.volume) + '</span>' },
          { key: 'open', label: 'Encours', cls: 'r', sortValue: (t) => t._s.open, render: (t) => t._s.open ? '<span class="num" style="color:var(--warn);font-weight:700">' + U.money(t._s.open) + '</span>' : '<span class="muted">—</span>' },
          { key: '', label: '', actions: true, render: (t) => '<button class="icon-btn sm" data-open="' + t.id + '" aria-label="Fiche de ' + U.esc(t.name) + '">' + O.icon('eye') + '</button><button class="icon-btn sm" data-edit="' + t.id + '" aria-label="Modifier ' + U.esc(t.name) + '">' + O.icon('edit') + '</button><button class="icon-btn sm danger" data-del="' + t.id + '" aria-label="Supprimer ' + U.esc(t.name) + '">' + O.icon('trash') + '</button>' }
        ]
      });
      table.setRows(rows).mount(root.querySelector('[data-table]')).render();
      UI.animateBars(root);
      root.querySelector('#tpQ').addEventListener('input', U.debounce((e) => { st.q = e.target.value; const id = 'tpQ'; O.App.refresh(); const el = document.getElementById(id); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 250));
      root.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.kind) { st.kind = b.dataset.kind; table.page = 1; O.App.refresh(); }
        else if (b.dataset.act === 'new') openForm();
        else if (b.dataset.open) detail(S.get('thirdParties', b.dataset.open));
        else if (b.dataset.edit) openForm(S.get('thirdParties', b.dataset.edit));
        else if (b.dataset.del) { const t = S.get('thirdParties', b.dataset.del); if (await UI.confirm('Supprimer « ' + t.name + ' » ?', { danger: true, ok: 'Supprimer' })) { try { await S.remove('thirdParties', t.id); UI.toast('Tiers supprimé.'); } catch (err) { UI.error(err); } } }
      });
    }
  };
})(window.Ondea);
