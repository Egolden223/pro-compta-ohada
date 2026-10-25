# Déploiement simple — GitHub + Vercel

## 1. Mettre le code sur GitHub

1. Téléchargez `PRO_COMPTA_OHADA_PRODUCTION.zip` et décompressez-le.
2. Ouvrez : https://github.com/Egolden223/pro-compta-ohada
3. Cliquez **Add file** → **Upload files**
4. Glissez **tout le contenu** du dossier décompressé (pas le zip).
5. En bas : **Commit changes**

### Variante avec Git (PC)

```bash
unzip PRO_COMPTA_OHADA_PRODUCTION.zip
cd PRO_COMPTA_OHADA_PRODUCTION
git init
git branch -M main
git remote add origin https://github.com/Egolden223/pro-compta-ohada.git
git add .
git commit -m "Initial PRO COMPTA OHADA"
git push -u origin main
```

## 2. Déployer sur Vercel (2 minutes)

1. Allez sur https://vercel.com et connectez-vous avec **GitHub**
2. **Add New…** → **Project**
3. Importez **pro-compta-ohada**
4. Laissez les réglages détectés (Vite)
5. Cliquez **Deploy**
6. Attendez 1–3 minutes → vous obtenez une URL du type :
   `https://pro-compta-ohada.vercel.app`

## 3. Installer sur vos appareils

Ouvrez l’URL HTTPS Vercel, puis :

| Appareil | Action |
|---------|--------|
| **Android** | Chrome → menu ⋮ → Installer l’application |
| **iPhone** | Safari → Partager → Sur l’écran d’accueil |
| **PC** | Chrome/Edge → icône Installer dans la barre d’adresse |

## Notes

- HTTPS est fourni par Vercel → PWA et hors ligne fonctionnent.
- Les données restent en local sur chaque appareil (localStorage + IndexedDB).
- Chaque `git push` sur `main` redéploie automatiquement.
