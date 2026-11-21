/* ==========================================================================
   Vue — Référentiels : catégories budgétaires & moyens de paiement
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, S = O.Store, F = O.F, UI = O.UI, Fm = O.Forms;
  O.Views = O.Views || {};
  const st = { tab: 'categories' };
  const KINDS = { virement: 'Virement', carte: 'Carte bancaire', prelevement: 'Prélèvement', cheque: 'Chèque', especes: 'Espèces', autre: 'Autre' };

  function catForm(c) {
    const isEdit = !!(c && c.id);
    const x = c || { type: 'depense', color: '#2F8F83', icon: '📁' };
    UI.modal({
      title: isEdit ? 'Modifier la catégorie' : 'Nouvelle catégorie', body: '<form novalidate id="catForm"><div class="form-grid">' +
        Fm.typeSwitch('type', x.type, 'Nature') +
        Fm.input({ name: 'name', label: 'Nom', value: x.name, required: true, attrs: ' maxlength="60"' }) +
        Fm.input({ name: 'icon', label: 'Pictogramme (émoji)', value: x.icon, attrs: ' maxlength="4"' }) +
        '<div class="field"><label for="catColor">Couleur</label><input type="color" id="catColor" name="color" class="color-input" value="' + U.esc(x.color) + '"></div>' +
        Fm.check({ name: 'neutral', label: 'Hors résultat (TVA reversée, emprunt, apport en capital…) — impacte uniquement la trésorerie', checked: !!x.neutral, full: true }) +
        '</div></form>',
      foot: '<button type="button" class="btn" data-close>Annuler</button><button type="submit" form="catForm" class="btn btn-primary">' + O.icon('check') + 'Enregistrer</button>',
      onOpen(dlg, api) {
        const form = dlg.querySelector('#catForm'); Fm.liveClear(form);
        if (isEdit && S.all('transactions').some((t) => t.categoryId === x.id)) U.$$('[name="type"]', form).forEach((r) => { r.disabled = true; });
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const unique = (v, all) => (S.all('categories').some((k) => k.id !== x.id && k.type === (all.type || x.type) && U.norm(k.name) === U.norm(v)) ? 'Cette catégorie existe déjà.' : null);
          if (!Fm.validate(form, { name: [Fm.R.required, Fm.R.max(60), unique] })) return;
          const v = Fm.values(form);
          try { const rec = { name: v.name, type: v.type || x.type, icon: v.icon, color: v.color, neutral: !!v.neutral }; isEdit ? await S.update('categories', x.id, rec) : await S.create('categories', rec); UI.toast('Catégorie enregistrée.'); api.close(); } catch (err) { UI.error(err); }
        });
      }
    });
  }
  function pmForm(p) {
    const isEdit = !!(p && p.id);
    const x = p || { kind: 'virement', accountId: (S.all('accounts')[0] || {}).id };
    UI.modal({
      title: isEdit ? 'Modifier le moyen de paiement' : 'Nouveau moyen de paiement', body: '<form novalidate id="pmForm"><div class="form-grid">' +
        Fm.input({ name: 'name', label: 'Nom', value: x.name, required: true, attrs: ' maxlength="60"', full: true }) +
        Fm.select({ name: 'kind', label: 'Type', value: x.kind, options: Object.keys(KINDS).map((k) => ({ value: k, label: KINDS[k] })) }) +
        Fm.select({ name: 'accountId', label: 'Compte associé par défaut', value: x.accountId, placeholder: 'Aucun', options: Fm.optAccounts() }) +
        '</div></form>',
      foot: '<button type="button" class="btn" data-close>Annuler</button><button type="submit" form="pmForm" class="btn btn-primary">' + O.icon('check') + 'Enregistrer</button>',
      onOpen(dlg, api) {
        const form = dlg.querySelector('#pmForm'); Fm.liveClear(form);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!Fm.validate(form, { name: [Fm.R.required, Fm.R.max(60)] })) return;
          const v = Fm.values(form);
          try { const rec = { name: v.name, kind: v.kind, accountId: v.accountId || null }; isEdit ? await S.update('paymentMethods', x.id, rec) : await S.create('paymentMethods', rec); UI.toast('Moyen de paiement enregistré.'); api.close(); } catch (err) { UI.error(err); }
        });
      }
    });
  }

  O.Views.referentials = {
    title: 'Référentiels',
    render(root) {
      const from = U.addDays(U.today(), -365);
      let content = '';
      if (st.tab === 'categories') {
        ['depense', 'recette'].forEach((type) => {
          const cats = S.all('categories').filter((c) => c.type === type).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
          content += '<section class="card flush mb"><div class="card-head" style="padding-bottom:1rem"><h2>' + (type === 'depense' ? 'Catégories de dépenses' : 'Catégories de recettes') + '</h2><span class="badge plain ' + (type === 'depense' ? 'b-exp' : 'b-inc') + '">' + cats.length + '</span></div><div class="table-wrap"><table class="data responsive"><caption class="sr-only">' + (type === 'depense' ? 'Catégories de dépenses' : 'Catégories de recettes') + '</caption><thead><tr><th scope="col">Catégorie</th><th scope="col" class="r">Opérations</th><th scope="col" class="r">Total HT 12 mois</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
            cats.map((c) => { const ops = S.all('transactions').filter((t) => t.categoryId === c.id); return '<tr><td data-label="Catégorie"><span class="cell-flex"><span class="cat-icon" style="background:' + c.color + '22;width:34px;height:34px">' + U.esc(c.icon || '•') + '</span><span class="dot" style="background:' + U.esc(c.color) + '"></span><span class="cell-main">' + U.esc(c.name) + '</span>' + (c.neutral ? '<span class="badge plain b-muted">Hors résultat</span>' : '') + '</span></td><td data-label="Opérations" class="r num">' + ops.length + '</td><td data-label="Total 12 mois" class="r num">' + U.money(U.sum(ops.filter((t) => t.date >= from), (t) => t.amountHT)) + '</td><td class="actions"><button class="icon-btn sm" data-edit-cat="' + c.id + '" aria-label="Modifier ' + U.esc(c.name) + '">' + O.icon('edit') + '</button><button class="icon-btn sm danger" data-del-cat="' + c.id + '" aria-label="Supprimer ' + U.esc(c.name) + '">' + O.icon('trash') + '</button></td></tr>'; }).join('') +
            '</tbody></table></div></section>';
        });
      } else {
        const pms = S.all('paymentMethods');
        content = '<section class="card flush"><div class="table-wrap"><table class="data responsive"><caption class="sr-only">Moyens de paiement</caption><thead><tr><th scope="col">Moyen de paiement</th><th scope="col">Type</th><th scope="col">Compte par défaut</th><th scope="col" class="r">Utilisations</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
          pms.map((p) => '<tr><td data-label="Nom"><span class="cell-flex"><span class="kpi-icon" style="width:34px;height:34px">' + O.icon(p.kind === 'carte' ? 'card' : p.kind === 'especes' ? 'wallet' : p.kind === 'cheque' ? 'edit' : 'bank') + '</span><span class="cell-main">' + U.esc(p.name) + '</span></span></td><td data-label="Type">' + U.esc(KINDS[p.kind] || p.kind) + '</td><td data-label="Compte">' + U.esc(S.name('accounts', p.accountId)) + '</td><td data-label="Utilisations" class="r num">' + S.all('transactions').filter((t) => t.paymentMethodId === p.id).length + '</td><td class="actions"><button class="icon-btn sm" data-edit-pm="' + p.id + '" aria-label="Modifier ' + U.esc(p.name) + '">' + O.icon('edit') + '</button><button class="icon-btn sm danger" data-del-pm="' + p.id + '" aria-label="Supprimer ' + U.esc(p.name) + '">' + O.icon('trash') + '</button></td></tr>').join('') +
          '</tbody></table></div></section>';
      }
      root.innerHTML = '<div class="view"><div class="page-head"><div><div class="eyebrow">Paramétrage</div><h1>Référentiels</h1><p>Catégories budgétaires et moyens de paiement utilisés dans toute l’application.</p></div><div class="page-actions"><button class="btn btn-primary" data-act="new">' + O.icon('plus') + (st.tab === 'categories' ? 'Nouvelle catégorie' : 'Nouveau moyen de paiement') + '</button></div></div>' +
        '<div class="tabs mb" role="tablist" aria-label="Référentiel"><button type="button" role="tab" aria-selected="' + (st.tab === 'categories') + '" data-tab="categories">Catégories budgétaires</button><button type="button" role="tab" aria-selected="' + (st.tab === 'payments') + '" data-tab="payments">Moyens de paiement</button></div>' +
        '<div class="stagger">' + content + '</div></div>';
      root.addEventListener('click', async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        try {
          if (b.dataset.tab) { st.tab = b.dataset.tab; O.App.refresh(); }
          else if (b.dataset.act === 'new') st.tab === 'categories' ? catForm() : pmForm();
          else if (b.dataset.editCat) catForm(S.get('categories', b.dataset.editCat));
          else if (b.dataset.editPm) pmForm(S.get('paymentMethods', b.dataset.editPm));
          else if (b.dataset.delCat) { const c = S.get('categories', b.dataset.delCat); if (await UI.confirm('Supprimer la catégorie « ' + c.name + ' » ?', { danger: true, ok: 'Supprimer' })) { await S.remove('categories', c.id); UI.toast('Catégorie supprimée.'); } }
          else if (b.dataset.delPm) { const p = S.get('paymentMethods', b.dataset.delPm); if (await UI.confirm('Supprimer « ' + p.name + ' » ?', { danger: true, ok: 'Supprimer' })) { await S.remove('paymentMethods', p.id); UI.toast('Moyen de paiement supprimé.'); } }
        } catch (err) { UI.error(err); }
      });
    }
  };
})(window.Ondea);
