/* ==========================================================================
   Vue — Paramètres › Sécurité & identité visuelle (ajout v1.1)
   Étend la vue Paramètres existante sans la modifier : la section est
   ajoutée après le rendu d'origine.
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U, UI = O.UI, A = O.Auth, B = O.Brand;
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

  const pw = (name, label, auto) => '<div class="field"><label for="sec-' + name + '">' + label + '</label><div class="pw-wrap"><input id="sec-' + name + '" name="' + name + '" type="password" autocomplete="' + auto + '" required spellcheck="false" autocapitalize="off" aria-describedby="sec-' + name + '-err"><button type="button" class="pw-toggle" data-pw="sec-' + name + '" aria-controls="sec-' + name + '" aria-pressed="false" aria-label="Afficher le mot de passe" title="Afficher le mot de passe">' + O.icon('eye') + '</button></div><span class="error" id="sec-' + name + '-err" role="alert"></span></div>';

  function section() {
    const logo = B.logo(), rec = A.record() || {}, lock = A.autoLockMin();
    const el = document.createElement('section');
    el.className = 'card';
    el.id = 'securite';
    el.innerHTML =
      '<h2>Identité visuelle</h2><p class="muted">Votre logo remplace automatiquement celui d’Ondea Finance partout : menu, écran de connexion, onglet du navigateur et rapports imprimés.</p>' +
      '<div class="logo-drop"><button type="button" class="logo-preview" data-logo-pick aria-label="Choisir une image de logo (ou glisser-déposer)">' + (logo ? '<img src="' + logo.replace(/"/g, '%22') + '" alt="Logo actuel">' : O.icon('upload')) + '</button>' +
      '<div><div class="flex"><label class="btn btn-primary" style="cursor:pointer">' + O.icon('upload') + (logo ? 'Changer le logo' : 'Importer mon logo') + '<input type="file" class="sr-only" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" data-logo-input></label>' +
      (logo ? '<button type="button" class="btn" data-logo-reset>' + O.icon('refresh') + 'Logo d’origine</button>' : '') + '</div>' +
      '<p class="hint small muted" style="margin:.5rem 0 0">PNG, JPG, WebP, GIF ou SVG · 2 Mo max · format carré conseillé (redimensionné à 256 px).</p></div></div>' +
      '<form novalidate data-brandform class="mt"><div class="field"><label for="brandName">Nom affiché à côté du logo</label><div class="flex" style="flex-wrap:nowrap"><input id="brandName" name="brandName" type="text" maxlength="40" value="' + U.esc(B.name()) + '" placeholder="Ondea Finance"><button type="submit" class="btn">' + O.icon('check') + 'Appliquer</button></div><span class="hint">Laissez vide pour conserver « Ondea Finance ».</span></div></form>' +
      '<hr class="divider"><h2>Sécurité de l’accès</h2>' +
      '<div class="stat-row"><span class="muted">Protection</span><strong>' + (rec.algo === 'PBKDF2-SHA256' ? 'PBKDF2-SHA-256 · ' + (rec.iter || 0).toLocaleString('fr-FR') + ' itérations' : 'SHA-256 itéré') + '</strong></div>' +
      '<div class="stat-row"><span class="muted">Mot de passe modifié le</span><strong>' + (rec.changedAt ? U.fmtDate(rec.changedAt.slice(0, 10)) : '—') + '</strong></div>' +
      '<div class="field mt"><label for="autoLock">Verrouillage automatique après inactivité</label><select id="autoLock" data-autolock>' + [[5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 heure'], [240, '4 heures'], [0, 'Jamais (déconseillé)']].map(([v, l]) => '<option value="' + v + '"' + (v === lock ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
      '<div class="flex mt"><button type="button" class="btn" data-lock-now>' + O.icon('lock') + 'Verrouiller maintenant</button><span class="small muted">Raccourci : <kbd>Ctrl</kbd> + <kbd>Maj</kbd> + <kbd>L</kbd></span></div>' +
      '<h3 class="mt">Changer le mot de passe</h3><form novalidate data-pwform>' + pw('current', 'Mot de passe actuel', 'current-password') + pw('next', 'Nouveau mot de passe', 'new-password') +
      '<div class="strength" data-s="0" aria-hidden="true" style="margin:-.5rem 0 .35rem"><span></span><span></span><span></span><span></span></div><p class="small muted" style="margin:0 0 1rem" aria-live="polite">Robustesse : <strong data-slabel>—</strong> · 8 caractères minimum</p>' +
      pw('confirm', 'Confirmer le nouveau mot de passe', 'new-password') +
      '<button type="submit" class="btn btn-primary">' + O.icon('shield') + 'Mettre à jour le mot de passe</button></form>' +
      '<div class="alert info mt">' + O.icon('info') + '<p>Le mot de passe protège l’accès à l’interface sur cet appareil. Pour un usage multi-utilisateur avec authentification serveur, utilisez le mode PHP/MySQL (voir docs/ARCHITECTURE.md).</p></div>';
    return el;
  }

  function bind(el) {
    const err = (form, name, msg) => { const i = form.querySelector('[name="' + name + '"]'); const e = form.querySelector('#sec-' + name + '-err'); i.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (e) { e.textContent = msg || ''; e.classList.toggle('show', !!msg); } if (msg) i.focus(); };
    const input = el.querySelector('[data-logo-input]');
    const pick = el.querySelector('[data-logo-pick]');
    const setLogo = async (file) => {
      try { await B.setLogo(file); UI.toast('Logo mis à jour partout dans l’application.'); O.App.refresh(); }
      catch (e) { UI.error(e); }
    };
    input.addEventListener('change', () => { if (input.files[0]) setLogo(input.files[0]); input.value = ''; });
    pick.addEventListener('click', () => input.click());
    ['dragenter', 'dragover'].forEach((ev) => pick.addEventListener(ev, (e) => { e.preventDefault(); pick.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => pick.addEventListener(ev, () => pick.classList.remove('over')));
    pick.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) setLogo(e.dataTransfer.files[0]); });
    const reset = el.querySelector('[data-logo-reset]');
    if (reset) reset.addEventListener('click', async () => { if (await UI.confirm('Revenir au logo d’origine ?', { ok: 'Rétablir' })) { B.clearLogo(); UI.toast('Logo d’origine rétabli.'); O.App.refresh(); } });
    el.querySelector('[data-brandform]').addEventListener('submit', (e) => { e.preventDefault(); B.setName(e.target.brandName.value); UI.toast('Nom affiché mis à jour.'); });
    el.querySelector('[data-autolock]').addEventListener('change', (e) => { A.setAutoLock(Number(e.target.value)); UI.toast('Verrouillage automatique : ' + e.target.selectedOptions[0].textContent + '.'); });
    el.querySelector('[data-lock-now]').addEventListener('click', () => A.lock('manual'));
    el.querySelectorAll('[data-pw]').forEach((b) => b.addEventListener('click', () => {
      const i = document.getElementById(b.dataset.pw), show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', String(show));
      b.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      b.title = b.getAttribute('aria-label');
      b.innerHTML = show ? EYE_OFF : O.icon('eye');
      i.focus();
    }));
    const form = el.querySelector('[data-pwform]');
    form.next.addEventListener('input', () => { const s = A.strength(form.next.value); el.querySelector('.strength').dataset.s = s.score; el.querySelector('[data-slabel]').textContent = s.label; });
    form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true') err(form, e.target.name, null); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      if (!form.current.value) return err(form, 'current', 'Saisissez votre mot de passe actuel.');
      if (form.next.value.length < 8) return err(form, 'next', '8 caractères minimum.');
      if (A.strength(form.next.value).score < 2) return err(form, 'next', 'Trop faible : ajoutez majuscules, chiffres ou symboles.');
      if (form.next.value !== form.confirm.value) return err(form, 'confirm', 'Les mots de passe ne correspondent pas.');
      btn.disabled = true;
      try {
        if (!(await A.verify(form.current.value))) { btn.disabled = false; return err(form, 'current', 'Mot de passe actuel incorrect.'); }
        await A.setPassword(form.next.value);
        form.reset(); el.querySelector('.strength').dataset.s = 0;
        UI.toast('Mot de passe mis à jour.');
        O.App.refresh();
      } catch (ex) { UI.error(ex); btn.disabled = false; }
    });
  }

  const original = O.Views.settings.render;
  O.Views.settings.render = function (root, params) {
    const r = original.call(this, root, params);
    const grid = root.querySelector('.grid');
    if (grid) { const el = section(); grid.insertBefore(el, grid.children[2] || null); bind(el); }
    return r;
  };
})(window.Ondea);
