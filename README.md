# Ondea Finance

**Gestion des dépenses et des flux financiers pour TPE/PME** — HTML5, CSS3 et JavaScript natif,
sans framework, sans dépendance, sans serveur.

## Démarrer

Ouvrez `index.html` dans un navigateur récent (Chrome, Edge, Firefox, Safari).
Au premier lancement, 12 mois de données de démonstration sont générés.
Tout fonctionne hors-ligne : aucune inscription, aucun abonnement.

> Conseil : pour une utilisation quotidienne, servez le dossier en local
> (`php -S localhost:8000` ou `python -m http.server`) afin que le navigateur rattache
> durablement les données à une même origine.

## Modules

| Module | Fonctions |
|---|---|
| Tableau de bord | Trésorerie, encaissements/décaissements, résultat, factures ouvertes, flux 6/12 mois, dépenses par catégorie, échéances, prévision 30 j, alertes budgétaires |
| Dépenses & recettes | Saisie HT/TTC avec calcul de TVA, filtres, recherche, tri, pagination, sélection multiple, duplication, justificatifs, export CSV |
| Factures | Clients et fournisseurs, numérotation automatique, échéance selon délai du tiers, retards, règlement → opération de trésorerie |
| Échéancier | Charges/recettes récurrentes (mensuelle → annuelle), calendrier 30/90/180 j, génération des opérations |
| Trésorerie | Comptes, virements internes, prévisionnel 30–180 j, point bas, autonomie financière |
| Budgets | Plafonds HT mensuels/annuels, seuils d'alerte, budget vs réalisé |
| Rapports | Compte de résultat, synthèse TVA par taux, top tiers, tableau mensuel, CSV, impression PDF |
| Tiers | Fournisseurs et clients, volumes, encours, historique |
| Référentiels | Catégories budgétaires, moyens de paiement |
| Coffre-fort | Stockage IndexedDB : capacité, dossiers, étiquettes, prévisualisation image/PDF/texte, déplacement, suppression |
| Paramètres | Entreprise, thème, taille du texte, sauvegarde complète (avec fichiers), restauration, réinitialisation |

## Accessibilité

Thèmes clair et sombre (contraste AAA visé), taille du texte de 90 % à 135 % (boutons A− / A+),
navigation au clavier, modales à focus piégé, libellés ARIA, tableaux de données alternatifs pour
les graphiques, respect de « réduire les animations ».
Raccourcis : `Ctrl K` recherche · `Alt N` nouvelle opération · `Échap` fermer.

## Stockage

* **LocalStorage** : données de gestion (préfixe `ondea-finance:`).
* **IndexedDB** (`ondea-finance-files`) : justificatifs, factures, reçus et images.

## Évolution PHP 8 / MySQL / PDO

Voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) : `docs/schema.sql` + `api/index.php`,
puis `driver: 'api'` dans `js/config.js`. Aucune vue n'est à réécrire.

---
© Ondea Web Studio
