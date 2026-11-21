/* ==========================================================================
   Ondea Finance — Configuration
   --------------------------------------------------------------------------
   POUR PASSER EN MODE MULTI-UTILISATEUR (PHP 8 + MySQL + PDO) :
     1. Importer docs/schema.sql dans MySQL.
     2. Renseigner api/config.php (DSN, utilisateur, mot de passe).
     3. Remplacer ci-dessous  driver: 'local'  par  driver: 'api'.
   Aucune vue n'a besoin d'être modifiée : toutes passent par O.Store et O.Files,
   qui délèguent au pilote choisi (voir js/core/drivers.js).
   ========================================================================== */
window.Ondea = window.Ondea || {};
window.Ondea.config = {
  appName: 'Ondea Finance',
  version: '1.0.0',
  /* 'local' = LocalStorage + IndexedDB (autonome) | 'api' = PHP 8 / MySQL / PDO */
  driver: 'local',
  apiBase: 'api/index.php',
  /* Au tout premier lancement : true = jeu de démonstration (12 mois), false = base vierge
     (un compte, catégories et moyens de paiement par défaut). Conseillé : false en production. */
  demoOnFirstRun: true,
  storagePrefix: 'ondea-finance:',
  idbName: 'ondea-finance-files',
  currency: 'EUR',
  locale: 'fr-FR'
};
