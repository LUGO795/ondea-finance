<?php
/* ==========================================================================
   Ondea Finance — Configuration de l'API (PHP 8 / MySQL / PDO)
   Renseigner vos identifiants puis passer driver: 'api' dans js/config.js.
   ========================================================================== */
declare(strict_types=1);

return [
    'dsn'      => 'mysql:host=localhost;dbname=ondea_finance;charset=utf8mb4',
    'user'     => 'ondea',
    'password' => 'motdepasse-a-changer',
    // Dossier de stockage des justificatifs — idéalement HORS de la racine web
    'storage'  => __DIR__ . '/storage',
    'max_upload' => 25 * 1024 * 1024,
    // Mode autonome mono-entreprise tant que l'authentification n'est pas branchée.
    // Mettre à false après avoir implémenté api/login (voir docs/ARCHITECTURE.md).
    'single_company_mode' => true,
];
