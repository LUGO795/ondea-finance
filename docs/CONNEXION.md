# Ondea Finance v1.1 — Connexion & identité visuelle

Ajout **purement additif** : aucun fichier de la v1.0 n'a été modifié, à l'exception de
`index.html`, qui reçoit seulement 6 lignes (1 feuille de style + 3 scripts, avec leurs commentaires).

| Nouveau fichier | Rôle |
|---|---|
| `css/auth.css` | Écran de connexion premium, aperçu du logo, logo personnalisé |
| `js/ui/branding.js` | Logo et nom de marque : appliqués partout et mis à jour automatiquement (menu, connexion, favicon, impression, autres onglets) |
| `js/core/auth.js` | Création et vérification du mot de passe, session, verrouillage auto, démarrage différé de l'application |
| `js/views/security.js` | Section « Identité visuelle » et « Sécurité de l'accès » ajoutée aux Paramètres |

## Fonctionnement

* **Premier lancement** : création du mot de passe (8 caractères minimum, indicateur de robustesse, confirmation).
* **Connexions suivantes** : l'application ne démarre qu'avec le bon mot de passe.
* **Afficher / masquer** le mot de passe à tout moment (bouton œil, `aria-pressed`), alerte majuscules.
* **Anti-force brute** : après 5 échecs, attente de 30 s, qui double à chaque nouvel échec (15 min maximum).
* **Session** limitée à l'onglet, **verrouillage automatique** après inactivité (5 min à 4 h, ou jamais),
  bouton cadenas dans la barre du haut, raccourci `Ctrl + Maj + L`.
* **Mot de passe oublié** : aucune récupération possible ; réinitialisation complète après saisie de « EFFACER ».
* **Accessibilité** : thèmes clair/sombre, A− / A+ de 90 % à 135 % dès l'écran de connexion (réglages
  conservés dans l'application), navigation complète au clavier, reste de la page rendu `inert`.

## Sécurité : ce qu'il faut savoir

L'empreinte du mot de passe (PBKDF2-SHA-256, 210 000 itérations, sel aléatoire) est stockée, jamais le
mot de passe lui-même. Cette protection empêche l'accès à l'interface ; elle ne chiffre pas les données
du navigateur, qui restent lisibles par quelqu'un qui a accès à la session de l'ordinateur et aux outils
de développement. Pour une vraie séparation des utilisateurs, utilisez le mode PHP/MySQL avec authentification
serveur (`docs/ARCHITECTURE.md`).
