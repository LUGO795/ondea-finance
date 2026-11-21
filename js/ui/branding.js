/* ==========================================================================
   Ondea Finance — Identité visuelle personnalisable (ajout v1.1)
   Le logo choisi remplace automatiquement la marque partout : barre latérale,
   écran de chargement, écran de connexion, favicon, en-tête d'impression.
   Stocké séparément (clé « brand ») pour être lisible avant la connexion.
   ========================================================================== */
(function (O) {
  'use strict';
  const KEY = O.config.storagePrefix + 'brand';
  const MAX_INPUT = 2 * 1024 * 1024; // 2 Mo avant optimisation
  const MAX_SIDE = 256;              // logo redimensionné à 256 px max
  const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
  let defaultMark = null, defaultFavicon = null, defaultName = null;

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const write = (v) => {
    try { localStorage.setItem(KEY, JSON.stringify(v)); }
    catch (e) { throw new Error('Espace insuffisant pour enregistrer ce logo : choisissez une image plus légère.'); }
  };

  /** Optimise une image : redimensionne les formats bitmap, conserve les SVG */
  function toDataURL(file) {
    return new Promise((resolve, reject) => {
      if (!file) { reject(new Error('Aucun fichier sélectionné.')); return; }
      if (!ACCEPT.includes(file.type)) { reject(new Error('Format non accepté : PNG, JPG, WebP, GIF ou SVG.')); return; }
      if (file.size > MAX_INPUT) { reject(new Error('Image trop lourde (2 Mo maximum).')); return; }
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Lecture du fichier impossible.'));
      fr.onload = () => {
        if (file.type === 'image/svg+xml') { resolve(fr.result); return; }
        const img = new Image();
        img.onerror = () => reject(new Error('Image illisible.'));
        img.onload = () => {
          const r = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * r)); c.height = Math.max(1, Math.round(img.height * r));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/png'));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  const Brand = {
    get() { return read(); },
    logo() { return read().logo || null; },
    name() { return read().name || ''; },
    async setLogo(file) { const url = await toDataURL(file); write(Object.assign(read(), { logo: url, updatedAt: new Date().toISOString() })); this.apply(); return url; },
    setName(name) { const b = read(); b.name = String(name || '').trim().slice(0, 40); write(b); this.apply(); },
    clearLogo() { const b = read(); delete b.logo; write(b); this.apply(); },
    /** Applique la marque à tous les emplacements présents dans la page */
    apply(root) {
      const b = read();
      const marks = (root || document).querySelectorAll('.brand-mark');
      if (defaultMark === null) { const m = document.querySelector('.sidebar .brand-mark') || marks[0]; defaultMark = m ? m.innerHTML : ''; }
      marks.forEach((m) => {
        if (b.logo) {
          if (!m.classList.contains('has-logo') || (m.querySelector('img') || {}).src !== b.logo) {
            m.classList.add('has-logo');
            m.innerHTML = '<img src="' + b.logo.replace(/"/g, '%22') + '" alt="">';
          }
        } else if (m.classList.contains('has-logo')) {
          m.classList.remove('has-logo');
          m.innerHTML = defaultMark;
        }
      });
      // Nom de marque (facultatif)
      document.querySelectorAll('.brand-name').forEach((n) => {
        const t = n.firstChild;
        if (!t || t.nodeType !== 3) return;
        if (defaultName === null) defaultName = t.textContent;
        t.textContent = b.name || defaultName;
      });
      const brandLink = document.querySelector('.sidebar .brand');
      if (brandLink) brandLink.setAttribute('aria-label', (b.name || defaultName || 'Ondea Finance') + ' — tableau de bord');
      // Favicon
      const fav = document.querySelector('link[rel="icon"]');
      if (fav) {
        if (defaultFavicon === null) defaultFavicon = fav.getAttribute('href');
        fav.setAttribute('href', b.logo || defaultFavicon);
      }
      // En-tête d'impression des rapports
      document.querySelectorAll('.print-only').forEach((p) => {
        let img = p.querySelector('img.print-logo');
        if (b.logo) { if (!img) { img = document.createElement('img'); img.className = 'print-logo'; img.alt = ''; p.prepend(img); } img.src = b.logo; }
        else if (img) img.remove();
      });
    }
  };

  // Mise à jour automatique : nouveaux éléments (vues, modales, écran de connexion) et autres onglets
  const obs = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && (n.matches('.brand-mark, .print-only') || n.querySelector('.brand-mark, .print-only'))) { Brand.apply(); return; }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('storage', (e) => { if (e.key === KEY) Brand.apply(); });

  O.Brand = Brand;
  Brand.apply();
})(window.Ondea);
