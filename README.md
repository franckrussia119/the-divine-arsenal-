# École de disciples · The Divine Arsenal Corporation

Plateforme en ligne du cahier d'exercices : les élèves se connectent, lisent le résumé de chaque leçon, remplissent leur cahier en ligne, posent leurs questions au mentor sur une question précise et passent un test à la fin de chaque leçon. Les mentors débloquent les leçons, corrigent et valident. Le superadmin gère toute la plateforme.

- **36 leçons** (phases 1, 2 et 3) : résumé du cours, cahier complet (A à E + bilan), test de 10 questions.
- **3 rôles** : élève, mentor (admin), superadmin.
- **Sans installation pour essayer** : ouvrez `index.html` avec un petit serveur, l'application démarre en *mode démonstration*.

---

## 1. Essayer tout de suite (mode démonstration)

Sur votre ordinateur, dans ce dossier :

```
python3 -m http.server 8000
```

puis ouvrez http://localhost:8000. Comptes de test :

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Élève | `etudiant` | `etudiant123` |
| Mentor | `mentor` | `mentor123` |
| Superadmin | `admin` | `admin123` |

Code de classe pour créer un compte : `DEMO2026`. Les données restent dans le navigateur.

---

## 2. Créer la base de données (Supabase, gratuit)

1. Créez un compte sur https://supabase.com puis **New project** (choisissez un mot de passe et la région la plus proche, par exemple *Europe (Frankfurt)*).
   - *Variante :* Coolify peut aussi héberger Supabase lui-même (Resources → New → Services → Supabase). Les étapes suivantes sont identiques dans « Supabase Studio ».
2. Menu **SQL Editor** → **New query** → collez tout le contenu du fichier `supabase/schema.sql` → **Run**. Vous devez voir « Success ».
3. Menu **Authentication → Sign In / Providers → Email** : laissez *Email* activé et **désactivez « Confirm email »** (les élèves se connectent avec un identifiant, pas avec une vraie adresse e-mail). Enregistrez.
4. Menu **Project Settings → API** (ou **Data API**) : copiez
   - **Project URL** (ex. `https://abcd1234.supabase.co`)
   - la clé **anon public**.

> La clé *anon* peut être publique : la sécurité est assurée par les règles (RLS) du fichier `schema.sql`. Ne mettez **jamais** la clé *service_role* dans le site.

---

## 3. Mettre le code sur GitHub

1. Sur https://github.com : **New repository** (par ex. `ecole-de-disciples`), *Private* conseillé.
2. Envoyez ce dossier :
   ```
   git init
   git add .
   git commit -m "École de disciples"
   git branch -M main
   git remote add origin https://github.com/VOTRE-COMPTE/ecole-de-disciples.git
   git push -u origin main
   ```
   (ou glissez-déposez les fichiers avec **Add file → Upload files**).

---

## 4. Déployer sur Coolify

1. Dans Coolify : **Projects → votre projet → + New → Private Repository (with GitHub App)** (ou *Public Repository* si le dépôt est public) et choisissez le dépôt.
2. **Build Pack : Dockerfile** (le `Dockerfile` est à la racine). **Port exposé : 80**.
3. Onglet **Environment Variables** : ajoutez
   - `SUPABASE_URL` = votre Project URL
   - `SUPABASE_ANON_KEY` = votre clé anon public
4. Onglet **General → Domains** : votre domaine, par ex. `https://ecole.divinearsenal.org` (Coolify crée le certificat HTTPS).
5. **Deploy**. À chaque `git push`, Coolify peut redéployer automatiquement (option *Auto Deploy*).

Si les variables sont vides, le site démarre en mode démonstration : c'est le signe qu'elles ne sont pas prises en compte.

---

## 5. Premier démarrage

1. Ouvrez le site → **Créer mon compte**. **Le tout premier compte devient automatiquement superadmin** (pas besoin de code de classe pour celui-là). Créez-le vous-même, tout de suite.
2. **Administration → Classes → Nouvelle classe** : nom, code d'inscription, mentor.
3. **Mentors** : ils créent leur compte avec un code de classe, puis dans **Administration → Élèves et mentors** vous changez leur rôle en **Mentor**, puis vous les choisissez comme mentor de leur classe (Administration → Classes → Modifier).
4. **Élèves** : donnez-leur le code de leur classe. À l'inscription, ils sont rattachés automatiquement au mentor de la classe. Vous pouvez ensuite **attribuer chaque élève au mentor de votre choix** (colonne *Mentor*).
5. Le mentor **débloque les leçons** depuis son *Tableau de bord* (pour toute la classe) ou depuis la fiche d'un élève (accès individuel).

---

## 6. Qui fait quoi

**Élève**
- voit les leçons débloquées, lit le résumé (et le télécharge en PDF ou en Word) ;
- remplit son cahier en ligne : verset, questions, vrai/faux, exercices, défi de 7 jours, journal, bilan — **enregistrement automatique** ;
- clique « Poser une question au mentor » sous n'importe quelle question ;
- envoie son cahier, passe le **test final** (réussi à 7/10, autant d'essais qu'il veut) ;
- voit les corrections (✓ / ✗ et commentaires) et la validation de la leçon.

**Mentor (admin)**
- tableau de bord par classe : qui a commencé, envoyé, été validé, score au test ;
- débloque/verrouille les leçons (classe entière ou un élève) ;
- lit tout le cahier de ses élèves, met ✓ ou ✗ et un commentaire sur chaque réponse, voit la bonne réponse des vrai/faux, écrit une appréciation et **valide la leçon** ;
- répond aux questions (boîte « Questions », non lues en premier) ;
- peut redéfinir le mot de passe d'un de ses élèves.

**Superadmin**
- tout ce que fait un mentor, pour **tous** les élèves ;
- gère les comptes : rôles, mentor de chaque élève, classe, activer/désactiver, nouveau mot de passe ;
- crée et modifie les classes et leurs codes.

---

## 7. Bon à savoir

- **Mot de passe oublié** : le mentor ou le superadmin en définit un nouveau (bouton « Mot de passe »).
- **Nombre d'élèves** : le plan gratuit de Supabase accepte largement plusieurs milliers d'élèves (50 000 utilisateurs actifs par mois, 500 Mo de données).
- **Sauvegardes** : Supabase → *Database → Backups* (plan payant) ou export régulier depuis *Table Editor*.
- Le score du test est calculé dans le navigateur de l'élève : suffisant pour un parcours de formation, pas pour un examen officiel.
- **Modifier le contenu** des leçons : le fichier `js/content.js` contient tout le texte (résumés, questions, tests).

## Structure

```
index.html            page unique
css/style.css         design (violet et or)
js/config.js          configuration (générée par Docker en production)
js/content.js         contenu des 36 leçons + tests
js/api.js             accès aux données (démo ou Supabase)
js/app.js             l'application
img/logo.png          logo
files/                supports de cours et cahiers (Word) à télécharger
supabase/schema.sql   base de données et règles de sécurité
Dockerfile, docker/   déploiement Coolify (nginx)
```
