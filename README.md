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

Sans ce volume, les comptes et les cahiers sont effacés à chaque redéploiement. L'application le détecte :
le superadmin voit alors un **cadre rouge « Attention : les données seront effacées »** sur son tableau de bord
et dans Administration → Sauvegarde, et les journaux Coolify affichent un avertissement. Quand le volume est bien
branché, Administration → Sauvegarde affiche **« Stockage persistant actif »**.

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
| `VAPID_SUBJECT` | non | ex. `mailto:vous@exemple.org` | Contact transmis aux services de notification (Google, Apple). Les clés des notifications sont créées automatiquement dans `/data/vapid.json` |
| `TIMEZONE` | non | `Africa/Lagos` (défaut) | Fuseau horaire des rappels et des heures écrites dans les notifications |
| `DATA_PERSISTENT` | non | `true` | À mettre seulement si le volume est branché autrement et que l'alerte s'affiche à tort |
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
5. **Administration → Déblocage** : choisissez d'abord **la classe** (chaque classe avance à son rythme), puis débloquez
   les leçons une par une ou toute une phase d'un clic. Les élèves les voient aussitôt et peuvent faire
   les exercices.
6. Les mentors peuvent aussi débloquer les leçons de leur classe depuis leur *Tableau de bord*.

## Application sur téléphone (PWA)
Le site est une **application installable** : icône sur l'écran d'accueil, ouverture en plein écran, barre d'onglets en bas
comme WhatsApp, conversations avec le mentor façon messagerie, fenêtres qui s'ouvrent par le bas.
Il faut que le site soit en **HTTPS** (Coolify le fait automatiquement avec votre domaine).

- **Android (Chrome)** : ouvrir le site → bouton **Installer** sur l'accueil, ou menu ⋮ → *Installer l'application*.
- **iPhone (Safari)** : ouvrir le site → bouton **Partager** ↑ → *Sur l'écran d'accueil* → *Ajouter*.

Les mises à jour arrivent toutes seules : après un redéploiement, l'application charge la nouvelle version.

## Communauté
Un salon **Général** pour toute l'école et **un salon par leçon**. Messages, photos, réponses (citation du message),
réactions (👍 ❤️ 🙏 🔥 😂 👏), transfert vers un autre salon, copie, suppression (son propre message ; les mentors
et le superadmin peuvent modérer). Les échanges **restent** : les promotions suivantes les retrouvent.
Un élève entre dans le salon d'une leçon dès que cette leçon lui est débloquée (pas de « spoiler »).
- **Mentions** : taper `@` (ou le bouton @) puis choisir la personne ; elle reçoit une notification.
- **Messages privés** : onglet « Messages privés » → « Nouveau message privé », ou toucher le nom / l'avatar d'un membre,
  ou « Répondre en privé » sur un message (le message d'origine est cité). Seules les deux personnes voient la conversation.
- **Qui a réagi** : toucher les réactions sous un message affiche la liste des personnes, par émoji.
Les photos sont réduites sur le téléphone avant l'envoi et enregistrées dans `/data/uploads`.

## Aperçu des leçons verrouillées
L'élève touche une leçon encore fermée : il voit ce qu'il saura à la fin, ce qu'il va découvrir, les grands points et
les textes à lire pour se préparer.

## Notifications sur le téléphone
Cloche 🔔 dans l'application + notifications sur le téléphone (même application fermée) :
leçons débloquées, questions et réponses mentor ↔ élève, cahier envoyé, cahier corrigé, appréciation, leçon validée,
réponses, mentions, messages privés et réactions dans la communauté, nouveaux messages dans les salons où l'on a déjà écrit.
Chaque personne touche **« Activer »** (accueil, page Notifications ou Profil). Sur **iPhone**, il faut d'abord installer
l'application sur l'écran d'accueil (iOS 16.4 ou plus récent). Le site doit être en **HTTPS**.

## Rappels et agenda
- **Rappels « remplis ton cahier »** : quand une leçon est ouverte et que le cahier n'est pas envoyé, l'élève reçoit une
  notification (avec le % déjà rempli). Réglages dans Administration → Rappels : délai après l'ouverture, fréquence,
  heure d'envoi, nombre maximum. Sur l'accueil, l'élève voit « À terminer » avec une barre de progression ; le mentor voit
  « Cahiers pas encore envoyés » et peut **relancer** un élève d'un geste.
- **Agenda** : cours en ligne, prière, étude biblique, culte… pour une classe ou toute l'école, une fois / chaque semaine /
  chaque jour, avec le lien Google Meet. Rappels sur les téléphones : la veille, 1 h avant, 15 min avant, à l'heure.
  Bouton « Rejoindre maintenant » quand c'est l'heure, et « Ajouter à mon agenda » (fichier .ics pour le calendrier du téléphone).

## Statistiques, certificats, WhatsApp, mode sombre
- **Statistiques mensuelles** (Tableau de bord → 📊 Statistiques) : élèves actifs, cahiers envoyés, leçons validées,
  moyenne et taux de réussite aux tests, questions, messages, nouveaux élèves, certificats ; évolution sur 6 mois ;
  détail par classe et par élève ; export Excel (CSV). Les mentors voient leurs élèves, le superadmin toute l'école.
- **Certificat de fin de phase (PDF)** : dès que toutes les leçons d'une phase sont validées par le mentor, l'élève est
  prévenu et télécharge son certificat (accueil et Profil). Chaque certificat a un **code de vérification** :
  `https://votre-site/#/verifier/CODE` affiche « Certificat authentique » (sans connexion).
- **Résumé WhatsApp** (Tableau de bord → 💬 Résumé WhatsApp) : message prêt pour le groupe de la classe (leçons ouvertes,
  rendez-vous, cahiers) et messages personnels pour les élèves sans notifications (numéro WhatsApp au format +234…).
- **Mode sombre** : Profil → Apparence (« Comme le téléphone », Clair, Sombre).

## Qui fait quoi
- **Élève** : résumé du cours (PDF / Word), cahier en ligne avec enregistrement automatique, questions au mentor
  sur une question précise, test final (réussi à 7/10, essais illimités), corrections et validation.
- **Mentor** : suivi de ses élèves, déblocage des leçons, lecture de tout le cahier, ✓ / ✗ et commentaire par réponse,
  appréciation, validation de la leçon, réponses aux questions, nouveau mot de passe pour ses élèves.
- **Superadmin** : tout ce que fait un mentor pour tous les élèves, plus la gestion des comptes (rôles, mentor,
  classe, activation, mots de passe) et des classes.

## Sauvegardes
- **Automatique** : une copie par jour dans `/data/backups` (14 jours gardés).
- **Manuelle** : Administration → Sauvegarde → *Télécharger une sauvegarde* (fichier `.db` à garder sur votre ordinateur).
- **Restaurer** : Administration → Sauvegarde → *Restaurer une sauvegarde…* (une copie des données actuelles est gardée avant).

Toutes les données sont dans le volume : la base **`/data/ecole.db`** (avec `ecole.db-wal` et `ecole.db-shm`),
les photos de la communauté dans **`/data/uploads/`** et les clés des notifications dans **`/data/vapid.json`**
(à garder : si elles changent, chacun devra réactiver les notifications).
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
