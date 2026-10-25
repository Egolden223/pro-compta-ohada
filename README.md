# PRO COMPTA OHADA

Comptabilité SYSCOHADA — PWA installable (PC, Android, iPhone), hors ligne + sync.

## Déploiement rapide (GitHub + Vercel)

### 1. Pousser le code source complet

Téléchargez `PRO_COMPTA_OHADA_PRODUCTION.zip`, décompressez, puis :

```bash
cd PRO_COMPTA_OHADA_PRODUCTION
git init
git branch -M main
git remote add origin https://github.com/Egolden223/pro-compta-ohada.git
git add .
git commit -m "PRO COMPTA OHADA — source complète"
git push -u origin main --force
```

(Le `--force` écrase les fichiers de config déjà présents.)

### 2. Vercel

1. https://vercel.com → **Add New Project**
2. Importer **pro-compta-ohada**
3. **Deploy**

URL : `https://pro-compta-ohada.vercel.app` (ou similaire)

### 3. Installer l'app

- Android : Chrome → Installer
- iPhone : Safari → Partager → Sur l'écran d'accueil
- PC : Chrome → Installer

Config déjà en place : `vercel.json`, `package.json` (`build:vercel`), PWA (`manifest` + `sw.js`).
