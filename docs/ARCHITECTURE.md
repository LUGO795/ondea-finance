# Ondea Finance — Architecture et passage en PHP 8 / MySQL / PDO

## 1. Principe : l'interface ne parle jamais directement au stockage

```
 Vues (js/views/*.js)  ──►  O.Store  (cache mémoire + événements)  ──►  Pilote de données
                       ──►  O.Files (métadonnées en cache)         ──►  Pilote de fichiers
                       ──►  O.F     (calculs financiers purs)
```

| Couche | Fichier | Rôle |
|---|---|---|
| Configuration | `js/config.js` | Choix du pilote : `driver: 'local'` ou `driver: 'api'` |
| Pilotes | `js/core/drivers.js` | `LocalStorageDriver`, `IndexedDBFileDriver` (autonome) · `ApiDriver`, `ApiFileDriver` (serveur) |
| Store | `js/core/store.js` | CRUD asynchrone, intégrité référentielle, événements de rafraîchissement |
| Fichiers | `js/core/files.js` | Coffre-fort : quotas, dossiers, liens avec les pièces |
| Calculs | `js/core/finance.js` | Soldes, TVA, budgets, prévisionnel, échéancier — sans accès au stockage |
| Interface | `js/ui/*.js` | Modales, toasts, graphiques SVG, tableau de données, formulaires |
| Vues | `js/views/*.js` | Un écran = un module, aucune requête directe |

Toutes les méthodes des pilotes renvoient des **Promesses**. Le pilote local et le pilote API
respectent exactement le même contrat : passer de l'un à l'autre ne demande **aucune modification
des vues**.

## 2. Contrat des pilotes

```js
list(entity) · create(entity, record) · update(entity, id, record) · remove(entity, id)
getSettings() · saveSettings(obj) · isInitialized() · markInitialized()
replaceAll(dataset) · clearAll()
// fichiers
open() · list() · get(id) → { …meta, blob } · put(record) · patch(id, patch) · remove(id) · clear()
```

Entités : `accounts`, `categories`, `thirdParties`, `paymentMethods`, `transactions`, `invoices`,
`schedules`, `budgets`, `transfers`.

## 3. Conventions de données

* Montants en **centimes entiers** (aucune erreur d'arrondi flottant) ; TVA arrondie au centime.
* Dates au format ISO `AAAA-MM-JJ`.
* Identifiants texte générés côté client (`tx_…`, `inv_…`) : compatibles hors-ligne et multi-postes.
* Trésorerie = flux **TTC payés** ; résultat, budgets et rapports = **HT**.
* Catégories « hors résultat » (`neutral: true`) : TVA reversée, emprunts, apports — impactent la
  trésorerie mais pas le résultat.

## 4. Migration vers PHP 8 + MySQL (multi-utilisateur)

1. Créer la base puis importer le schéma :
   ```bash
   mysql -u root -p -e "CREATE DATABASE ondea_finance CHARACTER SET utf8mb4"
   mysql -u root -p ondea_finance < docs/schema.sql
   ```
2. Renseigner `api/config.php` (DSN, utilisateur, mot de passe, dossier `storage` hors racine web
   de préférence).
3. Dans `js/config.js` : `driver: 'api'` et `demoOnFirstRun: false`.
4. Déployer le dossier complet sur l'hébergement PHP (Alwaysdata, OVH, o2switch…).
5. (Facultatif) Récupérer les données locales : *Paramètres → Sauvegarde complète* en mode local,
   puis *Restaurer* une fois le mode API activé — la restauration envoie tout au serveur.

L'API (`api/index.php`) est un point d'entrée REST unique, en PDO avec requêtes préparées,
liste blanche d'entités et de colonnes, conversion automatique camelCase ↔ snake_case,
transactions SQL pour la restauration et contrôle du type MIME des fichiers envoyés.
Elle a été testée de bout en bout avec MariaDB (création, règlement de facture,
envoi et prévisualisation de justificatifs, rechargement).

### Multi-utilisateur

Le schéma contient déjà `companies`, `users` (rôles `admin`, `comptable`, `lecture`) et une colonne
`company_id` sur chaque table. Pour l'activer :

* ajouter un script `api/login.php` qui vérifie `password_verify()` et renseigne
  `$_SESSION['user_id']`, `$_SESSION['company_id']`, `$_SESSION['role']` ;
* passer `single_company_mode` à `false` dans `api/config.php` (l'API répond alors 401 sans session) ;
* filtrer les écritures selon `$_SESSION['role']` (ex. refuser POST/PUT/DELETE pour `lecture`).

Chaque requête est déjà cloisonnée par `company_id` : plusieurs entreprises peuvent cohabiter dans
la même base.
