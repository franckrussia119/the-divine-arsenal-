# École de disciples · The Divine Arsenal Corporation

Plateforme en ligne du cahier d'exercices (36 leçons, phases 1 à 3).
Élèves, mentors et superadmin. **Tout tourne dans un seul conteneur Docker** : un petit serveur Node.js
(aucune dépendance à installer) et une base de données SQLite enregistrée sur un **volume persistant Coolify**.

---

## Déployer sur Coolify (depuis GitHub)

### 1. Mettre le code sur GitHub
Créez un dépôt (privé conseillé) et envoyez-y **le contenu** de ce dossier : `Dockerfile`, `server.js`,
`package.json`, `README.md` et le dossier `public/`. Le `Dockerfile` doit être à la **racine** du dépôt.

### 2. Créer l'application dans Coolify
1. **Projects → votre projet → + New → Private Repository (with GitHub App)** (ou *Public Repository*), branche `main`.
2. **Build Pack : `Dockerfile`**.
3. **Ports Exposes : `3000`**.
4. **Domains** : votre adresse, par ex. `https://ecole.votredomaine.org`.

### 3. Ajouter le stockage persistant (indispensable)
Onglet **Persistent Storage → + Add → Volume Mount** :

| Champ | Valeur |
|---|---|
| Name | `ecole-data` (au choix) |
| Destination Path | **`/data`** |

Sans ce volume, les comptes et les cahiers seraient effacés à chaque redéploiement.

### 4. Variables d'environnement
Onglet **Environment Variables** :

| Variable | Obligatoire | Valeur | Rôle |
|---|---|---|---|
| `SUPERADMIN_USERNAME` | **oui** | ex. `admin` | Identifiant du superadmin, créé au premier démarrage |
| `SUPERADMIN_PASSWORD` | **oui** | un mot de passe solide | Mot de passe du superadmin (au premier démarrage) |
| `SUPERADMIN_NAME` | non | ex. `Pasteur Jean` | Nom affiché du superadmin |
| `PORT` | non | `3000` (défaut) | Port interne ; doit correspondre à *Ports Exposes* |
| `DATA_DIR` | non | `/data` (défaut) | Dossier de la base ; doit correspondre au volume |
| `SESSION_DAYS` | non | `30` (défaut) | Durée de connexion avant de devoir se reconnecter |
| `ALLOW_SIGNUP` | non | `true` (défaut) | `false` ferme les inscriptions par code de classe |
| `COOKIE_SECURE` | non | `auto` (défaut) | `auto` = sécurisé dès que le site est en HTTPS |
| `SUPERADMIN_RESET_PASSWORD` | non | `false` (défaut) | Mettez `true` **une seule fois** pour réimposer `SUPERADMIN_PASSWORD` si vous l'avez oublié, redéployez, puis remettez `false` |

### 5. Déployer
Cliquez **Deploy**. Les journaux doivent afficher :
```
Superadmin créé : admin
École de disciples : http://0.0.0.0:3000  (données : /data)
```
Activez **Auto Deploy** pour que chaque `git push` mette le site à jour.

---

## Premier démarrage
1. Connectez-vous avec `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`.
2. **Leçons** (menu du haut) : les 36 leçons sont là. Ouvrez-en une pour voir le résumé du cours,
   le cahier d'exercices complet et le test, tels que les élèves les verront.
3. **Administration → Classes → Nouvelle classe** (nom + code).
4. **Administration → Utilisateurs → Créer un utilisateur** : nom, identifiant, mot de passe, rôle
   (Élève, Mentor ou Superadmin), classe et mentor. Un récapitulatif à communiquer à la personne s'affiche.
   (Les élèves peuvent aussi créer leur compte eux-mêmes avec le code de leur classe.)
5. **Administration → Déblocage des leçons** : choisissez une classe (ou un seul élève), puis débloquez
   les leçons une par une ou toute une phase d'un clic. Les élèves les voient aussitôt et peuvent faire
   les exercices.
6. Les mentors peuvent aussi débloquer les leçons de leur classe depuis leur *Tableau de bord*.

## Qui fait quoi
- **Élève** : résumé du cours (PDF / Word), cahier en ligne avec enregistrement automatique, questions au mentor
  sur une question précise, test final (réussi à 7/10, essais illimités), corrections et validation.
- **Mentor** : suivi de ses élèves, déblocage des leçons, lecture de tout le cahier, ✓ / ✗ et commentaire par réponse,
  appréciation, validation de la leçon, réponses aux questions, nouveau mot de passe pour ses élèves.
- **Superadmin** : tout ce que fait un mentor pour tous les élèves, plus la gestion des comptes (rôles, mentor,
  classe, activation, mots de passe) et des classes.

## Sauvegardes
Toutes les données sont dans le volume, fichier **`/data/ecole.db`** (avec `ecole.db-wal` et `ecole.db-shm`).
Pour une sauvegarde : dans Coolify, utilisez la sauvegarde du volume, ou copiez ces fichiers depuis le terminal
du conteneur (de préférence application arrêtée).

## Essayer sur son ordinateur
Avec Node.js 22.13 ou plus récent :
```
DATA_DIR=./data SUPERADMIN_USERNAME=admin SUPERADMIN_PASSWORD=admin123 COOKIE_SECURE=false node server.js
```
puis ouvrez http://localhost:3000.
(Ouvert sans serveur, avec de simples fichiers, le site démarre en *mode démonstration*.)

## Structure
```
Dockerfile        image Docker (Node 22, volume /data, port 3000)
server.js         serveur : API, comptes, droits, base SQLite, fichiers du site
package.json      informations du projet (aucune dépendance)
public/           le site : index.html, css/, js/ (dont content.js = les 36 leçons et les tests), img/, files/
```
